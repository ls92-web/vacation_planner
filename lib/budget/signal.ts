"use client";

import type { Destination } from "@/lib/types";
import type { ItineraryItem } from "@/lib/places";
import { nightsBetween } from "@/lib/data";
import { computeBudget, formatMoney, type BudgetLevel, type Currency } from "./estimate";

// ===== Budget signal for the AI workspace. =====
// Gives the companion the trip's budget level + estimate and marks pricey stops
// so it can flag over-budget days and offer cheaper swaps — all through the same
// plan/ScheduleOp pipeline. Fully client-side (reuses computeBudget + place price
// levels from Google Places enrichment). Advisory only.

const cityKey = (n: string) => n.split(",")[0].trim().toLowerCase();

/** "$"–"$$$$" from a Google price level (0 = free). */
export const priceSym = (lvl: number | null | undefined): string =>
  lvl == null ? "" : lvl <= 0 ? "free" : "$".repeat(Math.min(4, Math.max(1, lvl)));

export interface BudgetDaySignal {
  globalDay: number;
  /** Count of premium ($$$–$$$$) stops that day. */
  premium: number;
}

export interface BudgetContext {
  text: string;
  byDay: Map<number, BudgetDaySignal>;
}

/** Build the budget signal: level + estimate, per-day premium counts, and the priciest stops. */
export function buildBudgetContext(
  destinations: Destination[],
  itinerary: ItineraryItem[],
  travelers: number,
  level: BudgetLevel,
  currency: Currency
): BudgetContext {
  const saved = destinations.filter((d) => d.saved && d.name.trim());
  const byDay = new Map<number, BudgetDaySignal>();
  if (!saved.length) return { text: "", byDay };

  const firstKey = cityKey(saved[0].name);
  const pricey: string[] = [];
  let offset = 0;
  let total = 0;

  for (const d of saved) {
    const nights = Math.max(1, nightsBetween(d.arrive, d.depart) || 1);
    const b = computeBudget({ travelers, nights, hotels: d.accoms.length, level });
    total += typeof d.budgetOverride === "number" ? d.budgetOverride : b.total;
    const items = itinerary.filter((it) => (it.destId ? cityKey(it.destId) : firstKey) === cityKey(d.name));
    for (let i = 0; i < nights; i++) {
      const globalDay = offset + i + 1;
      const premium = items.filter((it) => it.day === i && (it.place.priceLevel ?? 0) >= 3).length;
      if (premium) byDay.set(globalDay, { globalDay, premium });
    }
    for (const it of items) {
      const pl = it.place.priceLevel;
      if (pl != null && pl >= 3) pricey.push(`${it.place.name} (${priceSym(pl)})`);
    }
    offset += nights;
  }

  const bits = [
    `BUDGET (level: ${level}${total > 0 ? `, est. ~${formatMoney(total, currency)} total` : ""}). Stops are marked $–$$$$ by price; weigh them against the level (budget = keep most stops cheap; standard = a few splurges are fine; luxury = premium is fine).`,
  ];
  if (pricey.length) bits.push(`Pricier stops: ${pricey.slice(0, 6).join(", ")}.`);
  const dayLines = [...byDay.values()].filter((x) => x.premium >= 2).map((x) => `Day ${x.globalDay}: ${x.premium} premium ($$$+) stops.`);
  if (dayLines.length) bits.push(dayLines.join("\n"));

  return { text: bits.join("\n"), byDay };
}
