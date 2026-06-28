"use client";

import type { DayPlan } from "./types";
import type { Recommendation, TripContext, AIMessage } from "./ai";
import { getSupabase } from "./supabase/client";

// ===== Browser helpers that call the server AI routes. =====
// Each returns null / throws on failure so callers can fall back to the
// built-in simulated behavior — the app always works, with or without a key.

// The AI routes require a valid session (they spend a paid server-side key), so
// every request carries the user's Supabase access token.
async function authHeaders(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null; // 401/429/503/502 → fall back to built-in behavior
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchItinerary(context: TripContext): Promise<DayPlan[] | null> {
  const data = await postJson<{ days: DayPlan[] }>("/api/ai/itinerary", { context });
  return data?.days?.length ? data.days : null;
}

export async function fetchInsights(context: TripContext): Promise<string[] | null> {
  const data = await postJson<{ insights: string[] }>("/api/ai/insights", { context });
  return data?.insights?.length ? data.insights : null;
}

export async function fetchRecommendations(
  context: TripContext,
  candidates: { name: string; category: string }[]
): Promise<Recommendation[] | null> {
  const data = await postJson<{ recommendations: Recommendation[] }>("/api/ai/recommendations", { context, candidates });
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
  const res = await fetch("/api/ai/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ context, messages }),
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
