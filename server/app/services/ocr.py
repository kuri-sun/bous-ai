import json
import uuid
from typing import Any

from fastapi import HTTPException, UploadFile
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


def _detect_text_from_pdf(pdf_bytes: bytes, filename: str) -> str:
    settings = get_settings()
    if not settings.gcs_bucket:
        raise RuntimeError("GCS_BUCKET is not set")

    job_id = uuid.uuid4().hex
    upload_name = f"uploads/{job_id}-{filename}"
    output_uri = f"gs://{settings.gcs_bucket}/{settings.gcs_output_prefix}{job_id}/"

    storage_client = storage.Client(project=settings.gcp_project)
    bucket = storage_client.bucket(settings.gcs_bucket)
    upload_blob = bucket.blob(upload_name)
    upload_blob.upload_from_string(pdf_bytes, content_type="application/pdf")

    client = vision.ImageAnnotatorClient()
    gcs_source = vision.GcsSource(uri=f"gs://{settings.gcs_bucket}/{upload_name}")
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
    blobs = list(bucket.list_blobs(prefix=prefix))
    extracted_texts: list[str] = []
    for blob in blobs:
        if not blob.name.endswith(".json"):
            continue
        payload = json.loads(blob.download_as_bytes().decode("utf-8"))
        extracted_texts.append(_extract_text_from_vision_output(payload))

    for blob in blobs:
        blob.delete()
    upload_blob.delete()

    return "\n".join(text for text in extracted_texts if text)


async def detect_text_from_file(upload: UploadFile) -> str:
    try:
        file_bytes = await upload.read()
        filename = upload.filename or "input.pdf"
        if upload.content_type == "application/pdf" or filename.lower().endswith(".pdf"):
            return _detect_text_from_pdf(file_bytes, filename)
        return _detect_text_from_image(file_bytes)
    except (GoogleAPIError, RuntimeError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
