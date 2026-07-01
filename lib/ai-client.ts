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

/** Turn a free-text trip description into a structured trip (destinations + preferences). */
export async function composeTrip(text: string): Promise<ComposedTrip | null> {
  const data = await callFn<{ trip: ComposedTrip }>("ai", { action: "compose", text });
  return data?.trip && data.trip.destinations?.length ? data.trip : null;
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
  refKeys: string[],
  history: AIMessage[],
  message: string
): Promise<PlanResult | null> {
  const data = await callFn<PlanResult>("ai", { action: "plan", trip, scheduleText, weatherText, refKeys, messages: history, message });
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
