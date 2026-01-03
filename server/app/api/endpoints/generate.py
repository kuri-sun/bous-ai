from fastapi import APIRouter

from app.schemas.manual import GenerateRequest, GenerateResponse
from app.services.generate import generate_manual_html, generate_manual_pdf

router = APIRouter()


@router.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest) -> GenerateResponse:
    html = generate_manual_html(request.answers, request.extracted)
    pdf_bytes = await generate_manual_pdf(html)
    return GenerateResponse.from_pdf_bytes(pdf_bytes)
