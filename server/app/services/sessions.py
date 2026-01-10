from typing import Any

from google.cloud import firestore

from app.core.config import get_settings

SESSIONS_COLLECTION = "sessions"


def _client() -> firestore.Client:
    settings = get_settings()
    return firestore.Client(project=settings.gcp_project)


def create_session(data: dict[str, Any]) -> str:
    db = _client()
    doc_ref = db.collection(SESSIONS_COLLECTION).document()
    payload = {
        **data,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    doc_ref.set(payload)
    return doc_ref.id


def update_session(session_id: str, data: dict[str, Any]) -> None:
    db = _client()
    db.collection(SESSIONS_COLLECTION).document(session_id).set(
        {**data, "updated_at": firestore.SERVER_TIMESTAMP}, merge=True
    )


def list_sessions(limit: int = 50) -> list[dict[str, Any]]:
    db = _client()
    query = db.collection(SESSIONS_COLLECTION).limit(limit)
    sessions: list[dict[str, Any]] = []
    for doc in query.stream():
        payload = doc.to_dict() or {}
        created_at = payload.get("created_at")
        updated_at = payload.get("updated_at")
        if hasattr(created_at, "isoformat"):
            created_at = created_at.isoformat()
        if hasattr(updated_at, "isoformat"):
            updated_at = updated_at.isoformat()
        sessions.append(
            {
                "id": doc.id,
                "place": payload.get("place"),
                "status": payload.get("status"),
                "created_at": created_at,
                "updated_at": updated_at,
                "inputs": payload.get("inputs"),
            }
        )
    return sessions


def get_session(session_id: str) -> dict[str, Any] | None:
    db = _client()
    doc = db.collection(SESSIONS_COLLECTION).document(session_id).get()
    if not doc.exists:
        return None
    payload = doc.to_dict() or {}
    created_at = payload.get("created_at")
    updated_at = payload.get("updated_at")
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()
    if hasattr(updated_at, "isoformat"):
        updated_at = updated_at.isoformat()
    return {
        "id": doc.id,
        "place": payload.get("place"),
        "status": payload.get("status"),
        "created_at": created_at,
        "updated_at": updated_at,
        "inputs": payload.get("inputs"),
        "form": payload.get("form"),
        "msg": payload.get("msg"),
    }


def get_session_pdf_blob_name(session_id: str) -> str | None:
    db = _client()
    doc = db.collection(SESSIONS_COLLECTION).document(session_id).get()
    if not doc.exists:
        return None
    payload = doc.to_dict() or {}
    blob_name = payload.get("pdf_blob_name")
    if isinstance(blob_name, str) and blob_name:
        return blob_name
    return None
