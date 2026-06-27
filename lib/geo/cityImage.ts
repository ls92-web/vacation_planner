// ===== City photos via our /api/geo/city-image proxy (Wikipedia upstream). =====
// Cached per (city, country) in memory + localStorage so a card never re-fetches.

import { cachedGeo } from "./cache";

const IMAGE_TTL = 30 * 24 * 60 * 60 * 1000; // a month — city photos are stable

export function loadCityImage(name: string, country = ""): Promise<string | null> {
  if (!name) return Promise.resolve(null);
  const key = `image:${name}:${country}`.toLowerCase();
  return cachedGeo(key, IMAGE_TTL, async () => {
    const params = new URLSearchParams({ name });
    if (country) params.set("country", country);
    const res = await fetch(`/api/geo/city-image?${params.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { image: string | null };
    return data.image ?? null;
  });
}
