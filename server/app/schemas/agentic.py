from typing import Literal

from pydantic import BaseModel, Field


class SearchResult(BaseModel):
    title: str
    link: str
    snippet: str | None = None


class SearchContext(BaseModel):
    query: str
    scope: str
    result: SearchResult | None = None


class AgenticTurn(BaseModel):
    kind: Literal["question", "proposal"]
    content: str


class AgenticMessage(BaseModel):
    role: Literal["assistant", "user"]
    content: str


class AgenticState(BaseModel):
    status: Literal["idle", "question", "proposal", "accepted", "rejected"]
    turn: AgenticTurn | None = None
    proposal: str | None = None
    history: list[AgenticMessage] = Field(default_factory=list)
    search: SearchContext | None = None


class AgenticStartRequest(BaseModel):
    session_id: str


class AgenticRespondRequest(BaseModel):
    session_id: str
    answer: str


class AgenticDecisionRequest(BaseModel):
    session_id: str
    decision: Literal["yes", "no"]


class AgenticConversationResponse(BaseModel):
    agentic: AgenticState


class AgenticDecisionResponse(BaseModel):
    agentic: AgenticState
