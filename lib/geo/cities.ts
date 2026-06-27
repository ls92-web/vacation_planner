// ===== Cities via our /api/geo/cities proxy (GeoNames, with Open-Meteo fallback). =====
// Results are cached per (country, query) so repeated searches don't re-hit the API.

import { cachedGeo, GEO_TTL } from "./cache";
import type { GeoCity } from "./types";

export interface CitiesResult {
  cities: GeoCity[];
  source: "geonames" | "open-meteo" | "none";
}

export function loadCities(countryCode: string, query = ""): Promise<CitiesResult> {
  const q = query.trim();
  const key = `cities:${countryCode}:${q.toLowerCase()}`;
  return cachedGeo(key, GEO_TTL.cities, async () => {
    const params = new URLSearchParams({ country: countryCode });
    if (q) params.set("q", q);
    const res = await fetch(`/api/geo/cities?${params.toString()}`);
    if (!res.ok) throw new Error(`Cities request failed (${res.status})`);
    return (await res.json()) as CitiesResult;
  });
}
