import json
import re
from typing import Any, TypedDict

from fastapi import HTTPException
from langchain_core.messages import HumanMessage
from playwright.async_api import async_playwright

from app.services.llm import get_llm


class InputImage(TypedDict):
    description: str
    public_url: str
    gcs_uri: str | None
    filename: str | None
    content_type: str | None


class IllustrationPrompt(TypedDict):
    id: str
    prompt: str
    alt: str | None


class IllustrationImage(TypedDict):
    id: str
    prompt: str
    public_url: str
    gcs_uri: str | None
    content_type: str | None
    alt: str | None


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


def _build_markdown_prompt(
    memo: str,
    input_images: list[InputImage],
    manual_title: str,
    agentic_proposal: str | None = None,
) -> str:
    instructions = (
        "あなたは日本語の防災マニュアルを作成するアシスタントです。"
        "manual_titleがある場合は、必ずそのタイトルを見出しとして使用してください。"
        "メモと画像情報を参考に、PDF化に適したMarkdownを作成してください。"
        "入力画像は指定されたURLと説明を使ってMarkdownに差し込みます。"
        "input_imagesのpublic_urlはそれぞれ1回だけ使い、"
        "説明はaltとして反映してください。"
        "さらに、適切な箇所に追加すべきイラストのプレースホルダーを"
        "Markdown中に挿入し、そのイラスト生成用プロンプトも作成してください。"
        "出力は必ずJSONのみで次の形式にしてください:\n"
        '{"markdown": "...", "illustration_prompts": '
        '[{"id": "illust-1", "prompt": "...", "alt": "..."}]}\n'
        "illustration_promptsは2〜3件の配列で、idはMarkdown内の"
        "プレースホルダー ![ALT](illustration://ID) と一致させます。"
        "イラストのプロンプトは日本語で、"
        "日本のマンション居住者が理解しやすい表現にしてください。"
        "各プロンプトに"
        "「イラスト内に文字は含めない（文字禁止）」を必ず含めてください。"
        "Markdownには見出しと段落を使い、長文は適度に分割してください。"
        "追加で反映すべき提案がある場合は、それも必ず盛り込んでください。"
        "本文には提案・改善案・追加提案などの文言を入れず、"
        "純粋なマニュアル本文だけにしてください。"
        "余計な説明やコードフェンスは不要です。\n\n"
    )
    payload = {
        "manual_title": manual_title,
        "memo": memo,
        "input_images": input_images,
        "agentic_proposal": agentic_proposal,
    }
    return (
        instructions
        + f"INPUT(JSON):\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def _build_html_prompt(
    markdown: str,
    input_images: list[InputImage],
    illustration_images: list[IllustrationImage],
    agentic_proposal: str | None = None,
) -> str:
    instructions = (
        "あなたは日本語の防災マニュアルをHTML化するアシスタントです。"
        "Markdownを読み、A4向けの完成HTML(<!doctype html>から</html>まで)"
        "のみを返してください。"
        "illustration://ID のプレースホルダーは、対応するURLに置換して"
        "画像として差し込んでください。"
        "input_imagesのpublic_urlはすべてHTMLに反映し、"
        '画像は<div class="image-block">で囲み、'
        '<img class="manual-image">で出力してください。'
        "画像にstyle属性は付けないでください。"
        "画像には枠線やボーダーを付けないでください。"
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
        ".manual-image { width: 100%; max-width: 160mm; max-height: 90mm; "
        "height: auto; object-fit: contain; border: none; }"
        ".image-block img { max-width: 160mm !important; "
        "max-height: 90mm !important; }"
        ".image-block { margin: 6mm 0; display: flex; "
        "justify-content: center; }"
        "大きな表やリストは複数のsectionに分割して下さい。"
        "余計な説明やコードフェンスは不要です。\n\n"
    )
    payload = {
        "markdown": markdown,
        "input_images": input_images,
        "illustration_images": illustration_images,
        "agentic_proposal": agentic_proposal,
    }
    return (
        instructions
        + f"INPUT(JSON):\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def _strip_html_to_text(html: str) -> str:
    # Remove style/script tags and their content
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.DOTALL)
    # Replace tags with spaces
    text = re.sub(r"<[^>]+>", " ", html)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _ensure_input_images_in_markdown(
    markdown: str, input_images: list[InputImage]
) -> str:
    if not input_images:
        return markdown
    missing = [img for img in input_images if img["public_url"] not in markdown]
    if not missing:
        return markdown
    lines = [
        markdown.rstrip(),
        "",
        "## 参考画像",
    ]
    for img in missing:
        alt = img.get("description") or "参考画像"
        lines.append(f"![{alt}]({img['public_url']})")
    lines.append("")
    return "\n".join(lines)


def generate_markdown_with_prompts(
    memo: str,
    input_images: list[InputImage],
    manual_title: str,
    agentic_proposal: str | None = None,
) -> tuple[str, list[IllustrationPrompt]]:
    llm = get_llm()
    prompt = _build_markdown_prompt(
        memo,
        input_images,
        manual_title,
        agentic_proposal,
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    payload = _parse_json_response(response.content or "")
    if not payload:
        raise HTTPException(status_code=500, detail="Markdown generation failed")

    markdown = payload.get("markdown")
    if not isinstance(markdown, str) or not markdown.strip():
        raise HTTPException(status_code=500, detail="Markdown is missing")

    raw_prompts = payload.get("illustration_prompts")
    prompts: list[IllustrationPrompt] = []
    if isinstance(raw_prompts, list):
        for index, item in enumerate(raw_prompts, start=1):
            if not isinstance(item, dict):
                continue
            prompt_text = item.get("prompt")
            if not isinstance(prompt_text, str) or not prompt_text.strip():
                continue
            prompt_id = item.get("id")
            if not isinstance(prompt_id, str) or not prompt_id.strip():
                prompt_id = f"illust-{index}"
            alt_text = item.get("alt")
            prompts.append(
                {
                    "id": prompt_id.strip(),
                    "prompt": prompt_text.strip(),
                    "alt": alt_text.strip() if isinstance(alt_text, str) else None,
                }
            )

    markdown = _ensure_input_images_in_markdown(markdown.strip(), input_images)
    return markdown, prompts


def generate_manual_html_from_markdown(
    markdown: str,
    input_images: list[InputImage],
    illustration_images: list[IllustrationImage],
    agentic_proposal: str | None = None,
) -> tuple[str, str]:
    llm = get_llm()
    prompt = _build_html_prompt(
        markdown, input_images, illustration_images, agentic_proposal
    )
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
