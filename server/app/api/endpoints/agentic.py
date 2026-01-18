from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.schemas.agentic import (
    AgenticConversationResponse,
    AgenticDecisionRequest,
    AgenticDecisionResponse,
    AgenticRespondRequest,
    AgenticStartRequest,
)
from app.schemas.manual import IllustrationImage, InputImage
from app.services.agentic import build_agentic_turn
from app.services.generate import (
    generate_manual_html_with_proposal,
    generate_manual_pdf,
)
from app.services.search import search_official_manual
from app.services.sessions import get_session, update_session
from app.services.storage import upload_bytes
from app.utils.dates import build_issued_on

router = APIRouter()


def _build_agentic_context(session: dict) -> dict:
    inputs = session.get("inputs") or {}
    return {
        "place": session.get("place") or {},
        "answers": inputs.get("step2") or {},
        "generated_html": inputs.get("html") or "",
        "generated_markdown": inputs.get("markdown") or "",
    }


def _coerce_history(raw_history: list[dict] | None) -> list[dict[str, str]]:
    history: list[dict[str, str]] = []
    for item in raw_history or []:
        role = item.get("role")
        content = item.get("content")
        if (
            role in {"assistant", "user"}
            and isinstance(content, str)
            and content.strip()
        ):
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
    step1 = inputs.get("step1") or {}
    step2 = inputs.get("step2") or {}
    if not isinstance(step2, dict):
        raise HTTPException(status_code=400, detail="Step2 data is missing")

    memo = step2.get("memo")
    raw_images = step2.get("uploaded_images")
    if not isinstance(memo, str):
        raise HTTPException(status_code=400, detail="Step2 memo is missing")
    if not isinstance(raw_images, list):
        raise HTTPException(status_code=400, detail="Step2 images are missing")
    uploaded_images: list[InputImage] = []
    for item in raw_images:
        if not isinstance(item, dict):
            continue
        description = item.get("description")
        public_url_value = item.get("public_url")
        if not isinstance(description, str) or not isinstance(public_url_value, str):
            continue
        uploaded_images.append(
            {
                "description": description,
                "public_url": public_url_value,
                "gcs_uri": item.get("gcs_uri"),
                "filename": item.get("filename"),
                "content_type": item.get("content_type"),
            }
        )
    if not uploaded_images and raw_images:
        raise HTTPException(status_code=400, detail="Step2 images are invalid")

    previous_markdown = inputs.get("markdown")
    previous_html = inputs.get("html")
    if not isinstance(previous_markdown, str) or not previous_markdown.strip():
        raise HTTPException(status_code=400, detail="Step2 markdown is missing")
    if not isinstance(previous_html, str) or not previous_html.strip():
        raise HTTPException(status_code=400, detail="Step2 html is missing")

    name = ""
    author = ""
    issued_on = ""
    if isinstance(step1, dict):
        name = str(step1.get("name") or "").strip()
        author = str(step1.get("author") or "").strip()
    if isinstance(step2.get("issued_on"), str):
        issued_on = step2.get("issued_on").strip()
    if not issued_on:
        issued_on = build_issued_on()
    manual_title = f"{name} 防災マニュアル" if name else "防災マニュアル"

    illustration_images: list[IllustrationImage] = []
    raw_illustrations = step2.get("illustration_images")
    if isinstance(raw_illustrations, list):
        for item in raw_illustrations:
            if not isinstance(item, dict):
                continue
            illustration_id = item.get("id")
            public_url_value = item.get("public_url")
            prompt_text = item.get("prompt")
            if (
                not isinstance(illustration_id, str)
                or not isinstance(public_url_value, str)
                or not isinstance(prompt_text, str)
            ):
                continue
            illustration_images.append(
                {
                    "id": illustration_id,
                    "prompt": prompt_text,
                    "public_url": public_url_value,
                    "gcs_uri": item.get("gcs_uri"),
                    "content_type": item.get("content_type"),
                    "alt": item.get("alt"),
                }
            )

    html, markdown = generate_manual_html_with_proposal(
        previous_markdown,
        previous_html,
        proposal.strip(),
        uploaded_images,
        illustration_images,
        manual_title,
        name,
        author,
        issued_on,
    )
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
                "step2": {
                    "memo": memo,
                    "manual_title": manual_title,
                    "name": name,
                    "author": author,
                    "issued_on": issued_on,
                    "uploaded_images": uploaded_images,
                    "illustration_images": illustration_images,
                },
                "html": html,
                "markdown": markdown,
                "agentic": {"proposal": proposal},
            },
            "agentic": agentic_state,
        },
    )
    return AgenticDecisionResponse(agentic=agentic_state)
