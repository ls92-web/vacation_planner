import type { DayPlan, Stop } from "@/lib/types";
import { getProvider } from "./provider";
import {
  assistantMessages,
  insightsMessages,
  itineraryMessages,
  recommendationMessages,
  type TripContext,
} from "./prompts";
import { AIRequestError, type AIMessage } from "./types";

// ===== High-level AI service. Every AI feature in the app goes through here. =====

/** Pull the first balanced JSON object/array out of a model response (handles ```json fences and stray prose). */
function extractJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced ? fenced[1] : raw).trim();
  const start = text.search(/[[{]/);
  if (start === -1) throw new AIRequestError("No JSON found in model response");
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1)) as T;
    }
  }
  throw new AIRequestError("Incomplete JSON in model response");
}

// ----- Travel assistant (streaming) -----

export function streamAssistant(ctx: TripContext, history: AIMessage[]): AsyncGenerator<string> {
  return getProvider().stream({ messages: assistantMessages(ctx, history), temperature: 0.6, maxTokens: 700 });
}

// ----- Itinerary generation -----

const VALID_EMOJI = new Set(["landmark", "fish", "flask"]);

function normalizeStop(s: Record<string, unknown>, i: number, total: number): Stop {
  const last = i === total - 1;
  const pct = (v: unknown, fallback: number) => {
    const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
    const clamped = Number.isFinite(n) ? Math.min(92, Math.max(8, n)) : fallback;
    return `${clamped}%`;
  };
  return {
    time: String(s.time ?? ""),
    title: String(s.title ?? "Stop"),
    cat: String(s.cat ?? "Stop"),
    kid: Boolean(s.kid),
    age: String(s.age ?? "All ages"),
    hours: String(s.hours ?? ""),
    duration: String(s.duration ?? ""),
    blurb: String(s.blurb ?? ""),
    dist: last ? 0 : Number(s.dist) || 0,
    mode: last ? "" : String(s.mode ?? "Walk"),
    travelTime: last ? "" : String(s.travelTime ?? ""),
    x: pct(s.x, 20 + (i * 60) / Math.max(1, total - 1)),
    y: pct(s.y, 25 + ((i % 3) * 50) / 2),
  };
}

export async function generateItinerary(ctx: TripContext, signal?: AbortSignal): Promise<DayPlan[]> {
  const raw = await getProvider().chat({ messages: itineraryMessages(ctx), temperature: 0.5, maxTokens: 2200, json: true, signal });
  const parsed = extractJson<{ days?: unknown[] }>(raw);
  const days = Array.isArray(parsed.days) ? parsed.days : [];
  const result: DayPlan[] = days.map((d, di) => {
    const day = d as Record<string, unknown>;
    const stops = Array.isArray(day.stops) ? (day.stops as Record<string, unknown>[]) : [];
    const emoji = String(day.emoji ?? "");
    return {
      day: String(day.day ?? `Day ${di + 1}`),
      date: String(day.date ?? ""),
      meta: String(day.meta ?? ""),
      emoji: VALID_EMOJI.has(emoji) ? emoji : "landmark",
      title: String(day.title ?? ""),
      note: String(day.note ?? ""),
      stops: stops.map((s, i) => normalizeStop(s, i, stops.length)),
    };
  });
  if (!result.length || !result.some((d) => d.stops.length)) {
    throw new AIRequestError("Model returned an empty itinerary");
  }
  return result;
}

// ----- Recommendations -----

export interface Recommendation {
  name: string;
  ai: number;
  why: string;
}

export async function recommendPlaces(
  ctx: TripContext,
  candidates: { name: string; category: string }[],
  signal?: AbortSignal
): Promise<Recommendation[]> {
  const raw = await getProvider().chat({
    messages: recommendationMessages(ctx, candidates),
    temperature: 0.3,
    maxTokens: 1200,
    json: true,
    signal,
  });
  const parsed = extractJson<{ recommendations?: unknown[] }>(raw);
  const recs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  return recs
    .map((r) => {
      const o = r as Record<string, unknown>;
      const ai = Math.round(Number(o.ai));
      return { name: String(o.name ?? ""), ai: Number.isFinite(ai) ? Math.min(100, Math.max(0, ai)) : 0, why: String(o.why ?? "") };
    })
    .filter((r) => r.name);
}

// ----- Planning insights -----

export async function planningInsights(ctx: TripContext, signal?: AbortSignal): Promise<string[]> {
  const raw = await getProvider().chat({ messages: insightsMessages(ctx), temperature: 0.5, maxTokens: 500, json: true, signal });
  const parsed = extractJson<{ insights?: unknown[] }>(raw);
  const insights = Array.isArray(parsed.insights) ? parsed.insights : [];
  return insights.map((t) => String(t)).filter(Boolean).slice(0, 4);
}
