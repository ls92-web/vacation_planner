// ===== Countries via the geo-countries edge function (world-countries dataset). =====
// Fetched once and cached for a week, then filtered client-side for instant
// autocomplete — no countries are stored in our DB.

import { cachedGeo, GEO_TTL } from "./cache";
import { callFn } from "@/lib/edge";
import type { GeoCountry } from "./types";

export function loadCountries(): Promise<GeoCountry[]> {
  return cachedGeo("countries:all", GEO_TTL.countries, async () => {
    const data = await callFn<{ countries: GeoCountry[] }>("geo-countries");
    if (!data?.countries?.length) throw new Error("No countries returned");
    return data.countries;
  });
}

/** Case-insensitive prefix/substring match on name or exact code. */
export function searchCountries(list: GeoCountry[], query: string, limit = 8): GeoCountry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: GeoCountry[] = [];
  const contains: GeoCountry[] = [];
  for (const c of list) {
    const name = c.name.toLowerCase();
    if (name.startsWith(q) || c.code.toLowerCase() === q) starts.push(c);
    else if (name.includes(q)) contains.push(c);
  }
  return [...starts, ...contains].slice(0, limit);
}
