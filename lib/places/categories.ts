import type { Slot } from "./types";

// ===== The 21 browse categories, mapped onto real Google Places. =====
// Google has no "Hidden Gem" / "Local Favorite" type, so those use real place
// types plus a heuristic post-filter/tag — we never invent places, only label them.

export interface CategoryDef {
  key: string;
  label: string;
  /** Google Places (New) includedTypes for searchNearby. */
  includedTypes: string[];
  /** Default estimated visit duration (minutes) for places in this category. */
  durationMin: number;
  /** Default recommended time-of-day. */
  slot: Slot;
  /** A tag every place in this category receives. */
  tag?: string;
  /** Heuristic refinement applied after fetch (e.g. hidden gems = fewer reviews). */
  refine?: "hiddenGem" | "localFavorite" | "free" | "indoor" | "rainy";
}

export const CATEGORIES: CategoryDef[] = [
  { key: "top", label: "Top Attractions", includedTypes: ["tourist_attraction"], durationMin: 90, slot: "morning", tag: "Must Visit" },
  { key: "hidden", label: "Hidden Gems", includedTypes: ["tourist_attraction", "point_of_interest"], durationMin: 60, slot: "afternoon", tag: "Hidden Gem", refine: "hiddenGem" },
  { key: "restaurants", label: "Restaurants", includedTypes: ["restaurant"], durationMin: 90, slot: "evening", tag: "Foodie" },
  { key: "cafes", label: "Cafés", includedTypes: ["cafe", "coffee_shop"], durationMin: 45, slot: "afternoon", tag: "Foodie" },
  { key: "breakfast", label: "Breakfast", includedTypes: ["breakfast_restaurant", "brunch_restaurant", "cafe"], durationMin: 60, slot: "morning", tag: "Foodie" },
  { key: "museums", label: "Museums", includedTypes: ["museum"], durationMin: 120, slot: "morning", tag: "Historic", refine: "indoor" },
  { key: "parks", label: "Parks & Gardens", includedTypes: ["park", "garden"], durationMin: 90, slot: "afternoon", tag: "Photo Spot" },
  { key: "beaches", label: "Beaches", includedTypes: ["beach"], durationMin: 120, slot: "afternoon", tag: "Great for Sunset" },
  { key: "shopping", label: "Shopping", includedTypes: ["shopping_mall", "department_store", "market"], durationMin: 90, slot: "afternoon", tag: "Shopping" },
  { key: "family", label: "Family Friendly", includedTypes: ["tourist_attraction", "zoo", "aquarium"], durationMin: 120, slot: "morning", tag: "Family Friendly" },
  { key: "kids", label: "Kids Activities", includedTypes: ["amusement_park", "zoo", "aquarium", "playground"], durationMin: 150, slot: "morning", tag: "Family Friendly" },
  { key: "nightlife", label: "Nightlife", includedTypes: ["bar", "night_club"], durationMin: 120, slot: "evening", tag: "Local Favorite" },
  { key: "viewpoints", label: "Scenic Viewpoints", includedTypes: ["tourist_attraction"], durationMin: 45, slot: "evening", tag: "Great for Sunset", refine: "free" },
  { key: "historical", label: "Historical Sites", includedTypes: ["historical_landmark", "tourist_attraction"], durationMin: 75, slot: "morning", tag: "Historic" },
  { key: "architecture", label: "Architecture", includedTypes: ["tourist_attraction", "church", "historical_landmark"], durationMin: 75, slot: "morning", tag: "Photo Spot" },
  { key: "free", label: "Free Activities", includedTypes: ["park", "tourist_attraction"], durationMin: 60, slot: "afternoon", tag: "Free", refine: "free" },
  { key: "indoor", label: "Indoor Activities", includedTypes: ["museum", "aquarium", "shopping_mall"], durationMin: 120, slot: "afternoon", tag: "Rainy Day", refine: "indoor" },
  { key: "rainy", label: "Rainy Day Options", includedTypes: ["museum", "aquarium", "shopping_mall", "movie_theater"], durationMin: 120, slot: "afternoon", tag: "Rainy Day", refine: "rainy" },
  { key: "adventure", label: "Adventure", includedTypes: ["amusement_park", "tourist_attraction"], durationMin: 150, slot: "morning", tag: "Must Visit" },
  { key: "nature", label: "Nature", includedTypes: ["park", "national_park", "garden"], durationMin: 120, slot: "afternoon", tag: "Photo Spot" },
  { key: "local", label: "Local Favorites", includedTypes: ["restaurant", "tourist_attraction"], durationMin: 90, slot: "afternoon", tag: "Local Favorite", refine: "localFavorite" },
];

export const DEFAULT_CATEGORY = "top";

export function categoryByKey(key: string): CategoryDef {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
}

// Place types that read as "indoor".
export const INDOOR_TYPES = new Set([
  "museum",
  "aquarium",
  "shopping_mall",
  "department_store",
  "movie_theater",
  "art_gallery",
  "restaurant",
  "cafe",
  "bar",
  "night_club",
]);
