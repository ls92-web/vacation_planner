"use client";

import type { Destination } from "@/lib/types";
import type { ItineraryItem } from "@/lib/places";
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
  kind: "empty" | "busy" | "weather" | "budget" | "transport";
  text: string;
  actionLabel: string;
  message: string;
}

const cityKey = (n: string) => n.split(",")[0].trim().toLowerCase();
const durH = (t: string) => { const h = /(\d+)\s*h/.exec(t); return h ? Number(h[1]) : 0; };

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

  const rank: Insight["kind"][] = ["busy", "weather", "budget", "transport"];
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
