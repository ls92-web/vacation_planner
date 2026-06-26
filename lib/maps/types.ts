// ===== Map domain types (provider-agnostic shapes the UI works with). =====

export interface LatLng {
  lat: number;
  lng: number;
}

export type MarkerKind = "destination" | "hotel" | "attraction" | "restaurant" | "active";

/** A point rendered on the map. */
export interface MapMarker {
  id: string;
  name: string;
  kind: MarkerKind;
  position: LatLng;
  category?: string;
  rating?: number;
  subtitle?: string;
}

/** A place returned from a Places search. */
export interface PlaceResult {
  id: string;
  name: string;
  position: LatLng;
  category: string;
  rating?: number;
  address?: string;
  openNow?: boolean;
  priceLevel?: number;
}

/** Result of a Routes API computation. */
export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  /** Encoded polyline for drawing on the map. */
  polyline: string;
}

export type TravelMode = "DRIVE" | "WALK" | "BICYCLE" | "TRANSIT";

export type PlaceCategory =
  | "Attractions"
  | "Restaurants"
  | "Cafés"
  | "Museums"
  | "Parks"
  | "Shopping"
  | "Entertainment";
