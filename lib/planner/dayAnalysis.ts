import type { LatLng } from "@/lib/maps";
import { haversineKm, SLOTS, type ItineraryItem } from "@/lib/places";

// ===== AI Day Analysis: a deterministic engine that scores the day's itinerary. =====
// It only analyzes real data (Places, coordinates, durations, categories, hotel
// location, the user's schedule). Distances are straight-line (Haversine) and
// travel times are estimated from them — clearly presented as estimates, never
// invented. Everything here is pure → it recomputes instantly when the plan changes.

export type Grade = "excellent" | "good" | "attention";
export type Difficulty = "easy" | "moderate" | "high";
export type Pace = "relaxed" | "balanced" | "busy" | "overloaded";

export interface Recommendation {
  title: string;
  reason: string;
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
  overall: number; // 0–10
  comfort: number; // 0–10
  efficiency: Grade;
  walkingKm: number;
  walkingMin: number;
  drivingKm: number;
  drivingMin: number;
  visitMin: number;
  freeMin: number; // negative ⇒ over budget
  costMin: number;
  costMax: number;
  family: Grade;
  walkingDifficulty: Difficulty;
  pace: Pace;
  variety: { score: number; themes: ThemeCount[] };
  recommendations: Recommendation[];
  warnings: Warning[];
}

// Tunables (assumptions, surfaced to the user as estimates).
const DAY_MINUTES = 600; // a ~10h active day (09:00–19:00)
const WALK_THRESHOLD_KM = 1.2; // legs under this are walked
const WALK_MIN_PER_KM = 12; // ~5 km/h
const DRIVE_MIN_PER_KM = 2.2; // ~27 km/h city driving
const PARTY = 3.4; // 2 adults + 2 kids, kids discounted

const THEME_BY_CATEGORY: Record<string, string> = {
  top: "Culture",
  hidden: "Culture",
  restaurants: "Food",
  cafes: "Food",
  breakfast: "Food",
  museums: "Culture",
  parks: "Nature",
  beaches: "Nature",
  shopping: "Shopping",
  family: "Entertainment",
  kids: "Entertainment",
  nightlife: "Entertainment",
  viewpoints: "Nature",
  historical: "History",
  architecture: "History",
  free: "Nature",
  indoor: "Culture",
  rainy: "Culture",
  adventure: "Entertainment",
  nature: "Nature",
  local: "Food",
};

function themeOf(categoryKey: string): string {
  return THEME_BY_CATEGORY[categoryKey] ?? "Culture";
}

function isFood(categoryKey: string): boolean {
  return ["restaurants", "cafes", "breakfast"].includes(categoryKey);
}

const ATTRACTION_TICKET = [0, 8, 15, 25, 40]; // by priceLevel
const FOOD_PER_PERSON = [10, 14, 26, 45, 75]; // by priceLevel

function placeCost(categoryKey: string, priceLevel?: number): number {
  if (isFood(categoryKey)) {
    const pp = FOOD_PER_PERSON[priceLevel ?? 2];
    return Math.round(pp * PARTY);
  }
  if (priceLevel === 0) return 0;
  const ticket = ATTRACTION_TICKET[priceLevel ?? 2];
  return Math.round(ticket * PARTY);
}

function ordered(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.position - b.position);
}

export function analyzeDay(items: ItineraryItem[], hotel: LatLng): DayAnalysis {
  const stops = items.length;
  const seq = ordered(items);

  // Travel legs: hotel → stops → hotel.
  const points = [hotel, ...seq.map((it) => it.place.position), hotel];
  let walkingKm = 0;
  let drivingKm = 0;
  let longestDriveMin = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const km = haversineKm(points[i], points[i + 1]);
    if (km <= WALK_THRESHOLD_KM) walkingKm += km;
    else {
      drivingKm += km;
      longestDriveMin = Math.max(longestDriveMin, km * DRIVE_MIN_PER_KM);
    }
  }
  const walkingMin = Math.round(walkingKm * WALK_MIN_PER_KM);
  const drivingMin = Math.round(drivingKm * DRIVE_MIN_PER_KM);
  const visitMin = seq.reduce((sum, it) => sum + it.place.estDurationMin, 0);
  const freeMin = DAY_MINUTES - (visitMin + walkingMin + drivingMin);

  // Cost range.
  const cost = seq.reduce((sum, it) => sum + placeCost(it.place.category, it.place.priceLevel), 0);
  const transport = Math.round(drivingKm * 1.5) + (stops > 0 ? 6 : 0);
  const costBase = cost + transport;
  const costMin = Math.round((costBase * 0.85) / 5) * 5;
  const costMax = Math.round((costBase * 1.2) / 5) * 5;

  // Variety.
  const themeMap = new Map<string, number>();
  for (const it of seq) themeMap.set(themeOf(it.place.category), (themeMap.get(themeOf(it.place.category)) ?? 0) + 1);
  const themes = Array.from(themeMap, ([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count);
  const varietyScore = stops === 0 ? 0 : Math.round(Math.min(1, themeMap.size / 4) * 10);

  // Difficulty / pace.
  const walkingDifficulty: Difficulty = walkingKm < 3 ? "easy" : walkingKm < 6 ? "moderate" : "high";
  let pace: Pace;
  if (freeMin < 0) pace = "overloaded";
  else if (stops <= 2) pace = "relaxed";
  else if (stops <= 4) pace = "balanced";
  else if (stops <= 6) pace = "busy";
  else pace = "overloaded";

  // Efficiency (compactness of inter-stop hops, excluding hotel legs).
  let interSum = 0;
  let interCount = 0;
  for (let i = 0; i < seq.length - 1; i++) {
    interSum += haversineKm(seq[i].place.position, seq[i + 1].place.position);
    interCount++;
  }
  const avgLeg = interCount ? interSum / interCount : 0;
  const efficiency: Grade = interCount === 0 ? "good" : avgLeg < 1.5 ? "excellent" : avgLeg < 3.5 ? "good" : "attention";

  // Meal presence.
  const hasMeal = seq.some((it) => isFood(it.place.category));

  // Comfort (0–10).
  let comfort = 10 - walkingMin / 22 - drivingMin / 28 - (freeMin < 0 ? 2 : 0) + (hasMeal ? 0.5 : 0);
  comfort = Math.max(2, Math.min(10, comfort));

  // Family grade.
  const familyShare = stops === 0 ? 0 : seq.filter((it) => it.place.tags.includes("Family Friendly")).length / stops;
  const family: Grade =
    walkingDifficulty === "high" || pace === "overloaded" ? "attention" : familyShare >= 0.4 ? "excellent" : "good";

  // Overall (0–10).
  let overall = 10;
  if (freeMin < 0) overall -= 2.5;
  if (walkingKm > 8) overall -= 1.5;
  else if (walkingKm > 5) overall -= 0.7;
  if (drivingKm > 40) overall -= 1.5;
  if (!hasMeal && stops >= 3) overall -= 1;
  if (efficiency === "attention") overall -= 1;
  if (varietyScore < 5 && stops >= 3) overall -= 0.6;
  overall = Math.max(3, Math.min(10, Math.round(overall * 10) / 10));

  // ===== Recommendations (each explains its reason). =====
  const recommendations: Recommendation[] = [];
  // proximity pair
  outer: for (let i = 0; i < seq.length; i++)
    for (let j = i + 1; j < seq.length; j++) {
      const km = haversineKm(seq[i].place.position, seq[j].place.position);
      if (km < 0.4) {
        recommendations.push({
          title: `Pair ${seq[i].place.name} with ${seq[j].place.name}`,
          reason: `They're only about a ${Math.max(1, Math.round(km * WALK_MIN_PER_KM))}-minute walk apart, so visiting them back-to-back saves travel.`,
        });
        break outer;
      }
    }
  // closer first stop
  if (seq.length >= 2) {
    const firstKm = haversineKm(hotel, seq[0].place.position);
    let closer = seq[0];
    let closerKm = firstKm;
    for (const it of seq) {
      const km = haversineKm(hotel, it.place.position);
      if (km < closerKm) { closer = it; closerKm = km; }
    }
    if (closer.place.id !== seq[0].place.id && firstKm - closerKm > 1.5) {
      recommendations.push({
        title: `Start with ${closer.place.name}`,
        reason: `It's ${(firstKm - closerKm).toFixed(1)} km closer to your hotel than your current first stop, trimming early travel.`,
      });
    }
  }
  // sunset opportunity
  const sunsetCandidate = seq.find((it) => ["viewpoints", "beaches"].includes(it.place.category) && it.slot !== "evening");
  if (sunsetCandidate) {
    recommendations.push({
      title: `See ${sunsetCandidate.place.name} at sunset`,
      reason: `Viewpoints and beaches are best in the evening light — consider moving it to the evening slot.`,
    });
  }
  // walking heavy
  if (walkingKm > 6) {
    recommendations.push({
      title: "Consider a taxi for the longest leg",
      reason: `Your day involves about ${walkingKm.toFixed(1)} km of walking — a short ride on the longest stretch keeps energy for the sights.`,
    });
  }
  // hotel far from evening
  const evening = seq.filter((it) => it.slot === "evening");
  if (evening.length) {
    const last = evening[evening.length - 1];
    const km = haversineKm(hotel, last.place.position);
    if (km > 8) {
      recommendations.push({
        title: "Late return to your hotel",
        reason: `${last.place.name} is about ${km.toFixed(1)} km from your hotel — plan the trip back or pick a closer evening spot.`,
      });
    }
  }

  // ===== Warnings (help, don't block). =====
  const warnings: Warning[] = [];
  if (freeMin < 0) warnings.push({ title: "Day exceeds available hours", detail: `Visits and travel total about ${Math.round((-freeMin / 60) * 10) / 10}h over a typical day. Drop or move a stop.`, level: "high" });
  if (walkingKm > 8) warnings.push({ title: "A lot of walking", detail: `~${walkingKm.toFixed(1)} km on foot may tire young kids — add a break or a taxi leg.`, level: "warn" });
  if (drivingKm > 60) warnings.push({ title: "A lot of driving", detail: `~${Math.round(drivingKm)} km of driving leaves less time at the sights.`, level: "warn" });
  if (longestDriveMin > 40) warnings.push({ title: "One long transfer", detail: `A single hop is roughly ${Math.round(longestDriveMin)} min — consider reordering to shorten it.`, level: "info" });
  if (!hasMeal && stops >= 3) warnings.push({ title: "No meal break scheduled", detail: "Add a restaurant or café so the day has a natural pause.", level: "info" });
  const closed = seq.find((it) => it.place.openNow === false);
  if (closed) warnings.push({ title: `${closed.place.name} is currently closed`, detail: "Double-check its opening hours for the day you're visiting.", level: "warn" });

  return {
    stops,
    overall,
    comfort: Math.round(comfort * 10) / 10,
    efficiency,
    walkingKm: Math.round(walkingKm * 10) / 10,
    walkingMin,
    drivingKm: Math.round(drivingKm * 10) / 10,
    drivingMin,
    visitMin,
    freeMin,
    costMin,
    costMax,
    family,
    walkingDifficulty,
    pace,
    variety: { score: varietyScore, themes },
    recommendations: recommendations.slice(0, 5),
    warnings,
  };
}
