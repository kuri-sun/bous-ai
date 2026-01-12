import json
from typing import Any

from fastapi import HTTPException
from langchain_core.messages import HumanMessage
from playwright.async_api import async_playwright

from app.services.llm import get_llm


def _build_manual_prompt(
    answers: dict[str, Any], extracted: dict[str, Any] | None = None
) -> str:
    payload = {"answers": answers, "extracted": extracted or {}}
    instructions = (
        "あなたは日本語の防災マニュアルを作成するアシスタントです。"
        "以下の情報から、A4向けの完成HTML(<!doctype html>から</html>まで)"
        "のみを返してください。"
        "answersにagentic_proposalが含まれている場合は、"
        "その提案を必ず反映してマニュアルを改善してください。"
        "CSSは<head>内の<style>に含め、読みやすい構成にしてください。"
        "ページ分割が崩れないよう、A4印刷時の高さに合わせて"
        "各セクションの高さ・余白を調整し、"
        "長い文章は段落で分割して"
        "適切に改ページ(page-break)されるようにしてください。"
        "見出し直後の改ページや、段落の途中での改ページは避けてください。"
        "必ず以下のCSSルールを含めてください:"
        "@page { size: A4; margin: 18mm 14mm; }"
        "h1, h2, h3 { page-break-after: avoid; break-after: avoid; }"
        "p, li, table, section { page-break-inside: avoid; break-inside: avoid; }"
        "section { margin-bottom: 12mm; }"
        "大きな表やリストは複数のsectionに分割して下さい。"
        "余計な説明やコードフェンスは不要です。\n\n"
    )
    return instructions + (
        f"INPUT(JSON):\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def _strip_html_to_text(html: str) -> str:
    import re

    # Remove style/script tags and their content
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.DOTALL)
    # Replace tags with spaces
    text = re.sub(r"<[^>]+>", " ", html)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def generate_manual_html(
    answers: dict[str, Any], extracted: dict[str, Any] | None = None
) -> tuple[str, str]:
    llm = get_llm()
    prompt = _build_manual_prompt(answers, extracted)
    response = llm.invoke([HumanMessage(content=prompt)])
    html = (response.content or "").strip()
    if not html:
        raise HTTPException(status_code=500, detail="HTML generation failed")
    plain = _strip_html_to_text(html)
    return html, plain


async def generate_manual_pdf(html: str) -> bytes:
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
    return pdf_bytes
