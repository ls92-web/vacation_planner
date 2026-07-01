import type { Destination } from "@/lib/types";
import type { ExplorePlace, ItineraryItem, Slot } from "@/lib/places";
import { SLOTS } from "@/lib/places";
import { nightsBetween } from "@/lib/data";

// ===== The living-itinerary editing engine (pure, reusable). =====
// One editing workflow that any feature can drive: serialize the current
// schedule into a compact, ref-addressable form for the AI, then map the AI's
// returned plan back onto real ItineraryItems — preserving each place object
// (coords/photos/durations) by reference so user choices survive edits.
// Future features (weather, budget, opening-hour conflicts, transport) emit the
// same SchedulePlanEntry[] shape and reuse applySchedulePlan().

const cityKey = (n: string) => n.split(",")[0].trim().toLowerCase();
const cityName = (n: string) => n.split(",")[0].trim();
const destDays = (d: Destination) => Math.max(1, nightsBetween(d.arrive, d.depart) || 1);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const INDOOR_TYPES = ["museum", "art_gallery", "restaurant", "cafe", "bar", "shopping_mall", "store", "aquarium", "movie_theater", "spa", "library", "church", "book_store", "night_club"];
const OUTDOOR_TYPES = ["park", "tourist_attraction", "natural_feature", "beach", "zoo", "amusement_park", "stadium", "campground", "hiking_area", "garden", "plaza"];

/** Best-effort indoor/outdoor classification, so weather reasoning knows a stop's exposure. */
export function venueEnv(place: ExplorePlace): "indoor" | "outdoor" | "" {
  if (place.indoor === true) return "indoor";
  const types = place.googleTypes ?? [];
  if (types.some((t) => INDOOR_TYPES.includes(t))) return "indoor";
  if (types.some((t) => OUTDOOR_TYPES.includes(t))) return "outdoor";
  const cat = `${place.category} ${place.name}`.toLowerCase();
  if (/museum|gallery|restaurant|caf|bar|mall|shop|aquarium|indoor|break|theat|spa|church/.test(cat)) return "indoor";
  if (/park|beach|garden|market|outdoor|hike|view|monument|square|tower|bridge|walk/.test(cat)) return "outdoor";
  return "";
}

/** One destination's slice of the continuous day timeline (globalStart is 0-based). */
export interface DayStructure {
  destId: string;
  city: string;
  country: string;
  nights: number;
  globalStart: number;
  lat?: number;
  lng?: number;
}

/** Ordered per-destination day structure with cumulative global day offsets. */
export function dayStructure(destinations: Destination[]): DayStructure[] {
  const saved = destinations.filter((d) => d.saved && d.name.trim());
  let offset = 0;
  return saved.map((d) => {
    const nights = destDays(d);
    const entry: DayStructure = {
      destId: cityName(d.name),
      city: cityName(d.name),
      country: d.country,
      nights,
      globalStart: offset,
      lat: typeof d.lat === "number" ? d.lat : undefined,
      lng: typeof d.lng === "number" ? d.lng : undefined,
    };
    offset += nights;
    return entry;
  });
}

export interface SerializedSchedule {
  /** Human/AI-readable snapshot of the current day plan, with stable [ref] ids. */
  text: string;
  /** ref id → the exact ItineraryItem it stands for (so edits preserve the place). */
  refMap: Record<string, ItineraryItem>;
}

/**
 * Serialize the schedule for the AI. Each stop gets a short stable ref (a1, a2…)
 * mapped back to its ItineraryItem, so the model can reference existing stops
 * without us shipping opaque place ids or risking the model mangling them.
 */
export function serializeSchedule(destinations: Destination[], itinerary: ItineraryItem[]): SerializedSchedule {
  const struct = dayStructure(destinations);
  const refMap: Record<string, ItineraryItem> = {};
  if (!struct.length) return { text: "SCHEDULE: no destinations yet.", refMap };

  let counter = 0;
  const nextRef = () => `a${++counter}`;
  const firstKey = cityKey(struct[0].city);
  const lines: string[] = [];
  let any = false;

  for (const ds of struct) {
    for (let d = 0; d < ds.nights; d++) {
      const globalDay = ds.globalStart + d + 1;
      const dayItems = itinerary.filter((it) => (it.destId ? cityKey(it.destId) : firstKey) === cityKey(ds.city) && it.day === d);
      const slotStrs: string[] = [];
      for (const slot of SLOTS) {
        const items = dayItems.filter((it) => it.slot === slot).sort((a, b) => a.position - b.position);
        if (!items.length) continue;
        any = true;
        const refs = items.map((it) => {
          const r = nextRef();
          refMap[r] = it;
          const dur = it.durationMin ?? it.place.estDurationMin;
          const env = venueEnv(it.place);
          const pl = it.place.priceLevel;
          const price = pl == null ? "" : pl <= 0 ? ", free" : `, ${"$".repeat(Math.min(4, Math.max(1, pl)))}`;
          const hrs = it.place.hours ? `, ${it.place.hours}` : "";
          return `[${r}] ${it.place.name} (${dur}m${env ? `, ${env}` : ""}${price}${hrs})`;
        });
        slotStrs.push(`    ${slot}: ${refs.join(", ")}`);
      }
      lines.push(`Day ${globalDay} (${ds.city}):${slotStrs.length ? "\n" + slotStrs.join("\n") : " (empty)"}`);
    }
  }

  const header = any
    ? "SCHEDULE (current day-by-day plan; REUSE the [ref] ids for stops that stay):"
    : "SCHEDULE: empty (no day-by-day plan yet).";
  return { text: `${header}\n${lines.join("\n")}`, refMap };
}

/**
 * An edit operation on the schedule. The AI returns these instead of a whole
 * new plan, so any stop it doesn't mention is left exactly as-is — user choices
 * are preserved by construction. `day` is always the GLOBAL day (1-based).
 * This is the shared edit vocabulary future features (weather, budget,
 * opening-hour conflicts, transport) will emit too.
 */
export type ScheduleOp =
  | { op: "move"; ref: string; day: number; slot: Slot }
  | { op: "remove"; ref: string }
  | { op: "add"; name: string; category?: string; why?: string; durationMin?: number; city: string; day: number; slot: Slot }
  | { op: "reorder"; city: string; day: number; slot: Slot; refs: string[] };

/**
 * Apply schedule edit operations onto the current itinerary.
 *
 * Starts from the existing stops and mutates only what the ops touch: moved
 * stops keep their full ExplorePlace (coords/photo/rating/duration) and just
 * change day/slot; removed stops are dropped; added stops become lightweight
 * curated places; reorder sets the order within one day-slot. Everything else
 * is untouched. Positions are re-sequenced per (destId, day, slot) at the end.
 */
/** Real-place data overlaid onto an added stop (from a Google Places lookup). */
export type AddEnrichment = Partial<ExplorePlace>;

export function applyScheduleOps(
  current: ItineraryItem[],
  ops: ScheduleOp[],
  refMap: Record<string, ItineraryItem>,
  destinations: Destination[],
  /** Optional resolver returning real-place data for an `add` op (by its index in `ops`). */
  enrich?: (index: number) => AddEnrichment | null | undefined
): ItineraryItem[] {
  const struct = dayStructure(destinations);
  if (!struct.length) return current;

  const validSlot = (s: Slot): Slot => (SLOTS.includes(s) ? s : "morning");
  const destForCity = (city: string, globalDay: number): DayStructure => {
    const byCity = struct.find((s) => cityKey(s.city) === cityKey(city));
    if (byCity) return byCity;
    const gd = Math.max(1, globalDay) - 1;
    return struct.find((s) => gd >= s.globalStart && gd < s.globalStart + s.nights) ?? struct[0];
  };
  const localDayIn = (ds: DayStructure, globalDay: number) => Math.max(0, Math.min(ds.nights - 1, Math.max(1, Math.round(globalDay) || 1) - 1 - ds.globalStart));
  const refToId = (ref: string): string | undefined => refMap[ref]?.place.id;

  // Working set keyed by place id, with an ordinal to keep stable ordering.
  const byId = new Map<string, { item: ItineraryItem; ord: number }>();
  current.forEach((it, i) => byId.set(it.place.id, { item: { ...it }, ord: i }));
  let nextOrd = current.length + 1000;
  const reorders = new Map<string, string[]>(); // bucket → desired place-id order

  for (let opIndex = 0; opIndex < ops.length; opIndex++) {
    const op = ops[opIndex];
    if (op.op === "remove") {
      const id = refToId(op.ref);
      if (id) byId.delete(id);
    } else if (op.op === "move") {
      const id = refToId(op.ref);
      const e = id ? byId.get(id) : undefined;
      if (!e) continue;
      const ds = struct.find((s) => cityKey(s.city) === cityKey(e.item.destId)) ?? destForCity("", op.day);
      e.item.destId = ds.destId;
      e.item.day = localDayIn(ds, op.day);
      e.item.slot = validSlot(op.slot);
      e.ord = nextOrd++; // moved stops sort to the end of their new slot unless reordered
    } else if (op.op === "add") {
      if (!op.name) continue;
      const ds = destForCity(op.city, op.day);
      const slot = validSlot(op.slot);
      const ex = enrich?.(opIndex) ?? undefined; // real Google Places data, when available
      const id = ex?.id || `new:${cityKey(ds.city)}:${slugify(op.name)}:${nextOrd}`;
      if (byId.has(id)) continue; // e.g. this place_id is already scheduled
      const place: ExplorePlace = {
        id,
        placeId: ex?.id,
        name: ex?.name || op.name,
        category: op.category || "Recommended",
        position: ex?.position ?? { lat: ds.lat ?? 0, lng: ds.lng ?? 0 },
        rating: ex?.rating,
        reviews: ex?.reviews,
        priceLevel: ex?.priceLevel,
        openNow: ex?.openNow,
        hours: ex?.hours,
        photoUrl: ex?.photoUrl,
        address: ex?.address,
        description: op.why || ex?.description || "",
        tags: [],
        estDurationMin: op.durationMin || 90,
        recommendedSlot: slot,
        googleTypes: ex?.googleTypes,
        source: ex?.source === "google" ? "google" : "curated",
      };
      byId.set(id, { item: { place, destId: ds.destId, day: localDayIn(ds, op.day), slot, position: 0, durationMin: op.durationMin }, ord: nextOrd++ });
    } else if (op.op === "reorder") {
      const ds = destForCity(op.city, op.day);
      const key = `${ds.destId}|${localDayIn(ds, op.day)}|${validSlot(op.slot)}`;
      const ids = op.refs.map(refToId).filter((x): x is string => !!x);
      if (ids.length) reorders.set(key, ids);
    }
  }

  // Re-sequence positions per (destId, day, slot); honour any reorder order.
  const buckets = new Map<string, { item: ItineraryItem; ord: number }[]>();
  for (const e of byId.values()) {
    const key = `${e.item.destId}|${e.item.day}|${e.item.slot}`;
    const list = buckets.get(key) ?? [];
    list.push(e);
    buckets.set(key, list);
  }
  const out: ItineraryItem[] = [];
  for (const [key, arr] of buckets) {
    const order = reorders.get(key);
    arr.sort((a, b) => {
      if (order) {
        const ia = order.indexOf(a.item.place.id);
        const ib = order.indexOf(b.item.place.id);
        const ra = ia === -1 ? 9999 : ia;
        const rb = ib === -1 ? 9999 : ib;
        if (ra !== rb) return ra - rb;
      }
      return a.ord - b.ord;
    });
    arr.forEach((e, i) => out.push({ ...e.item, position: i }));
  }
  return out;
}
