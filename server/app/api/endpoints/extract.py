from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.manual import AnalyzeResponse
from app.services.extract import build_extract_response
from app.services.ocr import detect_text_from_file

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    source_type: str = Form("mixed"),
    text: Optional[str] = Form(None),
    file_description: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
) -> AnalyzeResponse:
    if not text and not file:
        raise HTTPException(status_code=400, detail="text or file is required")

    extracted: dict[str, Any] = {
        "source_type": source_type,
        "has_text": bool(text),
        "has_file": bool(file),
    }

    if text:
        extracted["memo"] = text

    if file:
        extracted_text = await detect_text_from_file(file)
        extracted["text_extracted_from_uploaded_file"] = extracted_text

    if file_description:
        extracted["description_for_uploaded_file"] = file_description

    return build_extract_response(extracted)
