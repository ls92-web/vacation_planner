// ===== Per-trip preference options + helpers =====
// Trip preferences live on the trip (see TripPreferences in lib/types). These are
// the option lists the UI renders and helpers that turn the preferences into a
// short summary the AI can read and a signal the place ranker can score against.

import type { BudgetLevel } from "@/lib/budget/estimate";
import type { TripPreferences, TravellerType, TravelStyle } from "@/lib/types";

export const PREF_TRAVELLER_TYPES: { key: TravellerType; label: string }[] = [
  { key: "family", label: "Family" },
  { key: "couple", label: "Couple" },
  { key: "friends", label: "Friends" },
  { key: "solo", label: "Solo" },
  { key: "business", label: "Business" },
  { key: "mixed", label: "Mixed group" },
];

export const PREF_TRAVEL_STYLES: { key: TravelStyle; label: string; hint: string }[] = [
  { key: "relaxed", label: "Relaxed", hint: "Fewer stops, more breaks" },
  { key: "balanced", label: "Balanced", hint: "A comfortable mix" },
  { key: "packed", label: "Packed", hint: "More stops per day" },
];

export const PREF_AGE_GROUPS: { key: keyof NonNullable<TripPreferences["ages"]>; label: string }[] = [
  { key: "adults", label: "Adults" },
  { key: "children", label: "Children" },
  { key: "toddlers", label: "Toddlers" },
  { key: "seniors", label: "Seniors" },
];

export const PREF_INTERESTS: { key: string; label: string }[] = [
  { key: "attractions", label: "Attractions" },
  { key: "museums", label: "Museums" },
  { key: "nature", label: "Nature" },
  { key: "shopping", label: "Shopping" },
  { key: "restaurants", label: "Restaurants" },
  { key: "cafes", label: "Cafés" },
  { key: "beaches", label: "Beaches" },
  { key: "themeparks", label: "Theme parks" },
  { key: "historical", label: "Historical places" },
  { key: "local", label: "Local experiences" },
  { key: "photography", label: "Photography spots" },
  { key: "kids", label: "Kids-friendly" },
];

export const PREF_ACCESS: { key: string; label: string }[] = [
  { key: "stroller", label: "Stroller-friendly" },
  { key: "wheelchair", label: "Wheelchair-friendly" },
  { key: "lessWalking", label: "Avoid too much walking" },
  { key: "indoor", label: "Indoor preferred" },
  { key: "outdoor", label: "Outdoor preferred" },
  { key: "noLateNight", label: "Avoid late-night activities" },
];

const labelOf = (list: { key: string; label: string }[], key: string) => list.find((o) => o.key === key)?.label ?? key;

/** Has the user set anything meaningful? Used to decide whether to personalize. */
export function hasPreferences(p?: TripPreferences | null): boolean {
  if (!p) return false;
  const ages = p.ages ? Object.values(p.ages).some((n) => (n ?? 0) > 0) : false;
  return !!(p.travellerType || p.travelStyle || ages || p.interests?.length || p.accessibility?.length);
}

function agesSummary(ages?: TripPreferences["ages"]): string {
  if (!ages) return "";
  const parts: string[] = [];
  const add = (n: number | undefined, sing: string, plur: string) => { if (n && n > 0) parts.push(`${n} ${n === 1 ? sing : plur}`); };
  add(ages.adults, "adult", "adults");
  add(ages.children, "child", "children");
  add(ages.toddlers, "toddler", "toddlers");
  add(ages.seniors, "senior", "seniors");
  return parts.join(", ");
}

/** One-line, human-readable summary used as AI context for this trip. */
export function summarizePreferences(p: TripPreferences | undefined | null, budgetLevel?: BudgetLevel): string {
  if (!p && !budgetLevel) return "";
  const segs: string[] = [];
  if (p?.travellerType) segs.push(`${labelOf(PREF_TRAVELLER_TYPES, p.travellerType)} trip`);
  const ages = agesSummary(p?.ages);
  if (ages) segs.push(ages);
  if (p?.travelStyle) segs.push(`${labelOf(PREF_TRAVEL_STYLES, p.travelStyle).toLowerCase()} pace`);
  if (budgetLevel) segs.push(`${budgetLevel === "budget" ? "budget-friendly" : budgetLevel} budget`);
  if (p?.interests?.length) segs.push(`likes ${p.interests.map((k) => labelOf(PREF_INTERESTS, k).toLowerCase()).join(", ")}`);
  if (p?.accessibility?.length) segs.push(`needs: ${p.accessibility.map((k) => labelOf(PREF_ACCESS, k).toLowerCase()).join(", ")}`);
  return segs.join(" · ");
}
