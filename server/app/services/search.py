import json
import urllib.parse
import urllib.request
from typing import Any

from app.core.config import get_settings
from app.services.ocr import detect_text_from_bytes
from app.services.storage import upload_bytes

SEARCH_API_URL = "https://www.googleapis.com/customsearch/v1"


def _fetch_json(url: str) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=10) as response:
        data = response.read()
    return json.loads(data.decode("utf-8"))


def _slugify_ascii(text: str | None) -> str | None:
    if not text:
        return None
    slug = "".join(ch.lower() for ch in text if ch.isascii() and ch.isalnum())
    return slug or None


def _score_item(
    item: dict[str, Any],
    keywords: list[str],
    city: str | None,
    city_slug: str | None,
    pref_slug: str | None,
) -> int:
    title = (item.get("title") or "").lower()
    snippet = (item.get("snippet") or "").lower()
    link = (item.get("link") or "").lower()
    text = " ".join([title, snippet, link])
    score = 0
    for keyword in keywords:
        if keyword and keyword.lower() in text:
            score += 5
    parsed = urllib.parse.urlparse(item.get("link") or "")
    host = (parsed.netloc or "").lower()
    path = (parsed.path or "").lower()
    if ".city." in host:
        score += 4
    if host.endswith(".lg.jp") or ".lg.jp" in host:
        score += 3
    if city and all(ord(c) < 128 for c in city):
        city_lower = city.lower()
        if city_lower in host or city_lower in path:
            score += 6
    if city_slug and city_slug in host:
        score += 6
    if pref_slug and pref_slug in host:
        score += 2
    if "マンション" in text:
        score += 3
    if "防災" in text:
        score += 2
    if "マニュアル" in text:
        score += 2
    if text.endswith(".pdf") or "filetype:pdf" in text:
        score += 1
    return score


def _build_query(
    city: str | None, prefecture: str | None, city_slug: str | None, pref_slug: str | None
) -> list[tuple[str, str]]:
    queries: list[tuple[str, str]] = []
    if city:
        queries.append(
            (
                "city",
                f"{city} マンション 防災マニュアル filetype:pdf",
            )
        )
        if city_slug and pref_slug:
            queries.append(
                (
                    "city",
                    (
                        f"{city} マンション 防災マニュアル "
                        f"site:{city_slug}.{pref_slug}.jp filetype:pdf"
                    ),
                )
            )
            queries.append(
                (
                    "city",
                    (
                        f"{city} マンション 防災マニュアル "
                        f"site:city.{city_slug}.{pref_slug}.jp filetype:pdf"
                    ),
                )
            )
    if prefecture:
        queries.append(
            (
                "prefecture",
                f"{prefecture} 防災マニュアル filetype:pdf",
            )
        )
    return queries


def _extract_slugs(
    city: str | None, prefecture: str | None, place: dict[str, Any] | None
) -> tuple[str | None, str | None]:
    city_slug = _slugify_ascii(city)
    pref_slug = _slugify_ascii(prefecture)
    components = place.get("address_components") if isinstance(place, dict) else None
    if components and isinstance(components, list):
        for comp in components:
            types = comp.get("types") or []
            short = comp.get("short_name") or ""
            if "administrative_area_level_2" in types and not city_slug:
                city_slug = _slugify_ascii(short)
            if "locality" in types and not city_slug:
                city_slug = _slugify_ascii(short)
            if "administrative_area_level_1" in types and not pref_slug:
                pref_slug = _slugify_ascii(short)
    return city_slug, pref_slug


def search_official_manual(
    city: str | None, prefecture: str | None, place: dict[str, Any] | None = None
) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")
    if not settings.google_search_cx:
        raise RuntimeError("GOOGLE_SEARCH_CX is not set")

    city_slug, pref_slug = _extract_slugs(city, prefecture, place)

    for scope, query in _build_query(city, prefecture, city_slug, pref_slug):
        params = {
            "key": settings.google_api_key,
            "cx": settings.google_search_cx,
            "q": query,
            "num": 3,
        }
        url = f"{SEARCH_API_URL}?{urllib.parse.urlencode(params)}"
        data = _fetch_json(url)
        if data.get("error"):
            raise RuntimeError(
                data["error"].get("message") or "Google search failed"
            )
        raw_items = data.get("items") or []
        if not raw_items:
            continue
        keywords: list[str] = []
        if scope == "city" and city:
            keywords.append(city)
        if prefecture:
            keywords.append(prefecture)
        items = sorted(
            raw_items,
            key=lambda item: _score_item(item, keywords, city, city_slug, pref_slug),
            reverse=True,
        )
        item = next((entry for entry in items if entry.get("link")), None)
        if not item:
            continue
        link = item.get("link") or ""
        title = item.get("title") or ""
        reference_text = None
        if link.endswith(".pdf") and settings.gcs_bucket:
            try:
                with urllib.request.urlopen(link, timeout=15) as response:
                    file_bytes = response.read()
                    content_type = (
                        response.headers.get_content_type() or "application/pdf"
                    )
                blob_name = (
                    f"search_cache/{scope}/{urllib.parse.quote_plus(query)}/manual.pdf"
                )
                gcs_uri = upload_bytes(
                    settings.gcs_bucket, blob_name, file_bytes, content_type
                )
                reference_text = detect_text_from_bytes(
                    file_bytes, blob_name, content_type, gcs_uri
                )
            except Exception:
                reference_text = None
        return {
            "query": query,
            "scope": scope,
            "result": {
                "title": title,
                "link": link,
                "snippet": item.get("snippet"),
            },
            "reference_text": reference_text,
        }
    return None
