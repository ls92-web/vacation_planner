"use client";

import type { Destination } from "@/lib/types";
import { nightsBetween } from "@/lib/data";
import { loadWeather } from "./client";
import { describeWeather } from "./codes";

// ===== Weather signal for the AI workspace. =====
// Turns each destination's forecast into a compact per-day text block the
// companion reasons over (heat/rain vs each stop's indoor/outdoor type and
// opening hours), plus a per-global-day map the UI shows. Client-safe: reuses
// the cached loadWeather() (keyless Open-Meteo via the geo-weather function).

/** WMO codes that mean meaningful precipitation (rain, drizzle, snow, storms). */
export const isWetCode = (c: number) => (c >= 51 && c <= 67) || (c >= 71 && c <= 86) || (c >= 95 && c <= 99);

export interface DaySignal {
  globalDay: number;
  city: string;
  tMax: number;
  tMin: number;
  code: number;
  label: string;
  precip: number;
  hot: boolean;
  rain: boolean;
  seasonal: boolean;
}

export interface WeatherContext {
  /** Compact block for the AI prompt ("" when no coords/forecast available). */
  text: string;
  /** Signal per continuous global day (1-based), for the itinerary UI. */
  byDay: Map<number, DaySignal>;
}

const cityName = (n: string) => n.split(",")[0].trim();

/** Build the per-day weather signal for a trip's saved destinations (in travel order). */
export async function buildWeatherContext(destinations: Destination[]): Promise<WeatherContext> {
  const saved = destinations.filter((d) => d.saved && d.name.trim());
  const byDay = new Map<number, DaySignal>();
  const lines: string[] = [];
  let offset = 0;

  for (const d of saved) {
    const nights = Math.max(1, nightsBetween(d.arrive, d.depart) || 1);
    const city = cityName(d.name);
    const hasCoords = typeof d.lat === "number" && typeof d.lng === "number" && !(d.lat === 0 && d.lng === 0);
    if (hasCoords) {
      const w = await loadWeather(d.lat as number, d.lng as number, d.arrive || "", d.depart || "").catch(() => null);
      if (w) {
        // Near-term dates return per-day forecasts; far-future dates return only a
        // seasonal summary (days: []) — fall back to that so every day still has a signal.
        const seasonalDay = w.summary ? { date: "", tMax: w.summary.tMax, tMin: w.summary.tMin, code: w.summary.code, precip: w.summary.precip } : null;
        for (let i = 0; i < nights; i++) {
          const globalDay = offset + i + 1;
          const wd = w.days[i] ?? w.days[w.days.length - 1] ?? seasonalDay;
          if (!wd) continue;
          const label = describeWeather(wd.code).label;
          const hot = wd.tMax >= 30;
          const rain = isWetCode(wd.code) || wd.precip >= 50;
          const seasonal = w.mode === "seasonal";
          byDay.set(globalDay, { globalDay, city, tMax: wd.tMax, tMin: wd.tMin, code: wd.code, label, precip: wd.precip, hot, rain, seasonal });
          const bits = [`${Math.round(wd.tMax)}°C`, label.toLowerCase()];
          if (hot) bits.push("hot");
          if (rain) bits.push(wd.precip ? `rain likely (~${Math.round(wd.precip)}%)` : "rain likely");
          lines.push(`Day ${globalDay} (${city}): ${bits.join(", ")}${seasonal ? " (seasonal average)" : ""}.`);
        }
      }
    }
    offset += nights;
  }

  const text = lines.length
    ? "WEATHER (per day — weigh heat/rain against each stop's indoor/outdoor type and opening hours):\n" + lines.join("\n")
    : "";
  return { text, byDay };
}
