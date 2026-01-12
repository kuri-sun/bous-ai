import json
import re
from typing import Any

from langchain_core.messages import HumanMessage

from app.services.llm import get_llm

_ALLOWED_TURN_KINDS = {"question", "proposal"}


def _parse_json_response(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    if not cleaned:
        return None
    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def _coerce_turn(payload: dict[str, Any] | None) -> dict[str, str] | None:
    if not payload:
        return None
    kind = payload.get("kind")
    content = payload.get("content")
    if kind not in _ALLOWED_TURN_KINDS:
        return None
    if not isinstance(content, str) or not content.strip():
        return None
    return {"kind": kind, "content": content.strip()}


def _build_agentic_prompt(
    context: dict[str, Any], history: list[dict[str, str]]
) -> str:
    instructions = (
        "あなたはマンション用の防災マニュアルの改定を支援する対話型エージェントです。"
        "次のルールを厳守してください:"
        "1) 返答は1ターンのみで、質問か提案のどちらか一方。"
        "2) 会話開始時（履歴が空）は必ず質問で始める。"
        "   質問は具体的な不足情報を1〜3問だけ列挙する。"
        "3) 質問は広い問いではなく、避難経路の地名/ルート、連絡先の番号と役割、"
        "   備蓄品の種類と数量、要支援者サポート体制などの具体情報を尋ねる。"
        "4) ユーザーの直近の回答が曖昧・不足している場合は、追加の質問。"
        "   質問は1ターンに1〜3問まで列挙してよい。"
        "5) 情報が十分に揃ったと判断できるときだけ、具体的な改定提案を1つ提示。"
        "6) 提案は2〜4文の短い段落で、箇条書きは使わない。"
        "7) 余計な説明やメタ情報は不要。"
        "8) 以下のテキストを参考に、足りない箇所や改善が必要な箇所にフォーカスすること:"
        "   context.search_reference_text は公式マニュアル"
        "PDFのテキスト。"
        "   context.generated_plain_text は現在の生成マニュアルの"
        "本文。"
        "出力は必ずJSONのみで次の形式にしてください:\n"
        '{"kind": "question" | "proposal", "content": "..."}\n'
    )
    payload = {
        "context": context,
        "history": history,
    }
    return (
        instructions
        + f"INPUT(JSON):\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def build_agentic_turn(
    context: dict[str, Any], history: list[dict[str, str]]
) -> dict[str, str]:
    prompt = _build_agentic_prompt(context, history)
    try:
        llm = get_llm()
        response = llm.invoke([HumanMessage(content=prompt)])
        parsed = _parse_json_response(getattr(response, "content", ""))
        turn = _coerce_turn(parsed)
    except Exception:
        turn = None

    if turn:
        return turn

    return {
        "kind": "question",
        "content": (
            "防災マニュアルを改善するために、補足したい情報があれば教えてください。"
        ),
    }
