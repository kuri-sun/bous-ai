from typing import Any

from pydantic import BaseModel

from app.schemas.session import SessionDetail


class FormField(BaseModel):
    id: str
    label: str
    field_type: str
    required: bool = True
    placeholder: str | None = None
    options: list[str] | None = None


class FormSchema(BaseModel):
    fields: list[FormField]


class AnalyzeResponse(BaseModel):
    msg: str
    form: FormSchema
    extracted: dict[str, Any] | None = None
    session_id: str | None = None

    @classmethod
    def default_form(cls, extracted: dict[str, Any] | None = None) -> "AnalyzeResponse":
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
    session_id: str | None = None
    extracted: dict[str, Any] | None = None
    answers: dict[str, Any]
    source_meta: dict[str, Any] | None = None


class GenerateResponse(BaseModel):
    session: SessionDetail | None = None
