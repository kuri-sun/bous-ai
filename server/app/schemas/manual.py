from typing import TypedDict

from pydantic import BaseModel

from app.schemas.session import SessionDetail


class InputImage(TypedDict):
    description: str
    public_url: str
    gcs_uri: str | None
    filename: str | None
    content_type: str | None


class IllustrationPrompt(TypedDict):
    id: str
    prompt: str
    alt: str | None


class IllustrationImage(TypedDict):
    id: str
    prompt: str
    public_url: str
    gcs_uri: str | None
    content_type: str | None
    alt: str | None


class GenerateResponse(BaseModel):
    session: SessionDetail | None = None
