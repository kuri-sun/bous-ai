from typing import Any

from pydantic import BaseModel

from app.schemas.agentic import AgenticState
from app.schemas.place import PlaceDetail


class SessionSummary(BaseModel):
    id: str
    place: PlaceDetail | None = None
    status: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    inputs: dict[str, Any] | None = None


class SessionsResponse(BaseModel):
    sessions: list[SessionSummary]


class SessionDetail(BaseModel):
    id: str
    place: PlaceDetail | None = None
    status: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    inputs: dict[str, Any] | None = None
    agentic: AgenticState | None = None


class SessionCreateRequest(BaseModel):
    place: PlaceDetail
    name: str | None = None
    author: str | None = None


class SessionDetailResponse(BaseModel):
    session: SessionDetail
