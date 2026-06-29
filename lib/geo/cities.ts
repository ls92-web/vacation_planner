// ===== Cities via the geo-cities edge function (GeoNames, with Open-Meteo fallback). =====
// Results are cached per (country, query) so repeated searches don't re-hit the API.

import { cachedGeo, GEO_TTL } from "./cache";
import { callFn } from "@/lib/edge";
import type { GeoCity } from "./types";

export interface CitiesResult {
  cities: GeoCity[];
  source: "geonames" | "open-meteo" | "none";
}

export function loadCities(countryCode: string, query = ""): Promise<CitiesResult> {
  const q = query.trim();
  const key = `cities:${countryCode}:${q.toLowerCase()}`;
  return cachedGeo(key, GEO_TTL.cities, async () => {
    const data = await callFn<CitiesResult>("geo-cities", { country: countryCode, q });
    if (!data) throw new Error("Cities request failed");
    return data;
  });
}
