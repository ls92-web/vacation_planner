// ===== Trip suggestion engine =====
// Turns the route the user actually entered into a few specific, useful tips.
// Pure + deterministic: it never invents data. When something needed for a real
// analysis is missing (coordinates, dates), it says what's missing instead of
// faking a generic "looks efficient" line. The Route Planner renders the result
// under the "AI travel suggestions" card.

export type SuggestionType = "route" | "timing" | "hotel" | "missing_info" | "warning" | "positive";

export interface TripSuggestion {
  title: string;
  description: string;
  type: SuggestionType;
}

/** One stop on the route, in travel order. */
export interface SuggestionStop {
  name: string;
  country?: string;
  lat?: number;
  lng?: number;
  /** Nights at this stop (0 if dates aren't set). */
  nights: number;
  hasDates: boolean;
  /** Number of accommodations added for this stop. */
  hotels: number;
}

export interface TripSuggestionInput {
  stops: SuggestionStop[];
  preferences?: import("@/lib/types").TripPreferences;
}

interface Pt { lat: number; lng: number }

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const short = (name: string) => name.split(",")[0].trim();
const hasCoords = (s: SuggestionStop) => isNum(s.lat) && isNum(s.lng) && !(s.lat === 0 && s.lng === 0);

function haversineKm(a: Pt, b: Pt): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pathLen(order: number[], pts: Pt[]): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) total += haversineKm(pts[order[i]], pts[order[i + 1]]);
  return total;
}

/** Shortest open-path ordering (brute force; callers gate to small n). */
function bestOrder(pts: Pt[]): { order: number[]; len: number } {
  const idx = pts.map((_, i) => i);
  let best = { order: idx.slice(), len: pathLen(idx, pts) };
  const permute = (arr: number[], k: number) => {
    if (k === arr.length - 1) {
      const len = pathLen(arr, pts);
      if (len < best.len) best = { order: arr.slice(), len };
      return;
    }
    for (let i = k; i < arr.length; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      permute(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  permute(idx.slice(), 0);
  return best;
}

const PRIORITY: Record<SuggestionType, number> = { warning: 0, missing_info: 1, route: 2, timing: 2, hotel: 3, positive: 4 };

/** Tips derived purely from this trip's traveller preferences. */
function preferenceTips(pf?: import("@/lib/types").TripPreferences): TripSuggestion[] {
  if (!pf) return [];
  const out: TripSuggestion[] = [];
  const ages = pf.ages ?? {};
  const toddlers = (ages.toddlers ?? 0) > 0;
  const seniors = (ages.seniors ?? 0) > 0;
  const access = pf.accessibility ?? [];
  if (pf.travelStyle === "packed") out.push({ type: "timing", title: "Fast-paced trip", description: "You set a packed pace — plan ~3–4 stops a day and group nearby places to keep moving." });
  else if (pf.travelStyle === "relaxed") out.push({ type: "timing", title: "Relaxed pace", description: "You set a relaxed pace — 2–3 stops a day with breaks in between fits best." });
  if (toddlers) out.push({ type: "warning", title: "Travelling with toddlers", description: "Keep days light, favour stroller-friendly stops, and plan a midday break." });
  if (seniors || access.includes("lessWalking")) out.push({ type: "warning", title: "Easier on the feet", description: "Group nearby stops and favour central stays to cut down on walking." });
  return out;
}

function finalize(list: TripSuggestion[]): TripSuggestion[] {
  const seen = new Set<string>();
  return list
    .filter((s) => (seen.has(s.title) ? false : (seen.add(s.title), true)))
    .sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type])
    .slice(0, 4);
}

/**
 * Generate 2–4 trip-specific suggestions from the route the user entered.
 * Rule-based and deterministic — different trips get different advice, and it
 * stays silent (or asks for the missing piece) when data is insufficient.
 */
export function generateTripSuggestions(input: TripSuggestionInput): TripSuggestion[] {
  const stops = input.stops.filter((s) => s.name.trim());
  if (stops.length === 0) return [];

  const out: TripSuggestion[] = [];
  const totalNights = stops.reduce((s, d) => s + (d.nights || 0), 0);
  const rushed = stops.length >= 3 && totalNights > 0 && totalNights / stops.length < 1.5;

  // ---------------- Single destination: planning tips, not route efficiency ----------------
  if (stops.length === 1) {
    const d = stops[0];
    const city = short(d.name);
    if (!d.hasDates) {
      out.push({ type: "missing_info", title: "Add your travel dates", description: `Set arrival and departure for ${city} so nights, weather and budget can be estimated.` });
    } else if (d.nights <= 1) {
      out.push({ type: "timing", title: `Short stay in ${city}`, description: `With about a day here, pick a few must-sees close together rather than over-packing the schedule.` });
    } else if (d.nights >= 4) {
      out.push({ type: "positive", title: `${d.nights} days in ${city}`, description: `That's enough time for a relaxed pace — and maybe a day trip somewhere nearby.` });
    }
    if (d.hotels === 0) {
      out.push({ type: "hotel", title: "Add where you're staying", description: `Adding your ${city} hotel makes the budget and walking distances more accurate.` });
    } else {
      out.push({ type: "hotel", title: "A central base helps", description: `In ${city}, staying near the centre usually keeps most attractions within walking distance.` });
    }
    out.push({ type: "positive", title: "Build your days in Explore", description: `Open ${city} in Explore to add attractions, then let the planner lay out each day.` });
    out.push(...preferenceTips(input.preferences));
    return finalize(out);
  }

  // ---------------- Multiple destinations ----------------
  const missingCoords = stops.filter((s) => !hasCoords(s));
  const pts: (Pt | null)[] = stops.map((s) => (hasCoords(s) ? { lat: s.lat as number, lng: s.lng as number } : null));

  if (missingCoords.length) {
    const names = missingCoords.slice(0, 2).map((s) => short(s.name)).join(" and ");
    const more = missingCoords.length > 2 ? ", among others" : "";
    out.push({
      type: "missing_info",
      title: "Can't map every stop yet",
      description: `Distance tips need coordinates for ${names}${more}. Re-add ${missingCoords.length > 1 ? "them" : "it"} by choosing the city from the dropdown so the route can be analysed.`,
    });
  }

  // Distance analysis across consecutive located stops
  let total = 0;
  let maxLeg = 0;
  let maxFrom = "";
  let maxTo = "";
  for (let i = 0; i < stops.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
    const dist = haversineKm(a, b);
    total += dist;
    if (dist > maxLeg) { maxLeg = dist; maxFrom = short(stops[i].name); maxTo = short(stops[i + 1].name); }
  }

  // Reorder / backtracking — only when every stop is located and n is small
  let reordered = false;
  if (missingCoords.length === 0 && stops.length >= 3 && stops.length <= 7) {
    const located = pts as Pt[];
    const current = pathLen(stops.map((_, i) => i), located);
    const best = bestOrder(located);
    const saving = current - best.len;
    if (best.len < current * 0.8 && saving > 30) {
      const first = short(stops[best.order[0]].name);
      const second = short(stops[best.order[1]].name);
      out.push({
        type: "warning",
        title: "Reorder to cut backtracking",
        description: `Starting with ${first} before ${second} would shorten the trip by about ${Math.round(saving)} km of travel.`,
      });
      reordered = true;
    }
  }

  // A single very long leg
  if (maxLeg > 300) {
    out.push({
      type: "warning",
      title: "One long leg",
      description: `It's roughly ${Math.round(maxLeg)} km from ${maxFrom} to ${maxTo} — a train or flight may beat driving, or break it with a stop in between.`,
    });
  }

  // Pace
  if (rushed) {
    out.push({
      type: "warning",
      title: "Pace looks rushed",
      description: `${stops.length} cities in ${totalNights} night${totalNights !== 1 ? "s" : ""} is a fast pace — consider dropping a stop or adding a night or two.`,
    });
  } else {
    const oneNight = stops.find((s) => s.hasDates && s.nights === 1);
    if (oneNight) {
      out.push({ type: "timing", title: `Only one night in ${short(oneNight.name)}`, description: `Keep ${short(oneNight.name)} to a tight set of must-sees so it doesn't feel rushed.` });
    }
  }

  // Positive route note — only when it's genuinely tidy (no reorder win, no rushed flag)
  if (!reordered && !rushed && missingCoords.length === 0 && total > 0) {
    if (total < 150 && maxLeg < 60) {
      out.push({
        type: "positive",
        title: "Compact, relaxed route",
        description: `Your stops are close together (~${Math.round(total)} km total)${totalNights ? `, which suits an unhurried ${totalNights}-night trip` : ""}.`,
      });
    } else if (maxLeg <= 300) {
      out.push({
        type: "positive",
        title: "Route flows in one direction",
        description: `~${Math.round(total)} km across ${stops.length} stops with no big backtracking.`,
      });
    }
  }

  // Accommodation gaps
  const noHotel = stops.filter((s) => s.hasDates && s.hotels === 0);
  if (noHotel.length) {
    const names = noHotel.slice(0, 2).map((s) => short(s.name)).join(", ");
    const more = noHotel.length > 2 ? " and more" : "";
    out.push({ type: "hotel", title: "Missing accommodation", description: `No place to stay set for ${names}${more} — adding it firms up the budget and check-in timing.` });
  }

  // Missing dates
  const noDates = stops.filter((s) => !s.hasDates);
  if (noDates.length) {
    const names = noDates.slice(0, 2).map((s) => short(s.name)).join(", ");
    const more = noDates.length > 2 ? " and others" : "";
    out.push({ type: "missing_info", title: "Add dates to each stop", description: `Set dates for ${names}${more} so nights, weather and budget can be worked out.` });
  }

  out.push(...preferenceTips(input.preferences));
  return finalize(out);
}
