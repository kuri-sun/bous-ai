import base64
from typing import Any, Optional

from pydantic import BaseModel


class FormField(BaseModel):
    id: str
    label: str
    field_type: str
    required: bool = True
    placeholder: Optional[str] = None
    options: Optional[list[str]] = None


class FormSchema(BaseModel):
    fields: list[FormField]


class AnalyzeResponse(BaseModel):
    msg: str
    form: FormSchema
    extracted: Optional[dict[str, Any]] = None

    @classmethod
    def default_form(cls, extracted: Optional[dict[str, Any]] = None) -> "AnalyzeResponse":
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
        return cls(msg="不足情報を入力してください。", form=form, extracted=extracted)


class GenerateRequest(BaseModel):
    extracted: Optional[dict[str, Any]] = None
    answers: dict[str, Any]
    source_meta: Optional[dict[str, Any]] = None


class GenerateResponse(BaseModel):
    filename: str
    pdf_base64: str

    @classmethod
    def from_pdf_bytes(cls, pdf_bytes: bytes) -> "GenerateResponse":
        encoded = base64.b64encode(pdf_bytes).decode("ascii")
        return cls(filename="manual.pdf", pdf_base64=encoded)
