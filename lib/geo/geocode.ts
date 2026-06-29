// ===== Geocode a manually-typed city via the geo-geocode edge function (cached). =====

import { cachedGeo, GEO_TTL } from "./cache";
import { callFn } from "@/lib/edge";

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
    const data = await callFn<{ result: GeocodeResult | null }>("geo-geocode", { name, country, code });
    return data?.result ?? null;
  });
}
