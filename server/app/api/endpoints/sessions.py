from fastapi import APIRouter

from app.schemas.session import SessionsResponse
from app.services.sessions import list_sessions

router = APIRouter()


@router.get("/sessions", response_model=SessionsResponse)
def sessions() -> SessionsResponse:
    return SessionsResponse(sessions=list_sessions())
