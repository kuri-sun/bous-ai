from fastapi import APIRouter, HTTPException, Query

from app.schemas.place import PlaceAutocompleteResponse, PlaceDetailResponse
from app.services.places import autocomplete_places, get_place_details

router = APIRouter()


@router.get("/places/autocomplete", response_model=PlaceAutocompleteResponse)
def places_autocomplete(
    input: str = Query(..., min_length=1),
    country: str = Query("jp"),
) -> PlaceAutocompleteResponse:
    trimmed = input.strip()
    if not trimmed:
        raise HTTPException(status_code=400, detail="input is required")
    try:
        predictions = autocomplete_places(trimmed, country=country)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return PlaceAutocompleteResponse(predictions=predictions)


@router.get("/places/details", response_model=PlaceDetailResponse)
def places_details(place_id: str = Query(..., min_length=1)) -> PlaceDetailResponse:
    trimmed = place_id.strip()
    if not trimmed:
        raise HTTPException(status_code=400, detail="place_id is required")
    try:
        place = get_place_details(trimmed)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return PlaceDetailResponse(place=place)
