"use client";

import { SLOTS, haversineKm, type ItineraryItem } from "@/lib/places";

// ===== Deterministic route optimisation =====
// A real, instant, client-side reorder — no AI round-trip. It reorders one day's
// stops into an efficient nearest-neighbour path (anchored on the first stop),
// while preserving the day's morning/afternoon/evening rhythm (the slot at each
// position is kept, only *which* stop sits there changes). Returns the km saved.

const cityKey = (n: string) => n.split(",")[0].trim().toLowerCase();
const coord = (it: ItineraryItem) => it.place.position;
const valid = (p?: { lat: number; lng: number }) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0);

function pathKm(items: ItineraryItem[]): number {
  let s = 0;
  for (let i = 1; i < items.length; i++) s += haversineKm(coord(items[i - 1]), coord(items[i]));
  return s;
}

/** Nearest-neighbour ordering, keeping the first stop as the anchor. */
function greedyOrder(items: ItineraryItem[]): ItineraryItem[] {
  const rem = items.slice(1);
  const out = [items[0]];
  let cur = items[0];
  while (rem.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < rem.length; i++) {
      const d = haversineKm(coord(cur), coord(rem[i]));
      if (d < bd) { bd = d; bi = i; }
    }
    cur = rem.splice(bi, 1)[0];
    out.push(cur);
  }
  return out;
}

/** The current visiting order of a day (slot, then position). */
export function visitingOrder(dayItems: ItineraryItem[]): ItineraryItem[] {
  return [...dayItems].sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.position - b.position);
}

/** How much backtracking the current order carries vs an efficient one (km). */
export function backtrackKm(dayItems: ItineraryItem[]): number {
  const seq = visitingOrder(dayItems).filter((it) => valid(coord(it)));
  if (seq.length < 3) return 0;
  return Math.max(0, pathKm(seq) - pathKm(greedyOrder(seq)));
}

/**
 * Reorder one day for efficiency. Returns the full itinerary with that day
 * replaced, plus km saved — or null if there's nothing worth doing.
 */
export function optimizeDay(itinerary: ItineraryItem[], destId: string, day: number): { items: ItineraryItem[]; savedKm: number } | null {
  const key = cityKey(destId);
  const dayItems = itinerary.filter((it) => cityKey(it.destId || "") === key && it.day === day);
  const seq = visitingOrder(dayItems);
  if (seq.filter((it) => valid(coord(it))).length < 3) return null;

  const optSeq = greedyOrder(seq);
  const savedKm = pathKm(seq) - pathKm(optSeq);
  if (savedKm <= 0.3) return null; // already efficient — don't churn the plan

  // Keep the slot at each position; only the stop occupying it changes.
  const slotSeq = seq.map((it) => it.slot);
  const reordered = optSeq.map((it, i) => ({ ...it, slot: slotSeq[i], position: i }));
  const rest = itinerary.filter((it) => !(cityKey(it.destId || "") === key && it.day === day));
  return { items: [...rest, ...reordered], savedKm };
}
