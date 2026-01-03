from fastapi import APIRouter

from fastapi import HTTPException

from app.schemas.session import SessionDetailResponse, SessionsResponse
from app.services.sessions import get_session, list_sessions

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
