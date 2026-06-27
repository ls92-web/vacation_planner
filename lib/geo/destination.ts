// ===== Canonical destination helpers — reusable across features. =====
// `SelectedDestination` (city + country + ISO code + lat/lng + optional image)
// is the single shape every downstream feature consumes: weather (toLatLng),
// attractions & hotels (coords + city/country), and itinerary generation
// (an ordered list of these). Keep validation here so every entry point
// (suggestions, popular, manual entry, persistence) enforces the same contract.

import type { SelectedDestination } from "./types";

/** Coordinates are usable: finite, in range, and not the (0,0) null-island sentinel. */
export function isValidCoords(lat?: number | null, lng?: number | null): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** Stable de-duplication key: a city is unique per (name, country). */
export function destinationKey(d: { cityName: string; countryCode: string }): string {
  return `${d.cityName.trim().toLowerCase()}|${d.countryCode.trim().toUpperCase()}`;
}

/** A destination is complete only with city, country, ISO code, and valid coords. */
export function isCompleteDestination(d: Partial<SelectedDestination> | null | undefined): d is SelectedDestination {
  return !!(d && d.cityName?.trim() && d.countryName?.trim() && d.countryCode?.trim() && isValidCoords(d.lat, d.lng));
}

/** Extract a {lat,lng} for map/weather/distance use. */
export function toLatLng(d: SelectedDestination): { lat: number; lng: number } {
  return { lat: d.lat, lng: d.lng };
}

let counter = 0;
export function newDestinationId(): string {
  counter += 1;
  return `dst_${Date.now().toString(36)}_${counter}`;
}

/** Build a validated SelectedDestination, or null if it is incomplete. */
export function makeDestination(parts: {
  cityName: string;
  countryName: string;
  countryCode: string;
  lat: number;
  lng: number;
  image?: string | null;
}): SelectedDestination | null {
  const d: SelectedDestination = {
    id: newDestinationId(),
    cityName: parts.cityName.trim(),
    countryName: parts.countryName.trim(),
    countryCode: parts.countryCode.trim().toUpperCase(),
    lat: parts.lat,
    lng: parts.lng,
    image: parts.image ?? null,
  };
  return isCompleteDestination(d) ? d : null;
}
