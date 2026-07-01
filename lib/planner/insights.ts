"use client";

import type { Destination } from "@/lib/types";
import type { ItineraryItem, ExplorePlace } from "@/lib/places";
import { recommend, MODE_TEMPLATES } from "@/lib/data";
import { dayStructure, venueEnv } from "./schedulePlan";
import { backtrackKm, closingHour } from "./optimize";
import type { DaySignal } from "@/lib/weather/signal";
import type { BudgetDaySignal } from "@/lib/budget/signal";

// ===== Proactive planning intelligence. =====
// Derives the handful of most useful observations the companion should surface
// while planning — the "AI constantly thinks" layer. Pure + client-side; reuses
// the same schedule + weather/budget/transport signals the plan action sees.
// Each insight carries an action message that flows back through the normal
// conversational plan() call, so acting on one is just a pre-written prompt.

export interface Insight {
  id: string;
  kind: "empty" | "busy" | "hours" | "weather" | "route" | "meal" | "cluster" | "thin" | "budget" | "transport";
  text: string;
  actionLabel: string;
  message: string;
  /** Short lower-case clause for the arrival briefing, e.g. "day 2 zig-zags across town". */
  brief?: string;
  /** Present when the fix can be applied instantly + deterministically (no AI round-trip). */
  apply?:
    | { type: "optimizeRoute"; destId: string; day: number; globalDay: number }
    | { type: "lightenDay"; destId: string; day: number; toDay: number; globalDay: number; toGlobalDay: number }
    | { type: "fixTiming"; destId: string; day: number; globalDay: number };
}

/** Does this stop count as food (restaurant / café / bar)? */
function isFood(p: ExplorePlace): boolean {
  const k = placeKind(p);
  return k?.key === "restaurant" || k?.key === "cafe" || k?.key === "bar";
}

const cityKey = (n: string) => n.split(",")[0].trim().toLowerCase();
const durH = (t: string) => { const h = /(\d+)\s*h/.exec(t); return h ? Number(h[1]) : 0; };

/** Coarse "kind" of a place, for same-category clustering ("3 museums today"). */
function placeKind(p: ExplorePlace): { key: string; label: string } | null {
  const hay = [...(p.googleTypes || []), p.category || "", ...(p.tags || [])].join(" ").toLowerCase();
  const has = (...ks: string[]) => ks.some((k) => hay.includes(k));
  if (has("museum")) return { key: "museum", label: "museums" };
  if (has("art_gallery", "gallery")) return { key: "gallery", label: "galleries" };
  if (has("church", "place_of_worship", "synagogue", "mosque", "temple", "cathedral", "basilica")) return { key: "worship", label: "churches & temples" };
  if (has("park", "garden", "national_park")) return { key: "park", label: "parks & gardens" };
  if (has("restaurant", "dining")) return { key: "restaurant", label: "restaurants" };
  if (has("cafe", "coffee", "bakery")) return { key: "cafe", label: "cafés" };
  if (has("bar", "night_club", "nightlife", "pub")) return { key: "bar", label: "bars" };
  if (has("shopping", "store", "mall", "market", "boutique")) return { key: "shopping", label: "shopping stops" };
  return null;
}

const fmtHour = (h: number) => {
  const hr = Math.floor(h) % 12 || 12;
  const ampm = h < 12 || h >= 24 ? "am" : "pm";
  return `${hr}${ampm}`;
};

/** Up to `max` ranked observations for the current plan (busy → weather → budget → transport). */
export function deriveInsights(
  saved: Destination[],
  itinerary: ItineraryItem[],
  weatherByDay: Map<number, DaySignal>,
  budgetByDay: Map<number, BudgetDaySignal>,
  budgetLevel: "budget" | "standard" | "luxury",
  transports: Record<string, string>,
  max = 2
): Insight[] {
  const dests = saved.filter((d) => d.saved && d.name.trim());
  if (!dests.length) return [];

  // Before any schedule exists, the one proactive nudge is to build it.
  if (!itinerary.length) {
    return [{ id: "empty", kind: "empty", text: "I can turn this into a day-by-day plan — sights, food and sensible pacing.", actionLabel: "Plan my days", message: "Plan my days" }];
  }

  const struct = dayStructure(dests);
  const firstKey = struct[0] ? cityKey(struct[0].city) : "";
  const out: Insight[] = [];

  // How full is a typical day? — so we can tell a deliberate light day from a thin one.
  const lenByDay = new Map<string, number>();
  for (const it of itinerary) { const k = `${it.destId ? cityKey(it.destId) : firstKey}#${it.day}`; lenByDay.set(k, (lenByDay.get(k) ?? 0) + 1); }
  const maxDayLen = Math.max(0, ...lenByDay.values());

  // Per-day: busy days, heat/rain clashes, pricey stacks.
  for (const ds of struct) {
    const cityItems = itinerary.filter((it) => (it.destId ? cityKey(it.destId) : firstKey) === cityKey(ds.city));
    for (let d = 0; d < ds.nights; d++) {
      const g = ds.globalStart + d + 1;
      const dayItems = cityItems.filter((it) => it.day === d);
      if (!dayItems.length) continue;
      const outdoor = dayItems.filter((it) => venueEnv(it.place) === "outdoor").length;
      const w = weatherByDay.get(g);
      const b = budgetByDay.get(g);

      if (dayItems.length >= 5) {
        // Find a genuinely lighter day in the same destination to move a stop to → instant "Lighten".
        const dk = cityKey(ds.city);
        let toDay = -1, toCount = Infinity;
        for (let j = 0; j < ds.nights; j++) {
          if (j === d) continue;
          const c = lenByDay.get(`${dk}#${j}`) ?? 0;
          if (c < toCount) { toCount = c; toDay = j; }
        }
        const canLighten = toDay >= 0 && toCount <= dayItems.length - 2;
        out.push({
          id: `busy-${g}`, kind: "busy",
          text: `Day ${g} has ${dayItems.length} stops — a little packed for a good day.`,
          actionLabel: canLighten ? "Lighten it" : "Ease it up",
          message: `Make day ${g} less busy`,
          brief: `day ${g} is pretty packed (${dayItems.length} stops)`,
          ...(canLighten ? { apply: { type: "lightenDay" as const, destId: ds.city, day: d, toDay, globalDay: g, toGlobalDay: ds.globalStart + toDay + 1 } } : {}),
        });
      }

      // Opening-hours conflict: an evening stop that closes before evening.
      const ordered = [...dayItems].sort((a, b) => a.position - b.position);
      const clash = ordered.find((it) => it.slot === "evening" && (() => { const c = closingHour(it.place.hours); return c != null && c <= 17.5; })());
      if (clash) {
        const c = closingHour(clash.place.hours)!;
        out.push({ id: `hours-${g}`, kind: "hours", text: `Day ${g}: ${clash.place.name} is set for the evening but closes around ${fmtHour(c)}. Move it earlier?`, actionLabel: "Fix timing", message: `On day ${g}, ${clash.place.name} closes before evening — move it to the morning or afternoon`, brief: `${clash.place.name} on day ${g} closes before its evening slot`, apply: { type: "fixTiming", destId: ds.city, day: d, globalDay: g } });
      }

      // Route backtracking: how much walking the day wastes vs an efficient order.
      // The fix is applied instantly + deterministically (no AI round-trip).
      const bt = backtrackKm(dayItems);
      if (bt >= 3) {
        out.push({ id: `route-${g}`, kind: "route", text: `Day ${g} zig-zags across town — I can reorder it to cut about ${Math.round(bt)} km of walking, same stops.`, actionLabel: "Apply reorder", message: `Reorder day ${g}'s stops into an efficient geographic order`, brief: `day ${g} zig-zags across town (~${Math.round(bt)} km of extra walking)`, apply: { type: "optimizeRoute", destId: ds.city, day: d, globalDay: g } });
      }

      // Meal gap: a full day with nowhere to eat.
      if (dayItems.length >= 3 && !dayItems.some((it) => isFood(it.place))) {
        out.push({ id: `meal-${g}`, kind: "meal", text: `Day ${g} is full but has no food stop — a well-placed lunch or dinner would round it out.`, actionLabel: "Add a meal", message: `Add a well-rated, well-located lunch or dinner spot to day ${g}`, brief: `day ${g} has no food stop planned` });
      }

      // Under-planned day (a lone stop while the rest of the trip is full).
      if (dayItems.length === 1 && maxDayLen >= 4) {
        out.push({ id: `thin-${g}`, kind: "thin", text: `Day ${g} only has one stop while your other days are full — want me to flesh it out?`, actionLabel: "Flesh it out", message: `Add a couple more well-chosen stops to day ${g} so it feels complete`, brief: `day ${g} is nearly empty` });
      }

      // Same-category clustering: a day leaning heavily on one kind of place.
      const kinds = new Map<string, { label: string; n: number }>();
      for (const it of dayItems) {
        const k = placeKind(it.place);
        if (!k) continue;
        const e = kinds.get(k.key) ?? { label: k.label, n: 0 };
        e.n++;
        kinds.set(k.key, e);
      }
      const heavy = [...kinds.values()].filter((e) => e.n >= 3 && e.n >= dayItems.length - 1).sort((a, b) => b.n - a.n)[0];
      if (heavy) {
        out.push({ id: `cluster-${g}`, kind: "cluster", text: `Day ${g} is heavy on ${heavy.label} (${heavy.n} of them) — mixing in something different keeps it fresh.`, actionLabel: "Add variety", message: `Day ${g} leans heavily on ${heavy.label} — add more variety with a different kind of stop`, brief: `day ${g} leans hard on ${heavy.label}` });
      }
      if (w?.hot && outdoor > 0) {
        out.push({ id: `hot-${g}`, kind: "weather", text: `Day ${g} looks hot (${Math.round(w.tMax)}°) with ${outdoor} outdoor stop${outdoor > 1 ? "s" : ""}. I can move them to cooler hours.`, actionLabel: "Optimise for heat", message: `It's hot on day ${g} — move the outdoor stops to cooler morning or evening times`, brief: `day ${g} is hot (${Math.round(w.tMax)}°) with outdoor stops` });
      } else if (w?.rain && outdoor > 0) {
        out.push({ id: `rain-${g}`, kind: "weather", text: `Rain is likely on day ${g}. Want me to favour indoor stops and keep a backup?`, actionLabel: "Plan for rain", message: `Rain is likely on day ${g} — favour indoor stops and suggest an indoor backup`, brief: `rain's likely on day ${g} with outdoor stops` });
      }
      const premium = b?.premium ?? 0;
      if (budgetLevel === "budget" ? premium >= 1 : premium >= 2) {
        out.push({ id: `budget-${g}`, kind: "budget", text: `Day ${g} stacks ${premium} pricey stop${premium > 1 ? "s" : ""} for a ${budgetLevel} trip.`, actionLabel: "Trim the cost", message: `Trim day ${g}'s budget — swap the pricey spots for well-rated cheaper local ones`, brief: `day ${g} stacks pricey stops for a ${budgetLevel} trip` });
      }
    }
  }

  // Long inter-city legs → keep the arrival day light.
  for (let i = 1; i < dests.length; i++) {
    const from = dests[i - 1], to = dests[i];
    const rec = recommend(from, to);
    const mode = (transports[rec.key] || rec.recMode) as keyof typeof MODE_TEMPLATES;
    const tpl = rec.override && rec.override.mode === mode ? rec.override : MODE_TEMPLATES[mode];
    if (tpl && durH(tpl.duration) >= 4) {
      const g = (struct[i]?.globalStart ?? 0) + 1;
      out.push({ id: `leg-${i}`, kind: "transport", text: `${from.name.split(",")[0]} → ${to.name.split(",")[0]} is a long ${tpl.duration} ${mode.toLowerCase()}. Keep day ${g} light?`, actionLabel: "Lighten arrival", message: `Keep the ${to.name.split(",")[0]} arrival day light and add a short settle-in break` });
      break;
    }
  }

  const rank: Insight["kind"][] = ["hours", "busy", "weather", "route", "meal", "budget", "cluster", "thin", "transport"];
  out.sort((a, b) => rank.indexOf(a.kind) - rank.indexOf(b.kind));
  return out.slice(0, max);
}

/**
 * The Companion's proactive read on the whole itinerary — the assessment it
 * "speaks" the moment you step into a trip. It reasons over the real plan and
 * either flags what stood out (with the one-tap fixes waiting in the insight bar)
 * or, when the plan is genuinely solid, says so and offers to go further. Honest:
 * it never invents problems.
 */
export function deriveBriefing(
  saved: Destination[],
  itinerary: ItineraryItem[],
  weatherByDay: Map<number, DaySignal>,
  budgetByDay: Map<number, BudgetDaySignal>,
  budgetLevel: "budget" | "standard" | "luxury",
  transports: Record<string, string>,
  tripName: string
): string {
  const dests = saved.filter((d) => d.saved && d.name.trim());
  const cities = dests.map((d) => d.name.split(",")[0]).join(", ");

  if (!itinerary.length) {
    return `Your ${tripName} is taking shape — ${cities}. Say the word and I'll turn it into a day-by-day plan with sensible pacing, or tell me what you're in the mood for.`;
  }

  const all = deriveInsights(saved, itinerary, weatherByDay, budgetByDay, budgetLevel, transports, 8).filter((i) => i.kind !== "empty" && i.brief);
  if (!all.length) {
    return `I looked over your ${tripName} and it's in good shape — the pace and the mix of places feel right. Want me to find a hidden gem or two to make it special, or shall we fine-tune anything?`;
  }

  // One clause per kind → a briefing that spans distinct concerns, not the same one twice.
  const seen = new Set<Insight["kind"]>();
  const issues = all.filter((i) => (seen.has(i.kind) ? false : (seen.add(i.kind), true)));
  const clauses = issues.slice(0, 3).map((i) => i.brief!) as string[];
  const joined = clauses.length === 1 ? clauses[0] : `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`;
  const lead = issues.length === 1 ? "one thing stood out" : "a few things stood out";
  return `I looked over your ${tripName} — ${lead}: ${joined}. I've lined up a one-tap fix for each, or just tell me how you'd like to handle them.`;
}

/** Context-aware quick actions for the composer — the "next logical step" chips. */
export function nextActions(saved: Destination[], itinerary: ItineraryItem[]): string[] {
  const dests = saved.filter((d) => d.saved && d.name.trim());
  if (!itinerary.length) {
    return ["Plan my days", "What should we do there?", dests.length > 1 ? "Optimise the route" : "Add another city", "Surprise me"];
  }
  return ["Find hidden gems", "Optimise for the weather", "Add a rest day", "Make it more local"];
}
