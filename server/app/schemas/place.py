from typing import Any

from pydantic import BaseModel


class PlaceAutocompleteItem(BaseModel):
    place_id: str
    description: str
    main_text: str | None = None
    secondary_text: str | None = None


class PlaceAutocompleteResponse(BaseModel):
    predictions: list[PlaceAutocompleteItem]


class PlaceDetail(BaseModel):
    place_id: str
    name: str
    formatted_address: str | None = None
    prefecture: str | None = None
    city: str | None = None
    lat: float | None = None
    lng: float | None = None
    types: list[str] | None = None
    address_components: list[dict[str, Any]] | None = None


class PlaceDetailResponse(BaseModel):
    place: PlaceDetail
