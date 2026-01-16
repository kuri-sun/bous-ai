import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from google.api_core.exceptions import NotFound
from google.cloud import storage

from app.core.config import get_settings
from app.schemas.session import (
    SessionCreateRequest,
    SessionDetailResponse,
    SessionsResponse,
)
from app.services.sessions import (
    create_session,
    delete_session,
    get_session,
    get_session_pdf_blob_name,
    list_sessions,
)
from app.services.storage import delete_prefix

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


@router.post("/sessions", response_model=SessionDetailResponse)
def create_session_entry(request: SessionCreateRequest) -> SessionDetailResponse:
    if not request.place or not request.place.place_id:
        raise HTTPException(status_code=400, detail="place is required")
    manual_title = (request.manual_title or "").strip() or "防災マニュアル"
    session_id = create_session(
        {
            "status": "step2",
            "place": request.place.model_dump(),
            "inputs": {"step1": {"manual_title": manual_title}},
        }
    )
    session = get_session(session_id)
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


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session_entry(session_id: str) -> None:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    settings = get_settings()
    if settings.gcs_bucket:
        delete_prefix(settings.gcs_bucket, f"sessions/{session_id}/")
    delete_session(session_id)
