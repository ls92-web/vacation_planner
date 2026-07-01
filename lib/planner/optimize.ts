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

const inDay = (it: ItineraryItem, key: string, day: number) => cityKey(it.destId || "") === key && it.day === day;

/** Parse the closing hour (0–24) from a "9:00 AM – 6:00 PM" string, else null. */
export function closingHour(h?: string): number | null {
  if (!h) return null;
  if (/24\s*hours|open\s*24/i.test(h)) return 24;
  const times = [...h.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi)];
  if (!times.length) return null;
  const m = times[times.length - 1];
  let hr = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) hr += 12;
  return hr + (m[2] ? Number(m[2]) / 60 : 0);
}

/** Move the last stop of an overpacked day to a lighter day — instantly. */
export function lightenDay(itinerary: ItineraryItem[], destId: string, fromDay: number, toDay: number): { items: ItineraryItem[]; movedName: string } | null {
  const key = cityKey(destId);
  const from = visitingOrder(itinerary.filter((it) => inDay(it, key, fromDay)));
  if (from.length < 2) return null;
  const moved = from[from.length - 1];
  const targetMaxPos = itinerary.filter((it) => inDay(it, key, toDay)).reduce((m, it) => Math.max(m, it.position), -1);
  const items = itinerary.map((it) =>
    it.place.id === moved.place.id && inDay(it, key, fromDay) ? { ...it, day: toDay, position: targetMaxPos + 1 } : it
  );
  return { items, movedName: moved.place.name };
}

/** Move an early-closing evening stop into the day's lighter earlier slot — instantly. */
export function fixTiming(itinerary: ItineraryItem[], destId: string, day: number): { items: ItineraryItem[]; movedName: string; slot: "morning" | "afternoon" } | null {
  const key = cityKey(destId);
  const dayItems = itinerary.filter((it) => inDay(it, key, day));
  const clash = dayItems.find((it) => it.slot === "evening" && (() => { const c = closingHour(it.place.hours); return c != null && c <= 17.5; })());
  if (!clash) return null;
  const nMorning = dayItems.filter((it) => it.slot === "morning").length;
  const nAfternoon = dayItems.filter((it) => it.slot === "afternoon").length;
  const slot: "morning" | "afternoon" = nMorning <= nAfternoon ? "morning" : "afternoon";
  const maxPos = dayItems.filter((it) => it.slot === slot).reduce((m, it) => Math.max(m, it.position), -1);
  const items = itinerary.map((it) =>
    it.place.id === clash.place.id && inDay(it, key, day) ? { ...it, slot, position: maxPos + 1 } : it
  );
  return { items, movedName: clash.place.name, slot };
}
