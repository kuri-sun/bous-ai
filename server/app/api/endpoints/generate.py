from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.manual import GenerateRequest, GenerateResponse
from app.services.generate import generate_manual_html, generate_manual_pdf
from app.services.sessions import get_session, update_session
from app.services.storage import public_url, upload_bytes

router = APIRouter()


@router.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest) -> GenerateResponse:
    html = generate_manual_html(request.answers, request.extracted)
    pdf_bytes = await generate_manual_pdf(html)
    pdf_url = None
    session_payload = None
    if request.session_id:
        settings = get_settings()
        if settings.gcs_bucket:
            blob_name = f"sessions/{request.session_id}/output/manual.pdf"
            upload_bytes(
                settings.gcs_bucket, blob_name, pdf_bytes, "application/pdf"
            )
            pdf_url = public_url(settings.gcs_bucket, blob_name)
        update_session(
            request.session_id,
            {
                "status": "done",
                "pdf_url": pdf_url,
                "inputs": {"step2": request.answers},
            },
        )
        session_payload = get_session(request.session_id)
    return GenerateResponse(pdf_url=pdf_url, session=session_payload)
