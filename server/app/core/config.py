import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str | None
    gemini_model: str
    nanobanana_model: str
    google_api_key: str | None
    google_search_cx: str | None
    gcp_project: str | None
    gcs_bucket: str | None
    gcs_output_prefix: str


def get_settings() -> Settings:
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY"),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-3-flash-preview"),
        nanobanana_model=os.getenv("NANOBANANA_MODEL", "gemini-2.5-flash-image"),
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        google_search_cx=os.getenv("GOOGLE_SEARCH_CX"),
        gcp_project=os.getenv("GCP_PROJECT"),
        gcs_bucket=os.getenv("GCS_BUCKET"),
        gcs_output_prefix=os.getenv("GCS_OUTPUT_PREFIX", "vision-output/"),
    )
