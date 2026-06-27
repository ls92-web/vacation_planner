import { PLACES } from "@/lib/data";
import { placeCoords } from "@/lib/maps";
import type { ExplorePlace } from "./types";

// ===== Curated fallback dataset (used when live Places is unavailable). =====
// Derived from the existing Barcelona catalog so the page is never empty.

function priceLevel(price?: string): number | undefined {
  if (!price) return undefined;
  if (/free/i.test(price)) return 0;
  const euros = (price.match(/€/g) || []).length;
  if (euros) return Math.min(4, euros);
  const num = parseInt(price.replace(/[^\d]/g, ""), 10);
  if (!isNaN(num)) return num <= 10 ? 1 : num <= 25 ? 2 : 3;
  return undefined;
}

function curatedTags(tags: string[], cat: string): string[] {
  const out = new Set<string>();
  if (tags.includes("family") || tags.includes("kid")) out.add("Family Friendly");
  if (tags.includes("free")) out.add("Free");
  if (tags.includes("rated")) out.add("Must Visit");
  if (cat) out.add(cat);
  return Array.from(out).slice(0, 4);
}

const CURATED: ExplorePlace[] = PLACES.map((p): ExplorePlace | null => {
  const c = placeCoords(p.id);
  if (!c) return null;
  const isRestaurant = p.type === "restaurant";
  return {
    id: p.id,
    name: p.name,
    category: isRestaurant ? "restaurants" : "top",
    position: c,
    rating: p.rating,
    reviews: undefined,
    priceLevel: priceLevel(p.price || p.avgPrice),
    openNow: undefined,
    photoUrl: undefined,
    address: undefined,
    description: p.desc,
    tags: curatedTags(p.tags, p.cats[0]),
    estDurationMin: isRestaurant ? 90 : 90,
    recommendedSlot: isRestaurant ? "evening" : "morning",
    wheelchair: p.tags.includes("wheelchair") || undefined,
    indoor: p.tags.includes("indoor") || undefined,
    free: p.tags.includes("free") || undefined,
    googleTypes: [],
    source: "curated",
  };
}).filter((p): p is ExplorePlace => p !== null);

const CATEGORY_TO_CURATED: Record<string, (p: ExplorePlace, raw: (typeof PLACES)[number]) => boolean> = {
  restaurants: (_p, raw) => raw.type === "restaurant",
  cafes: (_p, raw) => raw.cats.includes("Cafés"),
  museums: (_p, raw) => raw.cats.includes("Museums"),
  parks: (_p, raw) => raw.cats.includes("Nature"),
  beaches: (_p, raw) => raw.cats.includes("Beaches"),
  shopping: (_p, raw) => raw.cats.includes("Shopping"),
  hidden: (_p, raw) => raw.cats.includes("Hidden Gems"),
  historical: (_p, raw) => raw.cats.includes("Historical Sites"),
};

/** Curated places for a category (falls back to all attractions if none match). */
export function curatedForCategory(categoryKey: string): ExplorePlace[] {
  const pred = CATEGORY_TO_CURATED[categoryKey];
  if (!pred) return CURATED.filter((p) => p.category === "top");
  const matched = CURATED.filter((p) => {
    const raw = PLACES.find((r) => r.id === p.id);
    return raw ? pred(p, raw) : false;
  });
  return matched.length ? matched : CURATED;
}
