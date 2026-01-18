from google import genai

from app.core.config import get_settings
from app.utils.bytes import coerce_bytes


def generate_illustration(prompt: str) -> tuple[bytes, str]:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.models.generate_content(
        model=settings.nanobanana_model,
        contents=[prompt],
    )

    for candidate in getattr(response, "candidates", []) or []:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) if content else None
        for part in parts or []:
            inline_data = getattr(part, "inline_data", None)
            if not inline_data:
                continue
            data = getattr(inline_data, "data", None)
            if not data:
                continue
            mime_type = getattr(inline_data, "mime_type", None) or "image/png"
            return coerce_bytes(data), mime_type

    raise RuntimeError("NanoBanana response did not include image data")
