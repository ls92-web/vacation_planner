"use client";

import type { Destination } from "@/lib/types";
import type { Currency } from "@/lib/budget/estimate";
import { convertCostText } from "@/lib/budget/estimate";
import { recommend, MODE_TEMPLATES } from "@/lib/data";
import { dayStructure } from "./schedulePlan";

type LegMode = keyof typeof MODE_TEMPLATES;

// ===== Transport signal for the AI workspace. =====
// Summarizes each inter-city leg (chosen/recommended mode, duration, cost, which
// day you travel) so the companion can comment on transport, flag long/pricey
// legs, and keep travel/arrival days light — through the same plan/ScheduleOp
// flow. Fully client-side (reuses recommend + MODE_TEMPLATES + the user's saved
// transports). Advisory only; mode changes stay in the route builder / trip.

const cityName = (n: string) => n.split(",")[0].trim();

export interface TransportContext {
  text: string;
}

/** Build the inter-city transport signal (empty for a single-city trip). */
export function buildTransportContext(
  destinations: Destination[],
  transports: Record<string, string>,
  currency: Currency
): TransportContext {
  const saved = destinations.filter((d) => d.saved && d.name.trim());
  if (saved.length < 2) return { text: "" };

  const struct = dayStructure(destinations); // aligned with `saved` order
  const lines: string[] = [];
  for (let i = 1; i < saved.length; i++) {
    const from = saved[i - 1];
    const to = saved[i];
    const rec = recommend(from, to);
    const mode = (transports[rec.key] || rec.recMode) as LegMode;
    const tpl = rec.override && rec.override.mode === mode ? rec.override : MODE_TEMPLATES[mode];
    if (!tpl) continue;
    const arriveDay = (struct[i]?.globalStart ?? 0) + 1;
    const cost = convertCostText(tpl.cost, currency);
    lines.push(`${cityName(from.name)} → ${cityName(to.name)}: ${mode}, ~${tpl.duration}, ${cost} (travel to Day ${arriveDay}).`);
  }

  const text = lines.length
    ? "TRANSPORT (inter-city legs; keep the travel/arrival day light and flag long or pricey legs):\n" + lines.join("\n")
    : "";
  return { text };
}
