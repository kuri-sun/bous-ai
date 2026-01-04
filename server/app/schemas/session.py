from typing import Any, Optional

from pydantic import BaseModel


class SessionSummary(BaseModel):
    id: str
    status: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    inputs: Optional[dict[str, Any]] = None


class SessionsResponse(BaseModel):
    sessions: list[SessionSummary]


class SessionDetail(BaseModel):
    id: str
    status: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    inputs: Optional[dict[str, Any]] = None
    form: Optional[dict[str, Any]] = None
    msg: Optional[str] = None


class SessionDetailResponse(BaseModel):
    session: SessionDetail
