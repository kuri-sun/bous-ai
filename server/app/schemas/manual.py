from pydantic import BaseModel

from app.schemas.session import SessionDetail


class GenerateResponse(BaseModel):
    session: SessionDetail | None = None
