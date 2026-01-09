from typing import Any

from pydantic import BaseModel


class SessionSummary(BaseModel):
    id: str
    name: str | None = None
    status: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    inputs: dict[str, Any] | None = None


class SessionsResponse(BaseModel):
    sessions: list[SessionSummary]


class SessionDetail(BaseModel):
    id: str
    name: str | None = None
    status: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    inputs: dict[str, Any] | None = None
    form: dict[str, Any] | None = None
    msg: str | None = None


class SessionCreateRequest(BaseModel):
    name: str


class SessionDetailResponse(BaseModel):
    session: SessionDetail
