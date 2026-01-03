from typing import Optional

from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import get_settings

_llm: Optional[ChatGoogleGenerativeAI] = None


def get_llm() -> ChatGoogleGenerativeAI:
    global _llm
    if _llm is None:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        _llm = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            temperature=0.3,
            google_api_key=settings.gemini_api_key,
        )
    return _llm
