// Public surface of the Google Maps module.
export { mapsConfig, isMapsConfigured, MAPS_LIBRARIES } from "./config";
export { PLACE_CATEGORIES, CATEGORY_TYPES, MARKER_STYLES, kindForType } from "./categories";
export { cached, clearMapCache, TTL } from "./cache";
export { fetchRoute, formatDistance, formatDuration } from "./routes-client";
export { usePlacesSearch, useGeocode, useAutocomplete, type AutocompleteSuggestion } from "./hooks";
export {
  PLACE_COORDS,
  STOP_COORDS,
  DESTINATION_COORDS,
  placeCoords,
  stopCoords,
  destinationCoords,
} from "./coords";
export type {
  LatLng,
  MarkerKind,
  MapMarker,
  PlaceResult,
  RouteResult,
  TravelMode,
  PlaceCategory,
} from "./types";
