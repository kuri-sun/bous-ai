import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from google.api_core.exceptions import NotFound
from google.cloud import storage

from app.core.config import get_settings
from app.schemas.session import SessionDetailResponse, SessionsResponse
from app.services.sessions import get_session, get_session_pdf_blob_name, list_sessions

router = APIRouter()


@router.get("/sessions", response_model=SessionsResponse)
def sessions() -> SessionsResponse:
    return SessionsResponse(sessions=list_sessions())


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
def session_detail(session_id: str) -> SessionDetailResponse:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionDetailResponse(session=session)


@router.get("/sessions/{session_id}/download")
def download_session_pdf(session_id: str) -> StreamingResponse:
    blob_name = get_session_pdf_blob_name(session_id)
    if not blob_name:
        raise HTTPException(status_code=404, detail="PDF not found")

    settings = get_settings()
    if not settings.gcs_bucket:
        raise HTTPException(status_code=500, detail="GCS_BUCKET is not set")

    client = storage.Client(project=settings.gcp_project)
    bucket = client.bucket(settings.gcs_bucket)
    blob = bucket.blob(blob_name)
    try:
        data = blob.download_as_bytes()
    except NotFound as exc:
        raise HTTPException(status_code=404, detail="PDF not found") from exc

    headers = {"Content-Disposition": "attachment; filename=manual.pdf"}
    return StreamingResponse(
        io.BytesIO(data), media_type="application/pdf", headers=headers
    )
