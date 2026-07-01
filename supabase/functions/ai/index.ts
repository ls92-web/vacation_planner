import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { isConfigured } from "./openrouter.ts";
import { composeTrip, generateItinerary, planningInsights, planTrip, recommendPlaces, refineTrip, streamAssistant } from "./service.ts";

// Single action-routed AI function: itinerary | insights | recommendations | assistant (stream).
// Requires a real signed-in user (the anon key is rejected). OpenRouter key/model come
// from Edge Function secrets; without them this returns 503 and the app falls back.
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const json = (o: unknown, status = 200) => Response.json(o, { status, headers: cors });

const hits = new Map<string, number[]>();
function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return false; }
  recent.push(now); hits.set(key, recent); return true;
}
async function getUserId(req: Request): Promise<string | null> {
  const a = req.headers.get("authorization") ?? "";
  const token = a.startsWith("Bearer ") ? a.slice(7) : "";
  if (!token || !SUPABASE_URL || !ANON) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = await res.json();
    return u?.id ?? null;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!isConfigured()) return json({ error: "AI is not configured" }, 503);
  const userId = await getUserId(req);
  if (!userId) return json({ error: "Sign in required" }, 401);
  if (!rateLimit(`ai:${userId}`, 20, 60_000)) return json({ error: "Too many requests — please slow down" }, 429);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const context = body.context;
  try {
    if (action === "compose") {
      const text = String(body.text ?? "").trim();
      if (!text) return json({ error: "Missing 'text'" }, 400);
      if (text.length > 1200) return json({ error: "Description too long" }, 413);
      return json({ trip: await composeTrip(text) });
    }
    if (action === "refine") {
      const message = String(body.message ?? "").trim();
      if (!message) return json({ error: "Missing 'message'" }, 400);
      if (message.length > 1200) return json({ error: "Message too long" }, 413);
      const messages = Array.isArray(body.messages) ? body.messages : [];
      return json(await refineTrip(body.trip, messages, message));
    }
    if (action === "plan") {
      const message = String(body.message ?? "").trim();
      if (!message) return json({ error: "Missing 'message'" }, 400);
      if (message.length > 1200) return json({ error: "Message too long" }, 413);
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const scheduleText = String(body.scheduleText ?? "");
      if (scheduleText.length > 12_000) return json({ error: "Schedule too long" }, 413);
      const weatherText = String(body.weatherText ?? "").slice(0, 4_000);
      const budgetText = String(body.budgetText ?? "").slice(0, 3_000);
      const transportText = String(body.transportText ?? "").slice(0, 2_000);
      const refKeys = Array.isArray(body.refKeys) ? body.refKeys.slice(0, 200).map(String) : [];
      return json(await planTrip(body.trip, scheduleText, weatherText, budgetText, transportText, refKeys, messages, message));
    }
    if (!context) return json({ error: "Missing 'context'" }, 400);
    if (action === "assistant") {
      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (!messages.length) return json({ error: "Missing 'messages'" }, 400);
      const total = messages.reduce((n: number, m: { content?: string }) => n + (typeof m?.content === "string" ? m.content.length : 0), 0);
      if (messages.length > 40 || total > 24_000) return json({ error: "Conversation too long" }, 413);
      const enc = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({ async start(c) { try { for await (const d of streamAssistant(context, messages)) c.enqueue(enc.encode(d)); c.close(); } catch (e) { c.error(e); } } });
      return new Response(stream, { headers: { ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    }
    if (action === "itinerary") return json({ days: await generateItinerary(context) });
    if (action === "recommendations") { const cands = Array.isArray(body.candidates) ? body.candidates.slice(0, 60) : []; if (!cands.length) return json({ error: "Missing 'candidates'" }, 400); return json({ recommendations: await recommendPlaces(context, cands) }); }
    if (action === "insights") return json({ insights: await planningInsights(context) });
    return json({ error: "Unknown action" }, 400);
  } catch (e) { console.error("[ai]", e); return json({ error: "AI request failed", detail: String((e as Error)?.message ?? e).slice(0, 300) }, 502); }
});
