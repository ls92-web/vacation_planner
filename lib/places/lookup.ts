"use client";

import { mapsConfig } from "@/lib/maps";
import type { LatLng } from "@/lib/maps";
import type { ExplorePlace } from "./types";

// ===== Imperative Google Places lookup for the AI workspace. =====
// The conversational schedule pipeline emits place *names*; this attaches real
// Google Places data (id, address, coords, photo, rating, hours) so added stops
// and saved suggestions carry the same quality as a browsed place — with a
// graceful null fallback whenever Places is unavailable or finds nothing.

const FIELDS = [
  "id",
  "displayName",
  "location",
  "rating",
  "userRatingCount",
  "priceLevel",
  "regularOpeningHours",
  "photos",
  "formattedAddress",
  "editorialSummary",
  "types",
  "accessibilityOptions",
];

type PlacesLib = google.maps.PlacesLibrary;

let libPromise: Promise<PlacesLib | null> | null = null;

/**
 * Resolve the Places library imperatively (outside React). Relies on the Maps JS
 * loader that <MapsApiProvider> installs (`google.maps.importLibrary`). Returns
 * null when no key is configured or the loader isn't present yet — callers fall back.
 */
function ensurePlacesLib(): Promise<PlacesLib | null> {
  if (libPromise) return libPromise;
  libPromise = (async () => {
    try {
      if (!mapsConfig.apiKey) return null;
      const g = (globalThis as { google?: typeof google }).google;
      if (!g?.maps?.importLibrary) return null;
      return (await g.maps.importLibrary("places")) as PlacesLib;
    } catch {
      libPromise = null; // allow a later retry once the loader is ready
      return null;
    }
  })();
  return libPromise;
}

const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
  FREE: 0, INEXPENSIVE: 1, MODERATE: 2, EXPENSIVE: 3, VERY_EXPENSIVE: 4,
};

/** Today's opening-hours line (e.g. "9:00 AM – 6:00 PM"), if the SDK provides it. */
function todaysHours(hours: google.maps.places.OpeningHours | null | undefined): string | undefined {
  const desc = hours?.weekdayDescriptions;
  if (!desc || !desc.length) return undefined;
  const idx = (new Date().getDay() + 6) % 7; // SDK order is Monday-first
  const line = desc[idx];
  if (!line) return undefined;
  return line.replace(/^[^:]+:\s*/, "").trim() || undefined;
}

/** The real-place fields we overlay onto an AI-suggested stop (all optional). */
export type PlaceEnrichment = Pick<
  ExplorePlace,
  "id" | "name" | "position" | "rating" | "reviews" | "priceLevel" | "openNow" | "hours" | "photoUrl" | "address" | "description" | "googleTypes"
> & { source: "google" };

/**
 * Look up the single best real place for a free-text query (e.g. "Louvre, Paris"),
 * biased toward a city centre when known. Returns null on any failure so the
 * caller keeps its AI-provided fallback.
 */
export async function lookupPlace(query: string, bias?: LatLng | null): Promise<PlaceEnrichment | null> {
  const q = query.trim();
  if (!q) return null;
  const lib = await ensurePlacesLib();
  if (!lib) return null;
  try {
    const res = await lib.Place.searchByText({
      textQuery: q,
      fields: FIELDS,
      maxResultCount: 1,
      ...(bias && !(bias.lat === 0 && bias.lng === 0) ? { locationBias: { center: bias, radius: 25000 } } : {}),
    });
    const p = res.places?.[0];
    const loc = p?.location;
    if (!p || !loc) return null;

    let photoUrl: string | undefined;
    try { photoUrl = p.photos?.[0]?.getURI({ maxWidth: 800 }); } catch { photoUrl = undefined; }

    const summary = p.editorialSummary as unknown;
    let description: string | undefined;
    if (typeof summary === "string") description = summary || undefined;
    else if (summary && typeof summary === "object" && "text" in summary) description = (summary as { text?: string }).text || undefined;

    const priceLevel = p.priceLevel != null ? PRICE_MAP[String(p.priceLevel)] : undefined;
    let openNow: boolean | undefined;
    try { openNow = p.regularOpeningHours ? await p.isOpen() : undefined; } catch { openNow = undefined; }

    return {
      id: p.id,
      name: p.displayName ?? q,
      position: { lat: loc.lat(), lng: loc.lng() },
      rating: p.rating ?? undefined,
      reviews: p.userRatingCount ?? undefined,
      priceLevel,
      openNow,
      hours: todaysHours(p.regularOpeningHours),
      photoUrl,
      address: p.formattedAddress ?? undefined,
      description,
      googleTypes: p.types ?? undefined,
      source: "google",
    };
  } catch {
    return null;
  }
}
