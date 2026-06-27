import type { LatLng } from "@/lib/maps";
import { haversineKm, SLOTS, type ItineraryItem } from "@/lib/places";

// ===== Transport modes + a timeline engine that computes arrival/travel times. =====
// Travel times are estimated from straight-line distance and the selected mode
// (no Directions/Routes API calls) — clearly presented as estimates.

export type TransportMode = "walk" | "drive" | "transit";
export const TRANSPORT_MODES: TransportMode[] = ["walk", "drive", "transit"];
export const TRANSPORT_LABEL: Record<TransportMode, string> = {
  walk: "Walking",
  drive: "Driving",
  transit: "Public transport",
};

const SHORT_WALK_KM = 0.3; // very short hops are always walked
const DAY_START_MIN = 9 * 60; // 09:00
const DAY_END_MIN = 21 * 60; // 21:00 — bounds "available hours"
export const DAY_AVAILABLE_MIN = DAY_END_MIN - DAY_START_MIN;

/** Minutes for a leg of `km` by `mode` (includes a small fixed overhead for vehicles). */
export function travelMinutes(km: number, mode: TransportMode): number {
  switch (mode) {
    case "walk":
      return km * 12; // ~5 km/h
    case "drive":
      return km * 2.2 + 2; // ~27 km/h + parking/overhead
    case "transit":
      return km * 4 + 5; // waiting + stops
  }
}

export function legModeFor(km: number, mode: TransportMode): TransportMode {
  return km <= SHORT_WALK_KM ? "walk" : mode;
}

export function itemDuration(it: ItineraryItem): number {
  return it.durationMin ?? it.place.estDurationMin;
}

export function orderedItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.position - b.position);
}

export interface TravelLeg {
  km: number;
  mode: TransportMode;
  min: number;
}
export interface TimelineEntry {
  item: ItineraryItem;
  arrivalMin: number;
  departMin: number;
  travelFromPrev: TravelLeg; // from hotel for the first entry
}
export interface DayTimeline {
  entries: TimelineEntry[];
  returnLeg: TravelLeg | null;
  totalTravelMin: number;
  totalTravelKm: number;
  walkingKm: number;
  walkingMin: number;
  transportKm: number; // non-walking legs
  transportMin: number;
  visitMin: number;
  endMin: number;
}

/**
 * Build a continuous timeline for a day (hotel → stops → hotel). The given items
 * are used IN ORDER — pass `orderedItems(...)` (or a custom order for resequencing).
 */
export function computeTimeline(seq: ItineraryItem[], hotel: LatLng, mode: TransportMode, startMin = DAY_START_MIN): DayTimeline {
  const entries: TimelineEntry[] = [];
  let clock = startMin;
  let prev = hotel;
  let walkingKm = 0;
  let walkingMin = 0;
  let transportKm = 0;
  let transportMin = 0;
  let visitMin = 0;

  for (let i = 0; i < seq.length; i++) {
    const km = haversineKm(prev, seq[i].place.position);
    const lm = legModeFor(km, mode);
    const min = Math.round(travelMinutes(km, lm));
    clock += min;
    if (lm === "walk") { walkingKm += km; walkingMin += min; }
    else { transportKm += km; transportMin += min; }
    const dur = itemDuration(seq[i]);
    visitMin += dur;
    entries.push({ item: seq[i], arrivalMin: clock, departMin: clock + dur, travelFromPrev: { km, mode: lm, min } });
    clock += dur;
    prev = seq[i].place.position;
  }

  let returnLeg: TravelLeg | null = null;
  if (seq.length) {
    const km = haversineKm(prev, hotel);
    const lm = legModeFor(km, mode);
    const min = Math.round(travelMinutes(km, lm));
    returnLeg = { km, mode: lm, min };
    if (lm === "walk") { walkingKm += km; walkingMin += min; }
    else { transportKm += km; transportMin += min; }
  }

  return {
    entries,
    returnLeg,
    totalTravelMin: walkingMin + transportMin,
    totalTravelKm: walkingKm + transportKm,
    walkingKm,
    walkingMin,
    transportKm,
    transportMin,
    visitMin,
    endMin: clock + (returnLeg?.min ?? 0),
  };
}

export function fmtClock(min: number): string {
  const total = Math.round(min);
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const h = ((h24 + 11) % 12) + 1;
  const ap = h24 < 12 ? "AM" : "PM";
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

/** Re-assign slot + position from a given visit order, bucketing by computed arrival time. */
export function resequence(orderedDay: ItineraryItem[], hotel: LatLng, mode: TransportMode): ItineraryItem[] {
  const tl = computeTimeline(orderedDay, hotel, mode);
  const counts: Record<string, number> = { morning: 0, afternoon: 0, evening: 0 };
  return tl.entries.map((e) => {
    const slot = e.arrivalMin < 12 * 60 ? "morning" : e.arrivalMin < 17 * 60 ? "afternoon" : "evening";
    return { ...e.item, slot: slot as ItineraryItem["slot"], position: counts[slot]++ };
  });
}

/** Nearest-neighbour reorder of a day's stops starting from the hotel. */
export function optimizeOrder(items: ItineraryItem[], hotel: LatLng): ItineraryItem[] {
  const seq = orderedItems(items);
  if (seq.length < 3) return seq;
  const remaining = [...seq];
  const out: ItineraryItem[] = [];
  let cur = hotel;
  while (remaining.length) {
    let bestIdx = 0;
    let bestKm = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const km = haversineKm(cur, remaining[i].place.position);
      if (km < bestKm) { bestKm = km; bestIdx = i; }
    }
    const [next] = remaining.splice(bestIdx, 1);
    out.push(next);
    cur = next.place.position;
  }
  return out;
}
