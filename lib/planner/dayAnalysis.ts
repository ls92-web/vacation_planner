import type { LatLng } from "@/lib/maps";
import { haversineKm, type ItineraryItem } from "@/lib/places";
import {
  computeTimeline,
  DAY_AVAILABLE_MIN,
  itemDuration,
  optimizeOrder,
  orderedItems,
  travelMinutes,
  type TransportMode,
} from "./travel";

// ===== AI Day Analysis engine — deterministic, real-data-only, transport-aware. =====

export type Grade = "excellent" | "good" | "attention";
export type Difficulty = "easy" | "moderate" | "high";
export type Pace = "relaxed" | "balanced" | "busy" | "overloaded";

export type RecAction =
  | { kind: "optimize" }
  | { kind: "shorten"; placeId: string; toMin: number }
  | { kind: "moveDay"; placeId: string }
  | { kind: "addCafe" }
  | { kind: "findSimilar" };

export interface Recommendation {
  title: string;
  reason: string;
  action?: RecAction;
}
export interface Warning {
  title: string;
  detail: string;
  level: "info" | "warn" | "high";
}
export interface ThemeCount {
  theme: string;
  count: number;
}

export interface DayAnalysis {
  stops: number;
  attractions: number;
  restaurants: number;
  overall: number;
  comfort: number;
  efficiency: Grade;
  mode: TransportMode;
  walkingKm: number;
  walkingMin: number;
  transportKm: number;
  transportMin: number;
  visitMin: number;
  freeMin: number;
  costMin: number;
  costMax: number;
  family: Grade;
  walkingDifficulty: Difficulty;
  pace: Pace;
  variety: { score: number; themes: ThemeCount[] };
  recommendations: Recommendation[];
  warnings: Warning[];
}

const PARTY = 3.4;
const THEME_BY_CATEGORY: Record<string, string> = {
  top: "Culture", hidden: "Culture", restaurants: "Food", cafes: "Food", breakfast: "Food",
  museums: "Culture", parks: "Nature", beaches: "Nature", shopping: "Shopping", family: "Entertainment",
  kids: "Entertainment", nightlife: "Entertainment", viewpoints: "Nature", historical: "History",
  architecture: "History", free: "Nature", indoor: "Culture", rainy: "Culture", adventure: "Entertainment",
  nature: "Nature", local: "Food",
};
const themeOf = (c: string) => THEME_BY_CATEGORY[c] ?? "Culture";
const isFood = (c: string) => ["restaurants", "cafes", "breakfast"].includes(c);

const ATTRACTION_TICKET = [0, 8, 15, 25, 40];
const FOOD_PER_PERSON = [10, 14, 26, 45, 75];
function placeCost(categoryKey: string, priceLevel?: number): number {
  if (isFood(categoryKey)) return Math.round(FOOD_PER_PERSON[priceLevel ?? 2] * PARTY);
  if (priceLevel === 0) return 0;
  return Math.round(ATTRACTION_TICKET[priceLevel ?? 2] * PARTY);
}

function pathKm(seq: ItineraryItem[], hotel: LatLng, loop = false): number {
  if (!seq.length) return 0;
  let total = haversineKm(hotel, seq[0].place.position);
  for (let i = 0; i < seq.length - 1; i++) total += haversineKm(seq[i].place.position, seq[i + 1].place.position);
  if (loop) total += haversineKm(seq[seq.length - 1].place.position, hotel);
  return total;
}

export function analyzeDay(items: ItineraryItem[], hotel: LatLng, mode: TransportMode): DayAnalysis {
  const seq = orderedItems(items);
  const stops = seq.length;
  const tl = computeTimeline(seq, hotel, mode);

  const restaurants = seq.filter((it) => isFood(it.place.category)).length;
  const attractions = stops - restaurants;
  const freeMin = DAY_AVAILABLE_MIN - (tl.visitMin + tl.totalTravelMin);

  // cost
  const placeSum = seq.reduce((s, it) => s + placeCost(it.place.category, it.place.priceLevel), 0);
  const transportCost = mode === "walk" ? 0 : mode === "transit" ? stops * 9 : Math.round(tl.transportKm * 1.5) + 6;
  const costBase = placeSum + transportCost;
  const costMin = Math.round((costBase * 0.85) / 5) * 5;
  const costMax = Math.round((costBase * 1.2) / 5) * 5;

  // variety
  const themeMap = new Map<string, number>();
  for (const it of seq) themeMap.set(themeOf(it.place.category), (themeMap.get(themeOf(it.place.category)) ?? 0) + 1);
  const themes = Array.from(themeMap, ([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count);
  const varietyScore = stops === 0 ? 0 : Math.round(Math.min(1, themeMap.size / 4) * 10);

  const walkingDifficulty: Difficulty = tl.walkingKm < 3 ? "easy" : tl.walkingKm < 6 ? "moderate" : "high";
  let pace: Pace;
  if (freeMin < 0) pace = "overloaded";
  else if (stops <= 2) pace = "relaxed";
  else if (stops <= 4) pace = "balanced";
  else if (stops <= 6) pace = "busy";
  else pace = "overloaded";

  // efficiency vs optimal
  const currentKm = pathKm(seq, hotel, true);
  const optimalKm = pathKm(optimizeOrder(items, hotel), hotel, true);
  const detour = optimalKm > 0 && currentKm > optimalKm * 1.25 && stops >= 3;
  let interSum = 0;
  for (let i = 0; i < seq.length - 1; i++) interSum += haversineKm(seq[i].place.position, seq[i + 1].place.position);
  const avgLeg = stops > 1 ? interSum / (stops - 1) : 0;
  const efficiency: Grade = stops < 2 ? "good" : detour || avgLeg > 3.5 ? "attention" : avgLeg < 1.6 ? "excellent" : "good";

  const hasMeal = restaurants > 0;
  let comfort = 10 - tl.walkingMin / 22 - tl.transportMin / 30 - (freeMin < 0 ? 2 : 0) + (hasMeal ? 0.5 : 0);
  comfort = Math.max(2, Math.min(10, comfort));

  const familyShare = stops === 0 ? 0 : seq.filter((it) => it.place.tags.includes("Family Friendly")).length / stops;
  const family: Grade = walkingDifficulty === "high" || pace === "overloaded" ? "attention" : familyShare >= 0.4 ? "excellent" : "good";

  let overall = 10;
  if (freeMin < 0) overall -= 2.5;
  if (mode === "walk" && tl.walkingKm > 8) overall -= 1.5;
  else if (tl.walkingKm > 5) overall -= 0.7;
  if (tl.transportMin > 150) overall -= 1.2;
  if (!hasMeal && stops >= 3) overall -= 1;
  if (efficiency === "attention") overall -= 1;
  if (varietyScore < 5 && stops >= 3) overall -= 0.6;
  overall = Math.max(3, Math.min(10, Math.round(overall * 10) / 10));

  // ===== recommendations (actionable where possible) =====
  const recommendations: Recommendation[] = [];
  if (detour) {
    recommendations.push({
      title: "Reorder for a shorter route",
      reason: `Your current order covers about ${currentKm.toFixed(1)} km; an optimized order is roughly ${optimalKm.toFixed(1)} km — less backtracking, more time at the sights.`,
      action: { kind: "optimize" },
    });
  }
  if (freeMin < 0) {
    const longest = [...seq].sort((a, b) => itemDuration(b) - itemDuration(a))[0];
    if (longest) {
      recommendations.push({
        title: `Shorten your visit at ${longest.place.name}`,
        reason: `The day runs about ${Math.round((-freeMin / 60) * 10) / 10}h over. Trimming its visit by 30 min helps it fit.`,
        action: { kind: "shorten", placeId: longest.place.id, toMin: Math.max(30, itemDuration(longest) - 30) },
      });
    }
    const last = seq[seq.length - 1];
    if (last) {
      recommendations.push({
        title: `Move ${last.place.name} to another day`,
        reason: "Spreading stops across days keeps the pace relaxed, especially with kids.",
        action: { kind: "moveDay", placeId: last.place.id },
      });
    }
  }
  if (!hasMeal && stops >= 3) {
    recommendations.push({ title: "Add a nearby café or lunch", reason: "There's no meal break yet — a stop near your route gives the day a natural pause.", action: { kind: "addCafe" } });
  }
  // proximity pair (informational)
  outer: for (let i = 0; i < seq.length; i++)
    for (let j = i + 1; j < seq.length; j++) {
      const km = haversineKm(seq[i].place.position, seq[j].place.position);
      if (km < 0.4) {
        recommendations.push({ title: `${seq[i].place.name} and ${seq[j].place.name} are side by side`, reason: `Only about a ${Math.max(1, Math.round(km * 12))}-minute walk apart — visit them together.` });
        break outer;
      }
    }
  const sunset = seq.find((it) => ["viewpoints", "beaches"].includes(it.place.category) && it.slot !== "evening");
  if (sunset) recommendations.push({ title: `See ${sunset.place.name} at sunset`, reason: "Viewpoints and beaches shine in the evening light — consider moving it later." });
  const dupTheme = themes.find((t) => t.count >= 3);
  if (dupTheme && stops >= 3) recommendations.push({ title: `A lot of ${dupTheme.theme.toLowerCase()} today`, reason: `${dupTheme.count} stops are ${dupTheme.theme.toLowerCase()} — mixing in something different makes the day more memorable.`, action: { kind: "findSimilar" } });

  // ===== warnings =====
  const warnings: Warning[] = [];
  if (freeMin < 0) warnings.push({ title: "Day exceeds available hours", detail: `Visits and travel run about ${Math.round((-freeMin / 60) * 10) / 10}h past a comfortable day.`, level: "high" });
  if (mode === "walk" && tl.walkingKm > 8) warnings.push({ title: "Too much walking", detail: `~${tl.walkingKm.toFixed(1)} km on foot is a lot with children — switch some legs to transit or a taxi.`, level: "warn" });
  if (mode === "drive" && tl.transportKm > 60) warnings.push({ title: "Too much driving", detail: `~${Math.round(tl.transportKm)} km of driving leaves less time at the sights.`, level: "warn" });
  if (tl.totalTravelMin > 180) warnings.push({ title: "Travel time is high", detail: `About ${Math.round(tl.totalTravelMin / 60 * 10) / 10}h is spent getting between stops — reorder or drop one.`, level: "warn" });
  const longLeg = [...tl.entries.map((e) => e.travelFromPrev), tl.returnLeg].filter(Boolean).find((l) => (l as { min: number }).min > 40);
  if (longLeg) warnings.push({ title: "One long transfer", detail: `A single hop is about ${Math.round((longLeg as { min: number }).min)} min — reordering may shorten it.`, level: "info" });
  if (!hasMeal && stops >= 3) warnings.push({ title: "No lunch break scheduled", detail: "Add a restaurant or café so the day has a pause.", level: "info" });
  const closed = seq.find((it) => it.place.openNow === false);
  if (closed) warnings.push({ title: `${closed.place.name} is currently closed`, detail: "Check its hours for your visit day so you don't arrive after closing.", level: "warn" });

  return {
    stops, attractions, restaurants, overall, comfort: Math.round(comfort * 10) / 10, efficiency, mode,
    walkingKm: Math.round(tl.walkingKm * 10) / 10, walkingMin: tl.walkingMin,
    transportKm: Math.round(tl.transportKm * 10) / 10, transportMin: tl.transportMin,
    visitMin: tl.visitMin, freeMin, costMin, costMax, family, walkingDifficulty, pace,
    variety: { score: varietyScore, themes }, recommendations: recommendations.slice(0, 6), warnings,
  };
}

// Re-export for callers that compute travel time labels.
export { travelMinutes };
