"use client";

import type { Destination } from "@/lib/types";
import type { ItineraryItem, ExplorePlace } from "@/lib/places";
import { haversineKm } from "@/lib/places";
import { recommend, MODE_TEMPLATES } from "@/lib/data";
import { dayStructure, venueEnv } from "./schedulePlan";
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
  kind: "empty" | "busy" | "hours" | "weather" | "route" | "cluster" | "budget" | "transport";
  text: string;
  actionLabel: string;
  message: string;
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

/** Parse the closing hour (0–24) from a "9:00 AM – 6:00 PM" style string, else null. */
function closingHour(h?: string): number | null {
  if (!h) return null;
  if (/24\s*hours|open\s*24/i.test(h)) return 24;
  const times = [...h.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi)];
  if (!times.length) return null;
  const m = times[times.length - 1];
  let hr = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) hr += 12;
  return hr + (m[2] ? Number(m[2]) / 60 : 0);
}

const fmtHour = (h: number) => {
  const hr = Math.floor(h) % 12 || 12;
  const ampm = h < 12 || h >= 24 ? "am" : "pm";
  return `${hr}${ampm}`;
};

/** Total path length in visiting order. */
function pathKm(pts: { lat: number; lng: number }[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += haversineKm(pts[i - 1], pts[i]);
  return s;
}

/** Greedy nearest-neighbour path length from the first stop — a cheap "efficient order" baseline. */
function greedyKm(pts: { lat: number; lng: number }[]): number {
  const rem = pts.slice(1);
  let cur = pts[0];
  let s = 0;
  while (rem.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < rem.length; i++) {
      const d = haversineKm(cur, rem[i]);
      if (d < bd) { bd = d; bi = i; }
    }
    s += bd;
    cur = rem.splice(bi, 1)[0];
  }
  return s;
}

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
        out.push({ id: `busy-${g}`, kind: "busy", text: `Day ${g} has ${dayItems.length} stops — a little packed for a good day.`, actionLabel: "Ease it up", message: `Make day ${g} less busy` });
      }

      // Opening-hours conflict: an evening stop that closes before evening.
      const ordered = [...dayItems].sort((a, b) => a.position - b.position);
      const clash = ordered.find((it) => it.slot === "evening" && (() => { const c = closingHour(it.place.hours); return c != null && c <= 17.5; })());
      if (clash) {
        const c = closingHour(clash.place.hours)!;
        out.push({ id: `hours-${g}`, kind: "hours", text: `Day ${g}: ${clash.place.name} is set for the evening but closes around ${fmtHour(c)}. Move it earlier?`, actionLabel: "Fix timing", message: `On day ${g}, ${clash.place.name} closes before evening — move it to the morning or afternoon` });
      }

      // Route backtracking: current visiting order zigzags vs an efficient order.
      const pts = ordered.map((it) => it.place.position).filter((p): p is { lat: number; lng: number } => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (pts.length >= 3) {
        const cur = pathKm(pts), opt = greedyKm(pts);
        if (cur > opt * 1.4 && cur - opt >= 3) {
          out.push({ id: `route-${g}`, kind: "route", text: `Day ${g} crosses town more than it needs to — I can reorder it to cut about ${Math.round(cur - opt)} km of backtracking.`, actionLabel: "Optimise route", message: `Reorder day ${g}'s stops into an efficient geographic order to cut backtracking` });
        }
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
        out.push({ id: `cluster-${g}`, kind: "cluster", text: `Day ${g} is heavy on ${heavy.label} (${heavy.n} of them) — mixing in something different keeps it fresh.`, actionLabel: "Add variety", message: `Day ${g} leans heavily on ${heavy.label} — add more variety with a different kind of stop` });
      }
      if (w?.hot && outdoor > 0) {
        out.push({ id: `hot-${g}`, kind: "weather", text: `Day ${g} looks hot (${Math.round(w.tMax)}°) with ${outdoor} outdoor stop${outdoor > 1 ? "s" : ""}. I can move them to cooler hours.`, actionLabel: "Optimise for heat", message: `It's hot on day ${g} — move the outdoor stops to cooler morning or evening times` });
      } else if (w?.rain && outdoor > 0) {
        out.push({ id: `rain-${g}`, kind: "weather", text: `Rain is likely on day ${g}. Want me to favour indoor stops and keep a backup?`, actionLabel: "Plan for rain", message: `Rain is likely on day ${g} — favour indoor stops and suggest an indoor backup` });
      }
      const premium = b?.premium ?? 0;
      if (budgetLevel === "budget" ? premium >= 1 : premium >= 2) {
        out.push({ id: `budget-${g}`, kind: "budget", text: `Day ${g} stacks ${premium} pricey stop${premium > 1 ? "s" : ""} for a ${budgetLevel} trip.`, actionLabel: "Trim the cost", message: `Trim day ${g}'s budget — swap the pricey spots for well-rated cheaper local ones` });
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

  const rank: Insight["kind"][] = ["busy", "hours", "weather", "route", "budget", "cluster", "transport"];
  out.sort((a, b) => rank.indexOf(a.kind) - rank.indexOf(b.kind));
  return out.slice(0, max);
}

/** Context-aware quick actions for the composer — the "next logical step" chips. */
export function nextActions(saved: Destination[], itinerary: ItineraryItem[]): string[] {
  const dests = saved.filter((d) => d.saved && d.name.trim());
  if (!itinerary.length) {
    return ["Plan my days", "What should we do there?", dests.length > 1 ? "Optimise the route" : "Add another city", "Surprise me"];
  }
  return ["Find hidden gems", "Optimise for the weather", "Add a rest day", "Make it more local"];
}
