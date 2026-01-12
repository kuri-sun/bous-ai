from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.manual import GenerateRequest, GenerateResponse
from app.services.generate import generate_manual_html, generate_manual_pdf
from app.services.sessions import get_session, update_session
from app.services.storage import upload_bytes

router = APIRouter()


@router.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest) -> GenerateResponse:
    html, plain_text = generate_manual_html(request.answers, request.extracted)
    pdf_bytes = await generate_manual_pdf(html)
    session_payload = None
    if request.session_id:
        settings = get_settings()
        if settings.gcs_bucket:
            blob_name = f"sessions/{request.session_id}/output/manual.pdf"
            upload_bytes(settings.gcs_bucket, blob_name, pdf_bytes, "application/pdf")
        update_session(
            request.session_id,
            {
                "status": "done",
                "pdf_blob_name": blob_name,
                "inputs": {
                    "step2": request.answers,
                    "step2_html": html,
                    "step2_plain_text": plain_text,
                },
            },
        )
        session_payload = get_session(request.session_id)
    return GenerateResponse(session=session_payload)
