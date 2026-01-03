import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str | None
    gemini_model: str
    gcp_project: str | None
    gcs_bucket: str | None
    gcs_output_prefix: str


def get_settings() -> Settings:
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY"),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-3-flash-preview"),
        gcp_project=os.getenv("GCP_PROJECT"),
        gcs_bucket=os.getenv("GCS_BUCKET"),
        gcs_output_prefix=os.getenv("GCS_OUTPUT_PREFIX", "vision-output/"),
    )
