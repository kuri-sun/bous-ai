import json
import urllib.parse
import urllib.request
from typing import Any

from app.core.config import get_settings

PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place"


def _fetch_json(url: str) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=10) as response:
        data = response.read()
    return json.loads(data.decode("utf-8"))


def autocomplete_places(
    input_text: str, country: str = "jp", language: str = "ja"
) -> list[dict[str, Any]]:
    settings = get_settings()
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")

    params = {
        "input": input_text,
        "language": language,
        "components": f"country:{country}",
        "types": "geocode",
        "key": settings.google_api_key,
    }
    url = f"{PLACES_API_BASE}/autocomplete/json?{urllib.parse.urlencode(params)}"
    data = _fetch_json(url)
    status = data.get("status")
    if status not in ("OK", "ZERO_RESULTS"):
        raise RuntimeError(data.get("error_message") or "Places autocomplete failed")

    predictions = data.get("predictions", [])
    return [
        {
            "place_id": item.get("place_id"),
            "description": item.get("description"),
            "main_text": (item.get("structured_formatting") or {}).get("main_text"),
            "secondary_text": (item.get("structured_formatting") or {}).get(
                "secondary_text"
            ),
        }
        for item in predictions
        if item.get("place_id") and item.get("description")
    ]


def _extract_component(
    components: list[dict[str, Any]], target_type: str
) -> str | None:
    for component in components:
        types = component.get("types") or []
        if target_type in types:
            return component.get("long_name")
    return None


def get_place_details(place_id: str, language: str = "ja") -> dict[str, Any]:
    settings = get_settings()
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")

    fields = ",".join(
        [
            "place_id",
            "name",
            "formatted_address",
            "geometry",
            "types",
            "address_component",
        ]
    )
    params = {
        "place_id": place_id,
        "language": language,
        "fields": fields,
        "key": settings.google_api_key,
    }
    url = f"{PLACES_API_BASE}/details/json?{urllib.parse.urlencode(params)}"
    data = _fetch_json(url)
    status = data.get("status")
    if status != "OK":
        raise RuntimeError(data.get("error_message") or "Places detail failed")

    result = data.get("result") or {}
    components = result.get("address_components") or []
    prefecture = _extract_component(components, "administrative_area_level_1")
    city = _extract_component(components, "locality") or _extract_component(
        components, "administrative_area_level_2"
    )
    location = (result.get("geometry") or {}).get("location") or {}
    return {
        "place_id": result.get("place_id"),
        "name": result.get("name"),
        "formatted_address": result.get("formatted_address"),
        "prefecture": prefecture,
        "city": city,
        "lat": location.get("lat"),
        "lng": location.get("lng"),
        "types": result.get("types"),
        "address_components": components,
    }
