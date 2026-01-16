import json
from typing import Any

from google.cloud import storage, vision

from app.core.config import get_settings


def _extract_text_from_vision_output(payload: dict[str, Any]) -> str:
    texts = payload.get("responses") or []
    lines: list[str] = []
    for response in texts:
        annotation = response.get("fullTextAnnotation") or {}
        if not annotation:
            continue
        text = annotation.get("text") or ""
        if text:
            lines.append(text)
    return "\n".join(lines)


def _detect_text_from_image(image_bytes: bytes) -> str:
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=image_bytes)
    response = client.document_text_detection(image=image)
    if response.error.message:
        raise RuntimeError(response.error.message)
    return response.full_text_annotation.text or ""


def _detect_text_from_pdf(
    file_bytes: bytes, filename: str, gcs_uri: str
) -> str:
    settings = get_settings()
    if not settings.gcs_bucket:
        raise RuntimeError("GCS_BUCKET is not set")

    client = vision.ImageAnnotatorClient()
    gcs_source = vision.GcsSource(uri=gcs_uri)
    input_config = vision.InputConfig(
        gcs_source=gcs_source, mime_type="application/pdf"
    )
    job_id = filename.replace("/", "_")
    output_uri = f"gs://{settings.gcs_bucket}/{settings.gcs_output_prefix}{job_id}/"
    gcs_destination = vision.GcsDestination(uri=output_uri)
    output_config = vision.OutputConfig(gcs_destination=gcs_destination, batch_size=2)
    request = vision.AsyncAnnotateFileRequest(
        features=[vision.Feature(type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION)],
        input_config=input_config,
        output_config=output_config,
    )
    operation = client.async_batch_annotate_files(requests=[request])
    operation.result(timeout=180)

    storage_client = storage.Client()
    bucket = storage_client.bucket(settings.gcs_bucket)
    prefix = f"{settings.gcs_output_prefix}{job_id}/"
    blobs = list(bucket.list_blobs(prefix=prefix))
    extracted_texts: list[str] = []
    for blob in blobs:
        content = blob.download_as_bytes()
        payload = json.loads(content)
        extracted_texts.append(_extract_text_from_vision_output(payload))
    return "\n".join(text for text in extracted_texts if text)


def detect_text_from_bytes(
    file_bytes: bytes, filename: str, content_type: str, gcs_uri: str
) -> str:
    if content_type == "application/pdf" or filename.endswith(".pdf"):
        return _detect_text_from_pdf(file_bytes, filename, gcs_uri)
    return _detect_text_from_image(file_bytes)
