import base64
import os
from typing import Any, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fpdf import FPDF
from langchain_core.messages import AIMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
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


def safe_pdf_text(value: Any) -> str:
    return str(value).encode("ascii", "replace").decode("ascii")


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
    if file:
        extracted["filename"] = file.filename
        extracted["content_type"] = file.content_type

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
def generate(request: GenerateRequest) -> GenerateResponse:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=16)
    pdf.cell(0, 10, "Disaster Manual", ln=True)
    pdf.set_font("Helvetica", size=12)
    for key, value in request.answers.items():
        pdf.multi_cell(0, 8, f"{safe_pdf_text(key)}: {safe_pdf_text(value)}")
    pdf_bytes = pdf.output(dest="S").encode("latin-1")
    encoded = base64.b64encode(pdf_bytes).decode("ascii")
    return GenerateResponse(filename="manual.pdf", pdf_base64=encoded)
