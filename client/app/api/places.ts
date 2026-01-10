import { API_BASE } from "../constants";
import type { PlaceDetail, PlacePrediction } from "../types/place";

type PlaceAutocompleteResponse = {
  predictions: PlacePrediction[];
};

type PlaceDetailResponse = {
  place: PlaceDetail;
};

export const fetchPlaceAutocomplete = async (
  input: string,
  signal?: AbortSignal,
) => {
  const response = await fetch(
    `${API_BASE}/api/places/autocomplete?input=${encodeURIComponent(input)}`,
    { signal },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "場所検索に失敗しました。");
  }
  const data = (await response.json()) as PlaceAutocompleteResponse;
  return data.predictions;
};

export const fetchPlaceDetails = async (placeId: string) => {
  const response = await fetch(
    `${API_BASE}/api/places/details?place_id=${encodeURIComponent(placeId)}`,
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "場所の詳細取得に失敗しました。");
  }
  const data = (await response.json()) as PlaceDetailResponse;
  return data.place;
};
