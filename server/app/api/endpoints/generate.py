import os

from fastapi import APIRouter, HTTPException, Request, UploadFile
from starlette.datastructures import UploadFile as StarletteUploadFile

from app.core.config import get_settings
from app.schemas.manual import GenerateResponse, IllustrationImage, InputImage
from app.services.generate import (
    generate_manual_html_from_markdown,
    generate_manual_pdf,
    generate_markdown_with_prompts,
)
from app.services.nanobanana import generate_illustration
from app.services.sessions import get_session, update_session
from app.services.storage import public_url, upload_bytes
from app.utils.dates import build_issued_on

router = APIRouter()


def _is_upload_file(value: object) -> bool:
    return isinstance(value, StarletteUploadFile)


@router.post("/generate", response_model=GenerateResponse)
async def generate(
    request: Request,
) -> GenerateResponse:
    form = await request.form()
    memo = (form.get("memo") or "").strip()
    session_id = form.get("session_id")
    if not isinstance(session_id, str) or not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    image_list: list[UploadFile] = []
    descriptions: list[str] = []
    for key, value in form.multi_items():
        if key == "images" and _is_upload_file(value):
            image_list.append(value)
            continue
        if key == "image_descriptions" and isinstance(value, str):
            descriptions.append(value)
            continue

    if not memo and not image_list:
        raise HTTPException(status_code=400, detail="memo or images are required")

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    settings = get_settings()
    if not settings.gcs_bucket:
        raise HTTPException(status_code=500, detail="GCS_BUCKET is not set")

    if image_list and len(descriptions) != len(image_list):
        raise HTTPException(
            status_code=400, detail="image_descriptions length mismatch"
        )

    uploaded_images: list[InputImage] = []
    for index, image in enumerate(image_list):
        description = (descriptions[index] or "").strip()
        if not description:
            raise HTTPException(status_code=400, detail="image description is required")
        file_bytes = await image.read()
        filename = os.path.basename(image.filename or f"input-{index + 1}.png")
        content_type = image.content_type or "application/octet-stream"
        blob_name = f"sessions/{session_id}/input/images/{index + 1}-{filename}"
        gcs_uri = upload_bytes(settings.gcs_bucket, blob_name, file_bytes, content_type)
        uploaded_images.append(
            {
                "description": description,
                "public_url": public_url(settings.gcs_bucket, blob_name),
                "gcs_uri": gcs_uri,
                "filename": filename,
                "content_type": content_type,
            }
        )

    inputs = session.get("inputs") or {}
    step1 = inputs.get("step1") or {}
    name = ""
    author = ""
    if isinstance(step1, dict):
        name = str(step1.get("name") or "").strip()
        author = str(step1.get("author") or "").strip()
    manual_title = f"{name} 防災マニュアル" if name else "防災マニュアル"

    issued_on = build_issued_on()
    markdown, illustration_prompts = generate_markdown_with_prompts(
        memo,
        uploaded_images,
        manual_title,
        name,
        author,
        issued_on,
    )

    illustration_images: list[IllustrationImage] = []
    for index, prompt in enumerate(illustration_prompts, start=1):
        image_bytes, content_type = generate_illustration(prompt["prompt"])
        illustration_id = prompt["id"]
        blob_name = (
            f"sessions/{session_id}/output/illustrations/{illustration_id}-{index}.png"
        )
        gcs_uri = upload_bytes(
            settings.gcs_bucket, blob_name, image_bytes, content_type
        )
        illustration_images.append(
            {
                "id": illustration_id,
                "prompt": prompt["prompt"],
                "public_url": public_url(settings.gcs_bucket, blob_name),
                "gcs_uri": gcs_uri,
                "content_type": content_type,
                "alt": prompt.get("alt"),
            }
        )

    html, markdown = generate_manual_html_from_markdown(
        markdown, uploaded_images, illustration_images
    )
    pdf_bytes = await generate_manual_pdf(html)

    blob_name = f"sessions/{session_id}/output/manual.pdf"
    upload_bytes(settings.gcs_bucket, blob_name, pdf_bytes, "application/pdf")
    update_session(
        session_id,
        {
            "status": "done",
            "pdf_blob_name": blob_name,
            "inputs": {
                "step2": {
                    "memo": memo,
                    "manual_title": manual_title,
                    "name": name,
                    "author": author,
                    "issued_on": issued_on,
                    "uploaded_images": uploaded_images,
                    "illustration_prompts": illustration_prompts,
                    "illustration_images": illustration_images,
                },
                "html": html,
                "markdown": markdown,
            },
        },
    )
    session_payload = get_session(session_id)
    return GenerateResponse(session=session_payload)
