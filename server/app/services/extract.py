import json
from typing import Any

from fastapi import HTTPException
from langchain_core.messages import HumanMessage

from app.schemas.manual import AnalyzeResponse, FormField, FormSchema
from app.services.llm import get_llm


def _build_extract_prompt(extracted: dict[str, Any]) -> str:
    instructions = (
        "あなたは日本語のマンション用の防災マニュアル作成のために"
        "不足情報を特定するアシスタントです。"
        "`memo`がある場合は、防災マニュアル作成のためのメモで、"
        "マニュアル作成のための有益な情報が含まれています。"
        "`text_extracted_from_uploaded_file`がある場合は、"
        "アップロードされたファイルをGoogle Visionが抽出したものになります。"
        "`description_for_uploaded_file`がある場合は、"
        "アップロードされたファイルの説明です。"
        "以下のJSONを読み、いざという時に使える有益なマンション用の"
        "防災マニュアル作成にあたって、まだ不足している情報を"
        "JSONで返してください。"
        '必ず次の形式のみを返します: {"msg": "...", "form": {"fields": [...]}}。'
        "fieldsはid, label, field_type(text|textarea|select), required, "
        "placeholder, optionsを含めます。"
        "余計な説明やコードフェンスは不要です。\n\n"
    )
    return instructions + (
        f"INPUT(JSON):\n{json.dumps(extracted, ensure_ascii=False, indent=2)}"
    )


def _parse_form_payload(
    payload: dict[str, Any],
    extracted: dict[str, Any],
) -> AnalyzeResponse:
    if "msg" not in payload or "form" not in payload:
        raise ValueError("msg or form is missing")
    form = payload["form"]
    fields = form.get("fields")
    if not isinstance(fields, list):
        raise ValueError("fields must be a list")
    form_fields: list[FormField] = []
    for item in fields:
        if not isinstance(item, dict):
            continue
        form_fields.append(
            FormField(
                id=str(item.get("id", "")),
                label=str(item.get("label", "")),
                field_type=str(item.get("field_type", "text")),
                required=bool(item.get("required", True)),
                placeholder=item.get("placeholder"),
                options=item.get("options"),
            )
        )
    if not form_fields:
        raise ValueError("no valid fields")
    return AnalyzeResponse(
        msg=str(payload["msg"]),
        form=FormSchema(fields=form_fields),
        extracted=extracted,
    )


def build_extract_response(extracted: dict[str, Any]) -> AnalyzeResponse:
    llm = get_llm()
    prompt = _build_extract_prompt(extracted)
    response = llm.invoke([HumanMessage(content=prompt)])
    content = (response.content or "").strip()
    if not content:
        raise HTTPException(status_code=500, detail="Form generation failed")
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Invalid JSON from LLM") from exc
    try:
        return _parse_form_payload(payload, extracted)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
