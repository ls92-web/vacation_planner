import type { LatLng } from "@/lib/maps";

export type Slot = "morning" | "afternoon" | "evening";
export const SLOTS: Slot[] = ["morning", "afternoon", "evening"];
export const SLOT_LABELS: Record<Slot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

/** A real place (Google Places) or curated fallback, in the app's normalized shape. */
export interface ExplorePlace {
  id: string;
  name: string;
  category: string; // the category key it was discovered under
  position: LatLng;
  rating?: number;
  reviews?: number;
  priceLevel?: number; // 0 (free) – 4 (very expensive)
  openNow?: boolean;
  photoUrl?: string;
  address?: string;
  description?: string;
  tags: string[];
  estDurationMin: number;
  recommendedSlot: Slot;
  wheelchair?: boolean;
  indoor?: boolean;
  free?: boolean;
  googleTypes?: string[];
  source: "google" | "curated";
}

export type FreeFilter = "any" | "free" | "paid";
export type EnvFilter = "any" | "indoor" | "outdoor";
export type DurationFilter = "any" | "short" | "half" | "full";

export interface ExploreFilters {
  minRating: number; // 0 = any
  maxPrice: number; // 4 = any
  openNow: boolean;
  family: boolean;
  wheelchair: boolean;
  free: FreeFilter;
  env: EnvFilter;
  duration: DurationFilter;
  maxDistanceKm: number; // 0 = any
}

export const DEFAULT_FILTERS: ExploreFilters = {
  minRating: 0,
  maxPrice: 4,
  openNow: false,
  family: false,
  wheelchair: false,
  free: "any",
  env: "any",
  duration: "any",
  maxDistanceKm: 0,
};

export interface ItineraryItem {
  place: ExplorePlace;
  day: number;
  slot: Slot;
  position: number;
  /** Optional per-stop visit-duration override (minutes); falls back to place.estDurationMin. */
  durationMin?: number;
}
