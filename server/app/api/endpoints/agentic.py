from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.schemas.agentic import (
    AgenticConversationResponse,
    AgenticDecisionRequest,
    AgenticDecisionResponse,
    AgenticRespondRequest,
    AgenticStartRequest,
)
from app.services.agentic import build_agentic_turn
from app.services.generate import generate_manual_html, generate_manual_pdf
from app.services.search import search_official_manual
from app.services.sessions import get_session, update_session
from app.services.storage import upload_bytes

router = APIRouter()


def _build_agentic_context(session: dict) -> dict:
    inputs = session.get("inputs") or {}
    return {
        "place": session.get("place") or {},
        "extracted": inputs.get("step1_extracted") or {},
        "answers": inputs.get("step2") or {},
        "generated_html": inputs.get("step2_html") or "",
        "generated_plain_text": inputs.get("step2_plain_text") or "",
    }


def _coerce_history(raw_history: list[dict] | None) -> list[dict[str, str]]:
    history: list[dict[str, str]] = []
    for item in raw_history or []:
        role = item.get("role")
        content = item.get("content")
    if role in {"assistant", "user"} and isinstance(content, str) and content.strip():
        history.append({"role": role, "content": content.strip()})
    return history


@router.post("/agentic/start", response_model=AgenticConversationResponse)
def agentic_start(request: AgenticStartRequest) -> AgenticConversationResponse:
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    place = session.get("place") or {}
    if not place:
        raise HTTPException(status_code=400, detail="Place is required")

    city = place.get("city")
    prefecture = place.get("prefecture")
    try:
        search = search_official_manual(city, prefecture, place)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    context = _build_agentic_context(session)
    context["search"] = search or {}
    context["search_reference_text"] = (search or {}).get("reference_text") or ""
    history: list[dict[str, str]] = []
    turn = build_agentic_turn(context, history)
    status = "question" if turn["kind"] == "question" else "proposal"
    history.append({"role": "assistant", "content": turn["content"]})
    agentic_state = {
        "status": status,
        "turn": turn,
        "proposal": turn["content"] if turn["kind"] == "proposal" else None,
        "history": history,
        "search": search,
        "search_reference_text": context.get("search_reference_text"),
    }
    update_session(request.session_id, {"agentic": agentic_state})
    return AgenticConversationResponse(agentic=agentic_state)


@router.post("/agentic/respond", response_model=AgenticConversationResponse)
def agentic_respond(request: AgenticRespondRequest) -> AgenticConversationResponse:
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    agentic_state = session.get("agentic") or {}
    status = agentic_state.get("status")
    if status not in {"question", "proposal", "accepted", "rejected"}:
        raise HTTPException(status_code=400, detail="Agent is not waiting for input")
    answer = request.answer.strip()
    if not answer:
        raise HTTPException(status_code=400, detail="Answer is required")

    context = _build_agentic_context(session)
    search_state = agentic_state.get("search") or {}
    context["search"] = search_state
    context["search_reference_text"] = search_state.get("reference_text") or ""
    history = _coerce_history(agentic_state.get("history"))
    history.append({"role": "user", "content": answer})
    turn = build_agentic_turn(context, history)
    status = "question" if turn["kind"] == "question" else "proposal"
    history.append({"role": "assistant", "content": turn["content"]})
    agentic_state = {
        "status": status,
        "turn": turn,
        "proposal": turn["content"] if turn["kind"] == "proposal" else None,
        "history": history,
        "search": agentic_state.get("search"),
        "search_reference_text": context.get("search_reference_text"),
    }
    update_session(request.session_id, {"agentic": agentic_state})
    return AgenticConversationResponse(agentic=agentic_state)


@router.post("/agentic/decision", response_model=AgenticDecisionResponse)
async def agentic_decision(
    request: AgenticDecisionRequest,
) -> AgenticDecisionResponse:
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    agentic_state = session.get("agentic") or {}
    status = agentic_state.get("status")
    if status != "proposal":
        raise HTTPException(status_code=400, detail="No proposal to decide on")
    history = _coerce_history(agentic_state.get("history"))

    decision = request.decision
    if decision == "no":
        history.append({"role": "user", "content": "いいえ"})
        agentic_state.update(
            {
                "status": "rejected",
                "history": history,
            }
        )
        update_session(request.session_id, {"agentic": agentic_state})
        return AgenticDecisionResponse(agentic=agentic_state)

    proposal = agentic_state.get("proposal")
    if not isinstance(proposal, str) or not proposal.strip():
        raise HTTPException(status_code=400, detail="Proposal is missing")

    inputs = session.get("inputs") or {}
    answers = dict(inputs.get("step2") or {})
    answers["agentic_proposal"] = proposal.strip()
    extracted = inputs.get("step1_extracted") or {}

    html, plain_text = generate_manual_html(answers, extracted)
    pdf_bytes = await generate_manual_pdf(html)

    settings = get_settings()
    if not settings.gcs_bucket:
        raise HTTPException(status_code=500, detail="GCS_BUCKET is not set")
    blob_name = f"sessions/{request.session_id}/output/manual.pdf"
    upload_bytes(settings.gcs_bucket, blob_name, pdf_bytes, "application/pdf")

    history.append({"role": "user", "content": "はい"})
    agentic_state.update(
        {
            "status": "accepted",
            "history": history,
        }
    )
    update_session(
        request.session_id,
        {
            "status": "done",
            "pdf_blob_name": blob_name,
            "inputs": {
                **inputs,
                "step2": answers,
                "step2_html": html,
                "step2_plain_text": plain_text,
                "agentic": {"proposal": proposal},
            },
            "agentic": agentic_state,
        },
    )
    return AgenticDecisionResponse(agentic=agentic_state)
