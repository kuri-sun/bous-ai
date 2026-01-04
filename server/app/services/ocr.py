import json
import uuid
from typing import Any
from google.api_core.exceptions import GoogleAPIError
from google.cloud import storage, vision

from app.core.config import get_settings


def _extract_text_from_vision_output(payload: dict[str, Any]) -> str:
    responses = payload.get("responses", [])
    texts: list[str] = []
    for item in responses:
        annotation = item.get("fullTextAnnotation", {})
        text = annotation.get("text")
        if text:
            texts.append(text)
    return "\n".join(texts)


def _detect_text_from_image(image_bytes: bytes) -> str:
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=image_bytes)
    response = client.document_text_detection(image=image)
    if response.error.message:
        raise RuntimeError(response.error.message)
    return response.full_text_annotation.text or ""


def _detect_text_from_pdf_gcs(gcs_uri: str) -> str:
    settings = get_settings()
    if not settings.gcs_bucket:
        raise RuntimeError("GCS_BUCKET is not set")

    job_id = uuid.uuid4().hex
    output_uri = f"gs://{settings.gcs_bucket}/{settings.gcs_output_prefix}{job_id}/"

    client = vision.ImageAnnotatorClient()
    gcs_source = vision.GcsSource(uri=gcs_uri)
    input_config = vision.InputConfig(
        gcs_source=gcs_source,
        mime_type="application/pdf",
    )
    gcs_destination = vision.GcsDestination(uri=output_uri)
    output_config = vision.OutputConfig(gcs_destination=gcs_destination, batch_size=2)
    request = vision.AsyncAnnotateFileRequest(
        features=[vision.Feature(type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION)],
        input_config=input_config,
        output_config=output_config,
    )
    operation = client.async_batch_annotate_files(requests=[request])
    operation.result(timeout=180)

    prefix = f"{settings.gcs_output_prefix}{job_id}/"
    storage_client = storage.Client(project=settings.gcp_project)
    bucket = storage_client.bucket(settings.gcs_bucket)
    blobs = list(bucket.list_blobs(prefix=prefix))
    extracted_texts: list[str] = []
    for blob in blobs:
        if not blob.name.endswith(".json"):
            continue
        payload = json.loads(blob.download_as_bytes().decode("utf-8"))
        extracted_texts.append(_extract_text_from_vision_output(payload))

    for blob in blobs:
        blob.delete()

    return "\n".join(text for text in extracted_texts if text)


def detect_text_from_bytes(
    file_bytes: bytes, filename: str, content_type: str, gcs_uri: str | None
) -> str:
    try:
        if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
            if not gcs_uri:
                raise RuntimeError("GCS URI is required for PDF OCR")
            return _detect_text_from_pdf_gcs(gcs_uri)
        return _detect_text_from_image(file_bytes)
    except (GoogleAPIError, RuntimeError) as exc:
        raise RuntimeError(str(exc)) from exc
