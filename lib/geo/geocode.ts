// ===== Geocode a manually-typed city via /api/geo/geocode (cached). =====

import { cachedGeo, GEO_TTL } from "./cache";

export interface GeocodeResult {
  name: string;
  countryName: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export function geocodeCity(name: string, country = "", code = ""): Promise<GeocodeResult | null> {
  const key = `geocode:${code}:${name}`.toLowerCase();
  return cachedGeo(key, GEO_TTL.cities, async () => {
    const params = new URLSearchParams({ name });
    if (country) params.set("country", country);
    if (code) params.set("code", code);
    const res = await fetch(`/api/geo/geocode?${params.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { result: GeocodeResult | null };
    return data.result;
  });
}
