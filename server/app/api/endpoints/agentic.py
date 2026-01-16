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
from app.services.generate import (
    IllustrationImage,
    InputImage,
    generate_manual_html_from_markdown,
    generate_manual_pdf,
    generate_markdown_with_prompts,
)
from app.services.nanobanana import generate_illustration
from app.services.search import search_official_manual
from app.services.sessions import get_session, update_session
from app.services.storage import public_url, upload_bytes

router = APIRouter()


def _build_agentic_context(session: dict) -> dict:
    inputs = session.get("inputs") or {}
    return {
        "place": session.get("place") or {},
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
    step2 = inputs.get("step2") or {}
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

    markdown, illustration_prompts = generate_markdown_with_prompts(
        memo, uploaded_images, proposal.strip()
    )

    settings = get_settings()
    if not settings.gcs_bucket:
        raise HTTPException(status_code=500, detail="GCS_BUCKET is not set")

    illustration_images: list[IllustrationImage] = []
    for index, prompt in enumerate(illustration_prompts, start=1):
        image_bytes, content_type = generate_illustration(prompt["prompt"])
        illustration_id = prompt["id"]
        blob_name = f"sessions/{request.session_id}/output/illustrations/{illustration_id}-{index}.png"
        gcs_uri = upload_bytes(
            settings.gcs_bucket, blob_name, image_bytes, content_type
        )
        illustration_images.append(
            {
                "id": illustration_id,
                "prompt": prompt["prompt"],
                "public_url": public_url(settings.gcs_bucket, blob_name),
                "gcs_uri": gcs_uri,
                "content_type": content_type,
                "alt": prompt.get("alt"),
            }
        )

    html, plain_text = generate_manual_html_from_markdown(
        markdown, uploaded_images, illustration_images, proposal.strip()
    )
    pdf_bytes = await generate_manual_pdf(html)

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
                    "uploaded_images": uploaded_images,
                    "illustration_prompts": illustration_prompts,
                    "illustration_images": illustration_images,
                    "markdown": markdown,
                },
                "step2_html": html,
                "step2_plain_text": plain_text,
                "agentic": {"proposal": proposal},
            },
            "agentic": agentic_state,
        },
    )
    return AgenticDecisionResponse(agentic=agentic_state)
