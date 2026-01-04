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
        "CSSは<head>内の<style>に含め、読みやすい構成にしてください。"
        "余計な説明やコードフェンスは不要です。\n\n"
    )
    return instructions + (
        f"INPUT(JSON):\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def generate_manual_html(
    answers: dict[str, Any], extracted: dict[str, Any] | None = None
) -> str:
    llm = get_llm()
    prompt = _build_manual_prompt(answers, extracted)
    response = llm.invoke([HumanMessage(content=prompt)])
    html = (response.content or "").strip()
    if not html:
        raise HTTPException(status_code=500, detail="HTML generation failed")
    return html


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
