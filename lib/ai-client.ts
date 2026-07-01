"use client";

import type { DayPlan, TripPreferences } from "./types";
import type { Recommendation, TripContext, AIMessage } from "./ai";
import type { ScheduleOp } from "./planner/schedulePlan";
import { callFn, fnHeaders, fnUrl } from "./edge";

export interface ComposedTrip {
  name: string;
  destinations: { city: string; country: string; nights: number }[];
  preferences: TripPreferences;
}

/**
 * Result of composing a trip from free text. Distinguishes a *confident* trip
 * from the two failure modes that must NOT create a trip:
 *  - `busy`  — a transient failure (rate-limited, timed out, network / upstream
 *              error). Retrying shortly will likely succeed.
 *  - `empty` — the AI responded but produced nothing we can confidently turn into
 *              a trip (no valid destinations). Retrying won't help; ask the user.
 */
export type ComposeOutcome =
  | { status: "ok"; trip: ComposedTrip }
  | { status: "busy" }
  | { status: "empty" };

/** A trip is only usable if it has at least one destination with a real city name. */
function isConfidentTrip(t: ComposedTrip | undefined | null): t is ComposedTrip {
  return !!t && Array.isArray(t.destinations) && t.destinations.length > 0 &&
    t.destinations.every((d) => typeof d?.city === "string" && d.city.trim().length > 0);
}

/**
 * Turn a free-text trip description into a structured trip (destinations +
 * preferences). Never throws — classifies every outcome so the caller can degrade
 * gracefully (retry on `busy`, ask again on `empty`) and never build a broken trip.
 */
export async function composeTrip(text: string, timeoutMs = 20000): Promise<ComposeOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(fnUrl("ai"), {
      method: "POST",
      headers: await fnHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ action: "compose", text }),
      signal: controller.signal,
    });
    // Any non-2xx (429 rate-limit, 5xx, 401…) is treated as a transient "busy".
    if (!res.ok) return { status: "busy" };
    const data = (await res.json().catch(() => null)) as { trip?: ComposedTrip } | null;
    const trip = data?.trip;
    if (isConfidentTrip(trip)) return { status: "ok", trip };
    // 200 but nothing we can trust → don't fabricate a trip.
    return { status: "empty" };
  } catch {
    // Aborted (timeout) or network error → transient.
    return { status: "busy" };
  } finally {
    clearTimeout(timer);
  }
}

/** A curated place idea the companion surfaces in conversation. */
export interface PlaceSuggestion {
  name: string;
  city: string;
  why: string;
}

export interface RefineResult {
  reply: string;
  trip: ComposedTrip;
  suggestions?: PlaceSuggestion[];
}

/** Conversationally edit a trip: returns the AI reply + the (possibly changed) full trip + optional curated suggestions. */
export async function refineTrip(trip: ComposedTrip, history: AIMessage[], message: string): Promise<RefineResult | null> {
  const data = await callFn<RefineResult>("ai", { action: "refine", trip, messages: history, message });
  return data?.trip?.destinations?.length ? data : null;
}

/** The living-itinerary companion: one call may edit the trip, the day plan, and/or suggest. */
export interface PlanResult {
  reply: string;
  /** Present only if the trip structure changed. */
  trip: ComposedTrip | null;
  /** Present only if the day-by-day schedule changed (minimal edit ops). */
  ops: ScheduleOp[] | null;
  suggestions?: PlaceSuggestion[];
}

export async function planTrip(
  trip: ComposedTrip,
  scheduleText: string,
  weatherText: string,
  budgetText: string,
  transportText: string,
  refKeys: string[],
  history: AIMessage[],
  message: string
): Promise<PlanResult | null> {
  const data = await callFn<PlanResult>("ai", { action: "plan", trip, scheduleText, weatherText, budgetText, transportText, refKeys, messages: history, message });
  return data && typeof data.reply === "string" ? data : null;
}

// ===== Browser helpers that call the `ai` Supabase Edge Function. =====
// Each returns null / throws on failure so callers fall back to the built-in
// simulated behavior — the app always works, with or without an AI key. The edge
// function requires a signed-in user; callFn/fnHeaders attach the session token.

export async function fetchItinerary(context: TripContext): Promise<DayPlan[] | null> {
  const data = await callFn<{ days: DayPlan[] }>("ai", { action: "itinerary", context });
  return data?.days?.length ? data.days : null;
}

export async function fetchInsights(context: TripContext): Promise<string[] | null> {
  const data = await callFn<{ insights: string[] }>("ai", { action: "insights", context });
  return data?.insights?.length ? data.insights : null;
}

export async function fetchRecommendations(
  context: TripContext,
  candidates: { name: string; category: string }[]
): Promise<Recommendation[] | null> {
  const data = await callFn<{ recommendations: Recommendation[] }>("ai", { action: "recommendations", context, candidates });
  return data?.recommendations?.length ? data.recommendations : null;
}

/**
 * Stream the travel assistant reply, calling onDelta with the full text so far.
 * Resolves with the final text; throws if the endpoint is unavailable/empty so
 * the caller can substitute a canned reply.
 */
export async function streamAssistantReply(
  context: TripContext,
  messages: AIMessage[],
  onDelta: (full: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(fnUrl("ai"), {
    method: "POST",
    headers: await fnHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ action: "assistant", context, messages }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`assistant unavailable (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) {
      full += chunk;
      onDelta(full);
    }
  }
  if (!full.trim()) throw new Error("empty assistant reply");
  return full;
}
