// ===== Trip-aware place ranking + badges =====
// Pure, deterministic scoring of an explore place against this trip's preferences.
// Produces a match score (for "Recommended for this trip" ordering) and a few
// short badges that explain the fit on the card. No AI calls — instant + free.

import type { BudgetLevel } from "@/lib/budget/estimate";
import type { TripPreferences } from "@/lib/types";
import type { ExplorePlace } from "./types";

export interface PlaceBadge {
  label: string;
  kind: "good" | "warn" | "info";
}
export interface PlaceMatch {
  score: number;
  badges: PlaceBadge[];
  recommended: boolean;
}

// Which interest keys a place's discovery category satisfies.
const CATEGORY_INTERESTS: Record<string, string[]> = {
  top: ["attractions"], hidden: ["attractions", "local"], adventure: ["attractions", "themeparks"],
  museums: ["museums", "historical"], historical: ["historical"], architecture: ["historical", "photography"],
  parks: ["nature", "photography"], nature: ["nature"], beaches: ["beaches", "nature"],
  shopping: ["shopping"], restaurants: ["restaurants"], cafes: ["cafes"], breakfast: ["cafes", "restaurants"],
  family: ["kids"], kids: ["kids", "themeparks"], nightlife: [], viewpoints: ["photography", "attractions"],
  free: ["attractions"], indoor: ["museums"], rainy: ["museums"], local: ["local"], scenic: ["photography"],
};

const KID_CATEGORIES = new Set(["family", "kids", "parks", "beaches", "adventure"]);
const WALKING_CATEGORIES = new Set(["parks", "nature", "viewpoints", "beaches", "historical", "adventure", "architecture"]);

const PRIORITY: Record<PlaceBadge["kind"], number> = { warn: 0, good: 1, info: 2 };

export function scorePlace(place: ExplorePlace, prefs: TripPreferences, budgetLevel: BudgetLevel): PlaceMatch {
  const badges: PlaceBadge[] = [];
  let score = 0;
  const cat = place.category;
  const tags = place.tags ?? [];
  const has = (t: string) => tags.includes(t);
  const interests = new Set(prefs.interests ?? []);
  const access = new Set(prefs.accessibility ?? []);
  const ages = prefs.ages ?? {};
  const withKids = (ages.children ?? 0) > 0 || (ages.toddlers ?? 0) > 0 || prefs.travellerType === "family";
  const withToddlers = (ages.toddlers ?? 0) > 0;
  const withSeniors = (ages.seniors ?? 0) > 0;

  // Interest matches (category- or tag-derived).
  const placeInterests = new Set(CATEGORY_INTERESTS[cat] ?? []);
  if (has("Photo Spot") || has("Great for Sunset")) placeInterests.add("photography");
  if (has("Family Friendly")) placeInterests.add("kids");
  if (has("Foodie")) { placeInterests.add("restaurants"); placeInterests.add("cafes"); }
  if (has("Historic")) placeInterests.add("historical");
  if (has("Local Favorite")) placeInterests.add("local");
  for (const i of interests) if (placeInterests.has(i)) score += 2;

  // Kids
  if (withKids && (has("Family Friendly") || KID_CATEGORIES.has(cat))) {
    score += 2;
    badges.push({ label: "Best for kids", kind: "good" });
  }
  if (withToddlers && (cat === "nightlife" || place.estDurationMin > 180)) {
    score -= 3;
    badges.push({ label: "Tough with toddlers", kind: "warn" });
  }

  // Mobility / walking
  if ((withSeniors || access.has("lessWalking")) && (WALKING_CATEGORIES.has(cat) || place.estDurationMin > 150)) {
    score -= 2;
    badges.push({ label: "More walking", kind: "warn" });
  }
  if (access.has("wheelchair") && place.wheelchair === true) {
    score += 2;
    badges.push({ label: "Wheelchair-friendly", kind: "good" });
  }
  if ((access.has("stroller") || withToddlers) && (place.wheelchair === true || place.indoor === true)) {
    score += 1;
    badges.push({ label: "Stroller-friendly", kind: "good" });
  }
  if (access.has("indoor")) { if (place.indoor === true) score += 1; else if (place.indoor === false) score -= 1; }
  if (access.has("outdoor")) { if (place.indoor === false) score += 1; else if (place.indoor === true) score -= 1; }
  if (access.has("noLateNight") && cat === "nightlife") {
    score -= 3;
    badges.push({ label: "Late-night spot", kind: "warn" });
  }

  // Budget (uses the trip's chosen budget level)
  if (budgetLevel === "luxury" && (place.priceLevel ?? 0) >= 3) {
    score += 2;
    badges.push({ label: "Luxury pick", kind: "good" });
  } else if (budgetLevel === "budget" && (place.free === true || (place.priceLevel ?? 99) <= 1)) {
    score += 1;
    badges.push({ label: "Budget-friendly", kind: "good" });
  }

  // Photography
  if (interests.has("photography") && (has("Photo Spot") || has("Great for Sunset") || cat === "viewpoints" || cat === "architecture")) {
    badges.push({ label: "Great for photos", kind: "good" });
  }

  // Pace
  if (prefs.travelStyle === "relaxed" && (cat === "cafes" || cat === "parks" || cat === "beaches" || (place.estDurationMin >= 60 && place.estDurationMin <= 150))) {
    score += 1;
    badges.push({ label: "Good for a relaxed day", kind: "good" });
  } else if (prefs.travelStyle === "packed" && place.estDurationMin <= 75) {
    score += 1;
    badges.push({ label: "Quick stop", kind: "good" });
  } else if (place.estDurationMin <= 60) {
    badges.push({ label: "Short visit", kind: "info" });
  }

  // Dedupe by label, order warn → good → info, cap at 3.
  const seen = new Set<string>();
  const ordered = badges
    .filter((b) => (seen.has(b.label) ? false : (seen.add(b.label), true)))
    .sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
    .slice(0, 3);

  return { score, badges: ordered, recommended: score >= 2 };
}
