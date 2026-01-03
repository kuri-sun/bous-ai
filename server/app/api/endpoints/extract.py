from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import get_settings
from app.schemas.manual import AnalyzeResponse
from app.services.extract import build_extract_response
from app.services.ocr import detect_text_from_bytes
from app.services.sessions import create_session, update_session
from app.services.storage import upload_bytes

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

    session_id = create_session({"status": "step1"})
    if text:
        extracted["memo"] = text

    file_gcs_uri = None
    if file:
        file_bytes = await file.read()
        filename = file.filename or "input.pdf"
        content_type = file.content_type or "application/octet-stream"
        settings = get_settings()
        if not settings.gcs_bucket:
            raise HTTPException(status_code=500, detail="GCS_BUCKET is not set")
        file_gcs_uri = upload_bytes(
            settings.gcs_bucket,
            f"sessions/{session_id}/input/{filename}",
            file_bytes,
            content_type,
        )
        try:
            extracted_text = detect_text_from_bytes(
                file_bytes, filename, content_type, file_gcs_uri
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        extracted["uploaded_file_gcs_uri"] = file_gcs_uri
        extracted["uploaded_file_name"] = filename
        extracted["uploaded_file_content_type"] = content_type
        extracted["text_extracted_from_uploaded_file"] = extracted_text

    if file_description:
        extracted["description_for_uploaded_file"] = file_description

    update_session(
        session_id,
        {
            "inputs": {
                "step1": {
                    "memo": text,
                    "file_description": file_description,
                    "uploaded_file_gcs_uri": file_gcs_uri,
                    "uploaded_file_name": file.filename if file else None,
                    "uploaded_file_content_type": file.content_type if file else None,
                }
            }
        },
    )
    response = build_extract_response(extracted)
    update_session(
        session_id,
        {
            "status": "step2",
            "inputs": {"step1_extracted": extracted},
            "form": response.form.model_dump(),
            "msg": response.msg,
        },
    )
    return AnalyzeResponse(
        msg=response.msg,
        form=response.form,
        extracted=response.extracted,
        session_id=session_id,
    )
