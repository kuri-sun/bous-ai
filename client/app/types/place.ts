export type PlacePrediction = {
  place_id: string;
  description: string;
  main_text?: string;
  secondary_text?: string;
};

export type PlaceDetail = {
  place_id: string;
  name: string;
  formatted_address?: string;
  prefecture?: string;
  city?: string;
  lat?: number;
  lng?: number;
  types?: string[];
  address_components?: Record<string, unknown>[];
};
