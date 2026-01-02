import base64
import json
import os
import uuid
from typing import Any, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google.api_core.exceptions import GoogleAPIError
from google.cloud import storage, vision
from langchain_core.messages import AIMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from playwright.async_api import async_playwright
from pydantic import BaseModel

app = FastAPI(title="Server API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


class FormField(BaseModel):
    id: str
    label: str
    field_type: str
    required: bool = True
    placeholder: Optional[str] = None
    options: Optional[List[str]] = None


class FormSchema(BaseModel):
    fields: List[FormField]


class AnalyzeResponse(BaseModel):
    msg: str
    form: FormSchema
    extracted: Optional[dict[str, Any]] = None


class GenerateRequest(BaseModel):
    extracted: Optional[dict[str, Any]] = None
    answers: dict[str, Any]
    source_meta: Optional[dict[str, Any]] = None


class GenerateResponse(BaseModel):
    filename: str
    pdf_base64: str


_llm: Optional[ChatGoogleGenerativeAI] = None


def get_llm() -> ChatGoogleGenerativeAI:
    global _llm
    if _llm is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        model_name = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
        _llm = ChatGoogleGenerativeAI(
            model=model_name,
            temperature=0.3,
            google_api_key=api_key,
        )
    return _llm


def to_langchain_messages(
    history: List[ChatMessage], message: str
) -> List[HumanMessage | AIMessage]:
    messages: List[HumanMessage | AIMessage] = []
    for item in history:
        if item.role == "assistant":
            messages.append(AIMessage(content=item.content))
        else:
            messages.append(HumanMessage(content=item.content))
    messages.append(HumanMessage(content=message))
    return messages


def build_manual_html(
    answers: dict[str, Any], extracted: Optional[dict[str, Any]] = None
) -> str:
    detail_rows = "\n".join(
        f"<tr><th>{key}</th><td>{value}</td></tr>" for key, value in answers.items()
    )
    source_note = ""
    if extracted:
        source_note = "<p class='note'>見本からの抽出情報を含みます。</p>"
    return f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>防災マニュアル</title>
    <style>
      :root {{
        color-scheme: only light;
      }}
      body {{
        font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo",
          "Yu Gothic", sans-serif;
        margin: 32px;
        color: #1f2933;
      }}
      h1 {{
        font-size: 28px;
        margin: 0 0 16px;
        border-bottom: 2px solid #0f4c5c;
        padding-bottom: 8px;
      }}
      .note {{
        margin: 12px 0 24px;
        padding: 10px 12px;
        background: #f3f7f9;
        border-left: 4px solid #0f4c5c;
      }}
      table {{
        width: 100%;
        border-collapse: collapse;
        margin-top: 16px;
        font-size: 14px;
      }}
      th, td {{
        border: 1px solid #d5dfe6;
        padding: 8px 10px;
        vertical-align: top;
      }}
      th {{
        text-align: left;
        width: 30%;
        background: #f8fafc;
      }}
    </style>
  </head>
  <body>
    <h1>防災マニュアル</h1>
    {source_note}
    <table>
      <tbody>
        {detail_rows}
      </tbody>
    </table>
  </body>
</html>
"""


def _detect_text_from_image(image_bytes: bytes) -> str:
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=image_bytes)
    response = client.document_text_detection(image=image)
    if response.error.message:
        raise RuntimeError(response.error.message)
    return response.full_text_annotation.text or ""


def _extract_text_from_vision_output(payload: dict[str, Any]) -> str:
    responses = payload.get("responses", [])
    texts: list[str] = []
    for item in responses:
        annotation = item.get("fullTextAnnotation", {})
        text = annotation.get("text")
        if text:
            texts.append(text)
    return "\n".join(texts)


def _detect_text_from_pdf(pdf_bytes: bytes, filename: str) -> str:
    bucket_name = os.getenv("GCS_BUCKET")
    if not bucket_name:
        raise RuntimeError("GCS_BUCKET is not set")

    project = os.getenv("GCP_PROJECT")
    output_prefix = os.getenv("GCS_OUTPUT_PREFIX", "vision-output/")
    job_id = uuid.uuid4().hex
    upload_name = f"uploads/{job_id}-{filename}"
    output_uri = f"gs://{bucket_name}/{output_prefix}{job_id}/"

    storage_client = storage.Client(project=project)
    bucket = storage_client.bucket(bucket_name)
    upload_blob = bucket.blob(upload_name)
    upload_blob.upload_from_string(pdf_bytes, content_type="application/pdf")

    client = vision.ImageAnnotatorClient()
    gcs_source = vision.GcsSource(uri=f"gs://{bucket_name}/{upload_name}")
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

    prefix = f"{output_prefix}{job_id}/"
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


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        llm = get_llm()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    messages = to_langchain_messages(request.history, request.message)
    response = llm.invoke(messages)
    reply = response.content or ""
    return ChatResponse(reply=reply)


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    source_type: str = Form(...),
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
) -> AnalyzeResponse:
    if not text and not file:
        raise HTTPException(status_code=400, detail="text or file is required")

    extracted: dict[str, Any] = {"source_type": source_type}
    if text:
        extracted["text_length"] = len(text)
        extracted["text"] = text
    if file:
        extracted["filename"] = file.filename
        extracted["content_type"] = file.content_type
        file_bytes = await file.read()
        try:
            if file.content_type == "application/pdf" or (
                file.filename and file.filename.lower().endswith(".pdf")
            ):
                extracted_text = _detect_text_from_pdf(file_bytes, file.filename)
            else:
                extracted_text = _detect_text_from_image(file_bytes)
            extracted["text"] = extracted_text
            extracted["text_length"] = len(extracted_text)
        except (GoogleAPIError, RuntimeError) as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    form = FormSchema(
        fields=[
            FormField(
                id="organization_name",
                label="組織名",
                field_type="text",
                placeholder="例: 株式会社サンプル",
            ),
            FormField(
                id="manual_title",
                label="マニュアル名",
                field_type="text",
                placeholder="例: 防災マニュアル",
            ),
            FormField(
                id="target_area",
                label="対象エリア",
                field_type="text",
                placeholder="例: 東京都渋谷区",
            ),
            FormField(
                id="evacuation_sites",
                label="避難場所",
                field_type="textarea",
                placeholder="例: 第1避難所... / 第2避難所...",
            ),
            FormField(
                id="emergency_contacts",
                label="緊急連絡先",
                field_type="textarea",
                placeholder="例: 03-0000-0000 / 担当: 山田",
            ),
        ]
    )

    msg = "不足情報を入力してください。"
    return AnalyzeResponse(msg=msg, form=form, extracted=extracted)


@app.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest) -> GenerateResponse:
    html = build_manual_html(request.answers, request.extracted)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        page = await browser.new_page()
        await page.set_content(html, wait_until="networkidle")
        pdf_bytes = await page.pdf(
            format="A4",
            print_background=True,
            margin={"top": "18mm", "bottom": "18mm", "left": "14mm", "right": "14mm"},
        )
        await browser.close()
    encoded = base64.b64encode(pdf_bytes).decode("ascii")
    return GenerateResponse(filename="manual.pdf", pdf_base64=encoded)
