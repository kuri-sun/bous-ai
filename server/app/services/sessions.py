from typing import Any, Dict, List

from google.cloud import firestore

from app.core.config import get_settings

SESSIONS_COLLECTION = "sessions"


def _client() -> firestore.Client:
    settings = get_settings()
    return firestore.Client(project=settings.gcp_project)


def create_session(data: Dict[str, Any]) -> str:
    db = _client()
    doc_ref = db.collection(SESSIONS_COLLECTION).document()
    payload = {
        **data,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    doc_ref.set(payload)
    return doc_ref.id


def update_session(session_id: str, data: Dict[str, Any]) -> None:
    db = _client()
    db.collection(SESSIONS_COLLECTION).document(session_id).set(
        {**data, "updated_at": firestore.SERVER_TIMESTAMP}, merge=True
    )


def list_sessions(limit: int = 50) -> List[Dict[str, Any]]:
    db = _client()
    query = db.collection(SESSIONS_COLLECTION).limit(limit)
    sessions: List[Dict[str, Any]] = []
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
                "status": payload.get("status"),
                "pdf_url": payload.get("pdf_url"),
                "created_at": created_at,
                "updated_at": updated_at,
                "inputs": payload.get("inputs"),
            }
        )
    return sessions
