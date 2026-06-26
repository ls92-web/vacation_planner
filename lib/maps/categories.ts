import type { MarkerKind, PlaceCategory } from "./types";

// ===== Category → Google Places types, and marker visual styling. =====

export const PLACE_CATEGORIES: PlaceCategory[] = [
  "Attractions",
  "Restaurants",
  "Cafés",
  "Museums",
  "Parks",
  "Shopping",
  "Entertainment",
];

/** Maps a user-facing category to Google Places (New) `includedTypes`. */
export const CATEGORY_TYPES: Record<PlaceCategory, string[]> = {
  Attractions: ["tourist_attraction"],
  Restaurants: ["restaurant"],
  Cafés: ["cafe"],
  Museums: ["museum"],
  Parks: ["park"],
  Shopping: ["shopping_mall", "store"],
  Entertainment: ["amusement_park", "movie_theater", "night_club"],
};

/** Marker palette per kind — uses the theme accent/coral where possible. */
export interface MarkerStyle {
  bg: string;
  ring: string;
  glyph: "destination" | "hotel" | "attraction" | "restaurant";
}

export const MARKER_STYLES: Record<MarkerKind, MarkerStyle> = {
  destination: { bg: "var(--accent)", ring: "#ffffff", glyph: "destination" },
  hotel: { bg: "#3f5e8a", ring: "#ffffff", glyph: "hotel" },
  attraction: { bg: "var(--accent)", ring: "#ffffff", glyph: "attraction" },
  restaurant: { bg: "var(--accent2)", ring: "#ffffff", glyph: "restaurant" },
  active: { bg: "var(--ink)", ring: "var(--accent)", glyph: "destination" },
};

/** Best-effort mapping from a Google place primary type to a marker kind. */
export function kindForType(types: string[] | undefined): MarkerKind {
  if (!types) return "attraction";
  if (types.includes("restaurant") || types.includes("cafe") || types.includes("bar")) return "restaurant";
  if (types.includes("lodging") || types.includes("hotel")) return "hotel";
  return "attraction";
}
