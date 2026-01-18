import json

from fastapi import HTTPException
from langchain_core.messages import HumanMessage
from playwright.async_api import async_playwright

from app.schemas.manual import IllustrationImage, IllustrationPrompt, InputImage
from app.services.llm import get_llm
from app.utils.parsing import parse_json_response


def _build_markdown_prompt(
    memo: str,
    input_images: list[InputImage],
    manual_title: str,
    name: str,
    author: str,
    issued_on: str,
) -> str:
    instructions = (
        "あなたは日本語の防災マニュアルを作成するアシスタントです。"
        "必ず最初の1ページはマニュアルの表紙とし、以下のみを含めてください:"
        "1) マニュアルタイトル(manual_title)"
        "2) 名称"
        "3) 発行年月"
        "4) 発行者"
        "表紙はMarkdown上で専用のセクションとして作成し、"
        "タイトルは中央寄せ、発行年月と発行者はページ下部に配置してください。"
        "表紙タイトルは名称と「防災マニュアル」を改行して2行で表示し、"
        "名称が空の場合は「防災マニュアル」だけを1行で表示してください。"
        "表紙で１ページ目を使うので、の２ページ目からセクション１を開始してください。"
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
        "本文には提案・改善案・追加提案などの文言を入れず、"
        "純粋なマニュアル本文だけにしてください。"
        "余計な説明やコードフェンスは不要です。\n\n"
    )
    payload = {
        "manual_title": manual_title,
        "name": name,
        "author": author,
        "issued_on": issued_on,
        "memo": memo,
        "input_images": input_images,
    }
    return (
        instructions
        + f"INPUT(JSON):\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def _build_html_prompt(
    markdown: str,
    input_images: list[InputImage],
    illustration_images: list[IllustrationImage],
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
        '表紙は<section class="cover">で構成し、'
        "タイトルは中央寄せ、発行年月と発行者は下部に配置してください。"
        "表紙タイトルは名称と「防災マニュアル」を改行して2行で表示し、"
        "名称が空の場合は「防災マニュアル」だけを1行で表示してください。"
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
        ".cover { min-height: 240mm; display: flex; flex-direction: column; "
        "justify-content: space-between; margin-bottom: 0; "
        "page-break-after: always; }"
        ".cover-title { text-align: center; margin-top: 40mm; }"
        ".cover-meta { text-align: center; margin-bottom: 10mm; }"
        "大きな表やリストは複数のsectionに分割して下さい。"
        "余計な説明やコードフェンスは不要です。\n\n"
    )
    payload = {
        "markdown": markdown,
        "input_images": input_images,
        "illustration_images": illustration_images,
    }
    return (
        instructions
        + f"INPUT(JSON):\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def _build_agentic_html_prompt(
    previous_markdown: str,
    previous_html: str,
    proposal: str,
) -> str:
    instructions = (
        "あなたは、インプットされたほぼ完成された日本語の防災マニュアル(previous_html)を、最終調整するアシスタントです。"
        "提案内容(proposal)を反映してHTML(previous_html)を更新してください。"
        "previous_htmlの<head>とCSSは変更しないでください。"
        "previous_htmlのレイアウトと画像配置ルールは絶対変更しないでください。"
        "変更が必要な箇所以外は絶対変更しないでください。"
        "ページ分割には、絶対配慮してください。"
        "outputは完成HTML(<!doctype html>から</html>まで)のみ。"
        "outputにはバックスラッシュ(\\)やエスケープ文字列"
        '(\\n, \\t, \\"など)を含めないでください。'
        "余計な説明やコードフェンスは不要です。"
    )
    payload = {
        "proposal": proposal,
        "previous_markdown": previous_markdown,
        "previous_html": previous_html,
    }
    return (
        instructions
        + f"INPUT(JSON):\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


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
    name: str,
    author: str,
    issued_on: str,
) -> tuple[str, list[IllustrationPrompt]]:
    llm = get_llm()
    prompt = _build_markdown_prompt(
        memo,
        input_images,
        manual_title,
        name,
        author,
        issued_on,
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    payload = parse_json_response(response.content or "")
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
) -> tuple[str, str]:
    llm = get_llm()
    prompt = _build_html_prompt(markdown, input_images, illustration_images)
    response = llm.invoke([HumanMessage(content=prompt)])
    html = (response.content or "").strip()
    if not html:
        raise HTTPException(status_code=500, detail="HTML generation failed")
    return html, markdown


def generate_manual_html_with_proposal(
    previous_markdown: str,
    previous_html: str,
    proposal: str,
) -> tuple[str, str]:
    llm = get_llm()
    prompt = _build_agentic_html_prompt(
        previous_markdown,
        previous_html,
        proposal,
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    html = (response.content or "").strip()
    if not html:
        raise HTTPException(status_code=500, detail="HTML generation failed")
    return html, previous_markdown


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
