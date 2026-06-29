// ===== City photos via the geo-city-image edge function (Wikipedia upstream). =====
// Cached per (city, country) in memory + localStorage so a card never re-fetches.

import { cachedGeo } from "./cache";
import { callFn } from "@/lib/edge";

const IMAGE_TTL = 30 * 24 * 60 * 60 * 1000; // a month — city photos are stable

export function loadCityImage(name: string, country = ""): Promise<string | null> {
  if (!name) return Promise.resolve(null);
  const key = `image:${name}:${country}`.toLowerCase();
  return cachedGeo(key, IMAGE_TTL, async () => {
    const data = await callFn<{ image: string | null }>("geo-city-image", { name, country });
    return data?.image ?? null;
  });
}
