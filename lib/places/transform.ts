import type { LatLng } from "@/lib/maps";
import { INDOOR_TYPES, type CategoryDef } from "./categories";
import type { ExplorePlace, Slot } from "./types";

// ===== Straight-line distance (no Directions/Routes API). =====
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatKm(km: number, units: "km" | "mi" = "km"): string {
  if (units === "mi") return `${(km * 0.621).toFixed(1)} mi`;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function formatDurationMin(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h} hr`;
}

const PRICE_MAP: Record<string, number> = {
  // REST enum
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
  // JS enum string values
  FREE: 0,
  INEXPENSIVE: 1,
  MODERATE: 2,
  EXPENSIVE: 3,
  VERY_EXPENSIVE: 4,
};

/** Compute open-now locally from regularOpeningHours periods (no extra API call). */
function computeOpenNow(hours: google.maps.places.OpeningHours | null | undefined): boolean | undefined {
  if (!hours || !hours.periods || !hours.periods.length) return undefined;
  const now = new Date();
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (const p of hours.periods) {
    const o = p.open;
    if (!o) continue;
    if (o.day !== day) continue;
    const start = o.hour * 60 + o.minute;
    const c = p.close;
    const end = c ? c.hour * 60 + c.minute : 24 * 60;
    if (minutes >= start && minutes <= end) return true;
  }
  return false;
}

function deriveTags(category: CategoryDef, types: string[], rating: number | undefined, reviews: number | undefined): string[] {
  const tags = new Set<string>();
  if (category.tag) tags.add(category.tag);
  if (types.some((t) => ["zoo", "aquarium", "amusement_park", "playground"].includes(t))) tags.add("Family Friendly");
  if (types.includes("restaurant") || types.includes("cafe")) tags.add("Foodie");
  if (rating != null && rating >= 4.6) tags.add("Must Visit");
  if (rating != null && rating >= 4.4 && (reviews ?? 0) >= 600) tags.add("Local Favorite");
  if (rating != null && rating >= 4.4 && (reviews ?? 0) > 0 && (reviews ?? 0) < 300) tags.add("Hidden Gem");
  return Array.from(tags).slice(0, 4);
}

/** Map a Google Places (New) Place into the app's ExplorePlace. */
export function fromGooglePlace(place: google.maps.places.Place, category: CategoryDef): ExplorePlace | null {
  const loc = place.location;
  if (!loc) return null;
  const position: LatLng = { lat: loc.lat(), lng: loc.lng() };
  const types = place.types ?? [];
  const rating = place.rating ?? undefined;
  const reviews = place.userRatingCount ?? undefined;
  const priceLevel = place.priceLevel != null ? PRICE_MAP[String(place.priceLevel)] : undefined;
  const indoor = types.some((t) => INDOOR_TYPES.has(t));
  const summary = place.editorialSummary as unknown;
  let description: string | undefined;
  if (typeof summary === "string") description = summary;
  else if (summary && typeof summary === "object" && "text" in summary) {
    const t = (summary as { text?: string }).text;
    description = t || undefined;
  }
  let photoUrl: string | undefined;
  try {
    photoUrl = place.photos?.[0]?.getURI({ maxWidth: 800 });
  } catch {
    photoUrl = undefined;
  }

  return {
    id: place.id,
    name: place.displayName ?? "Place",
    category: category.key,
    position,
    rating,
    reviews,
    priceLevel,
    openNow: computeOpenNow(place.regularOpeningHours),
    photoUrl,
    address: place.formattedAddress ?? undefined,
    description,
    tags: deriveTags(category, types, rating, reviews),
    estDurationMin: category.durationMin,
    recommendedSlot: category.slot,
    wheelchair: place.accessibilityOptions?.hasWheelchairAccessibleEntrance ?? undefined,
    indoor,
    free: priceLevel === 0 ? true : priceLevel != null ? false : undefined,
    googleTypes: types,
    source: "google",
  };
}

/** Category-specific heuristic refinement (we re-rank/label real places, never invent them). */
export function refinePlaces(places: ExplorePlace[], refine: CategoryDef["refine"]): ExplorePlace[] {
  if (!refine) return places;
  switch (refine) {
    case "hiddenGem":
      return places
        .filter((p) => (p.rating ?? 0) >= 4.3 && (p.reviews ?? 0) < 1500)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "localFavorite":
      return places
        .filter((p) => (p.rating ?? 0) >= 4.4)
        .sort((a, b) => (b.reviews ?? 0) - (a.reviews ?? 0));
    case "free":
      return places.map((p) => ({ ...p, free: p.free ?? true, tags: Array.from(new Set([...p.tags, "Free"])) }));
    case "indoor":
    case "rainy":
      return places.map((p) => ({ ...p, indoor: true }));
    default:
      return places;
  }
}

const RECOMMENDED_TIME: Record<Slot, string> = {
  morning: "Best in the morning",
  afternoon: "Best in the afternoon",
  evening: "Best in the evening",
};
export const recommendedTimeLabel = (slot: Slot) => RECOMMENDED_TIME[slot];
