import { chat, streamDeltas } from "./openrouter.ts";
import { assistantMessages, composeMessages, insightsMessages, itineraryMessages, planMessages, recommendationMessages, refineMessages, type TripContext } from "./prompts.ts";
import type { AIMessage } from "./openrouter.ts";

function extractJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced ? fenced[1] : raw).trim();
  const start = text.search(/[\[{]/);
  if (start === -1) throw new Error("No JSON found");
  const open = text[start]; const close = open === "{" ? "}" : "]";
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; }
    else if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return JSON.parse(text.slice(start, i + 1)) as T; }
  }
  throw new Error("Incomplete JSON");
}

export function streamAssistant(ctx: TripContext, history: AIMessage[]) {
  return streamDeltas({ messages: assistantMessages(ctx, history), temperature: 0.6, maxTokens: 700 });
}

const VALID_EMOJI = new Set(["landmark", "fish", "flask"]);
function normalizeStop(s: Record<string, unknown>, i: number, total: number) {
  const last = i === total - 1;
  const pct = (v: unknown, fb: number) => { const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN; const cl = Number.isFinite(n) ? Math.min(92, Math.max(8, n)) : fb; return `${cl}%`; };
  return { time: String(s.time ?? ""), title: String(s.title ?? "Stop"), cat: String(s.cat ?? "Stop"), kid: Boolean(s.kid), age: String(s.age ?? "All ages"), hours: String(s.hours ?? ""), duration: String(s.duration ?? ""), blurb: String(s.blurb ?? ""), dist: last ? 0 : Number(s.dist) || 0, mode: last ? "" : String(s.mode ?? "Walk"), travelTime: last ? "" : String(s.travelTime ?? ""), x: pct(s.x, 20 + (i * 60) / Math.max(1, total - 1)), y: pct(s.y, 25 + ((i % 3) * 50) / 2) };
}
export async function generateItinerary(ctx: TripContext) {
  const raw = await chat({ messages: itineraryMessages(ctx), temperature: 0.5, maxTokens: 2200, json: true });
  const parsed = extractJson<{ days?: unknown[] }>(raw);
  const days = Array.isArray(parsed.days) ? parsed.days : [];
  const result = days.map((d, di) => { const day = d as Record<string, unknown>; const stops = Array.isArray(day.stops) ? (day.stops as Record<string, unknown>[]) : []; const emoji = String(day.emoji ?? ""); return { day: String(day.day ?? `Day ${di + 1}`), date: String(day.date ?? ""), meta: String(day.meta ?? ""), emoji: VALID_EMOJI.has(emoji) ? emoji : "landmark", title: String(day.title ?? ""), note: String(day.note ?? ""), stops: stops.map((s, i) => normalizeStop(s, i, stops.length)) }; });
  if (!result.length || !result.some((d) => d.stops.length)) throw new Error("empty itinerary");
  return result;
}
export async function recommendPlaces(ctx: TripContext, candidates: { name: string; category: string }[]) {
  const raw = await chat({ messages: recommendationMessages(ctx, candidates), temperature: 0.3, maxTokens: 1200, json: true });
  const parsed = extractJson<{ recommendations?: unknown[] }>(raw);
  const recs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  return recs.map((r) => { const o = r as Record<string, unknown>; const ai = Math.round(Number(o.ai)); return { name: String(o.name ?? ""), ai: Number.isFinite(ai) ? Math.min(100, Math.max(0, ai)) : 0, why: String(o.why ?? "") }; }).filter((r) => r.name);
}
const TRAVELLER = new Set(["family", "couple", "friends", "solo", "business", "mixed"]);
const STYLE = new Set(["relaxed", "balanced", "packed"]);
const INTERESTS = new Set(["attractions", "museums", "nature", "shopping", "restaurants", "cafes", "beaches", "themeparks", "historical", "local", "photography", "kids"]);
const ACCESS = new Set(["stroller", "wheelchair", "lessWalking", "indoor", "outdoor", "noLateNight"]);

/** Validate + clamp a model-produced trip object into the canonical shape. */
function normalizeTrip(p: Record<string, unknown>) {
  const destsRaw = Array.isArray(p.destinations) ? (p.destinations as Record<string, unknown>[]) : [];
  const destinations = destsRaw
    .map((d) => ({ city: String(d.city ?? "").trim(), country: String(d.country ?? "").trim(), nights: Math.max(1, Math.min(30, Math.round(Number(d.nights)) || 2)) }))
    .filter((d) => d.city)
    .slice(0, 6);
  if (!destinations.length) throw new Error("trip: no destinations");

  const prefIn = (p.preferences ?? {}) as Record<string, unknown>;
  const agesIn = (prefIn.ages ?? {}) as Record<string, unknown>;
  const ages: Record<string, number> = {};
  for (const k of ["adults", "children", "toddlers", "seniors"]) { const v = Math.round(Number(agesIn[k])); if (Number.isFinite(v) && v > 0) ages[k] = Math.min(20, v); }
  const preferences: Record<string, unknown> = {};
  if (typeof prefIn.travellerType === "string" && TRAVELLER.has(prefIn.travellerType)) preferences.travellerType = prefIn.travellerType;
  if (typeof prefIn.travelStyle === "string" && STYLE.has(prefIn.travelStyle)) preferences.travelStyle = prefIn.travelStyle;
  if (Object.keys(ages).length) preferences.ages = ages;
  const interests = Array.isArray(prefIn.interests) ? (prefIn.interests as unknown[]).filter((x): x is string => typeof x === "string" && INTERESTS.has(x)) : [];
  if (interests.length) preferences.interests = interests;
  const access = Array.isArray(prefIn.accessibility) ? (prefIn.accessibility as unknown[]).filter((x): x is string => typeof x === "string" && ACCESS.has(x)) : [];
  if (access.length) preferences.accessibility = access;

  return { name: String(p.name ?? "").trim().slice(0, 80) || destinations[0].city, destinations, preferences };
}

/** Parse a free-text trip description into a structured, validated trip. */
export async function composeTrip(text: string) {
  const raw = await chat({ messages: composeMessages(text), temperature: 0.4, maxTokens: 800, json: true });
  return normalizeTrip(extractJson<Record<string, unknown>>(raw));
}

/** Conversationally edit a trip: returns a reply + the (possibly changed) full trip. */
export async function refineTrip(trip: unknown, history: AIMessage[], message: string) {
  const tripJson = JSON.stringify(trip ?? {});
  const safeHistory = (Array.isArray(history) ? history : []).slice(-12).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
  const raw = await chat({ messages: refineMessages(tripJson, safeHistory, message), temperature: 0.4, maxTokens: 1100, json: true });
  const p = extractJson<Record<string, unknown>>(raw);
  const reply = String(p.reply ?? "").trim() || "Done — I've updated your trip.";
  const updated = normalizeTrip((p.trip ?? {}) as Record<string, unknown>);
  const sugsRaw = Array.isArray(p.suggestions) ? (p.suggestions as Record<string, unknown>[]) : [];
  const cities = new Set(updated.destinations.map((d) => d.city.toLowerCase()));
  const suggestions = sugsRaw
    .map((s) => ({ name: String(s.name ?? "").trim(), city: String(s.city ?? "").trim(), why: String(s.why ?? "").trim() }))
    .filter((s) => s.name && cities.has(s.city.toLowerCase()))
    .slice(0, 4);
  return { reply, trip: updated, suggestions };
}

const SLOT_SET = new Set(["morning", "afternoon", "evening"]);
const slotOf = (v: unknown) => (SLOT_SET.has(String(v)) ? String(v) : "morning");
const dayOf = (v: unknown) => Math.max(1, Math.round(Number(v)) || 1);

/** Validate one AI schedule edit op against the set of known stop refs. */
function normalizeScheduleOp(o: Record<string, unknown>, refSet: Set<string>) {
  const op = String(o.op ?? "");
  if (op === "remove") {
    return typeof o.ref === "string" && refSet.has(o.ref) ? { op, ref: o.ref } : null;
  }
  if (op === "move") {
    if (!(typeof o.ref === "string" && refSet.has(o.ref))) return null;
    return { op, ref: o.ref, day: dayOf(o.day), slot: slotOf(o.slot) };
  }
  if (op === "add") {
    const name = String(o.name ?? "").trim();
    if (!name) return null;
    return {
      op,
      name,
      category: String(o.category ?? "").trim() || undefined,
      why: String(o.why ?? "").trim() || undefined,
      durationMin: Number.isFinite(Number(o.durationMin)) ? Math.max(15, Math.min(600, Math.round(Number(o.durationMin)))) : undefined,
      city: String(o.city ?? "").trim(),
      day: dayOf(o.day),
      slot: slotOf(o.slot),
    };
  }
  if (op === "reorder") {
    const refs = Array.isArray(o.refs) ? (o.refs as unknown[]).map(String).filter((r) => refSet.has(r)) : [];
    if (!refs.length) return null;
    return { op, city: String(o.city ?? "").trim(), day: dayOf(o.day), slot: slotOf(o.slot), refs };
  }
  return null;
}

/**
 * The living-itinerary companion: one call that can edit the trip structure
 * and/or the day-by-day schedule and/or suggest places, returning only what
 * changed. `refKeys` are the stable stop ids from the serialized schedule.
 */
export async function planTrip(trip: unknown, scheduleText: string, refKeys: string[], history: AIMessage[], message: string) {
  const tripJson = JSON.stringify(trip ?? {});
  const safeHistory = (Array.isArray(history) ? history : []).slice(-12).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
  const scheduleBlock = typeof scheduleText === "string" && scheduleText.trim() ? scheduleText : "SCHEDULE: empty (no day-by-day plan yet).";
  const raw = await chat({ messages: planMessages(tripJson, scheduleBlock, safeHistory, message), temperature: 0.4, maxTokens: 2000, json: true });
  const p = extractJson<Record<string, unknown>>(raw);

  const reply = String(p.reply ?? "").trim() || "Done.";

  let updated: ReturnType<typeof normalizeTrip> | null = null;
  const tripIn = p.trip;
  if (tripIn && typeof tripIn === "object" && Array.isArray((tripIn as Record<string, unknown>).destinations) && (tripIn as { destinations: unknown[] }).destinations.length) {
    try { updated = normalizeTrip(tripIn as Record<string, unknown>); } catch { updated = null; }
  }

  const refSet = new Set(Array.isArray(refKeys) ? refKeys.map(String) : []);
  let ops: ReturnType<typeof normalizeScheduleOp>[] | null = null;
  if (Array.isArray(p.ops)) {
    const list = (p.ops as Record<string, unknown>[]).map((o) => normalizeScheduleOp(o, refSet)).filter((o): o is NonNullable<typeof o> => !!o).slice(0, 60);
    ops = list.length ? list : null;
  }

  const cityList = (updated ?? (trip as { destinations?: { city: string }[] } | null))?.destinations ?? [];
  const cities = new Set(cityList.map((d) => String(d.city).toLowerCase()));
  const suggestions = Array.isArray(p.suggestions)
    ? (p.suggestions as Record<string, unknown>[])
        .map((s) => ({ name: String(s.name ?? "").trim(), city: String(s.city ?? "").trim(), why: String(s.why ?? "").trim() }))
        .filter((s) => s.name && cities.has(s.city.toLowerCase()))
        .slice(0, 4)
    : [];

  return { reply, trip: updated, ops, suggestions };
}

export async function planningInsights(ctx: TripContext) {
  const raw = await chat({ messages: insightsMessages(ctx), temperature: 0.5, maxTokens: 500, json: true });
  const parsed = extractJson<{ insights?: unknown[] }>(raw);
  const insights = Array.isArray(parsed.insights) ? parsed.insights : [];
  return insights.map((t) => String(t)).filter(Boolean).slice(0, 4);
}
