import { createClient } from "@supabase/supabase-js";

// ===== Server-side guard for the AI proxy routes =====
// The AI routes forward to OpenRouter on a paid, server-side key. Left open they
// could be scripted by anyone to drain the budget (LLM10) or hit cross-tenant
// data. So every AI route requires a valid Supabase session, is rate-limited per
// user, and caps request size.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Verify the caller's Supabase access token (Bearer). Returns the user id, or null. */
export async function getRequestUserId(req: Request): Promise<string | null> {
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token || !SUPABASE_URL || !SUPABASE_ANON) return null;
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// Simple in-memory sliding-window limiter (per server instance). Good enough to
// stop scripted abuse of a single deployment; swap for a shared store if scaled.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** Read + size-cap a JSON body. Returns "too-large" / "invalid" sentinels the route maps to 413/400. */
export async function readJsonCapped<T>(req: Request, maxBytes = 64_000): Promise<T | "too-large" | "invalid"> {
  const text = await req.text();
  if (text.length > maxBytes) return "too-large";
  try {
    return JSON.parse(text) as T;
  } catch {
    return "invalid";
  }
}

/**
 * Standard gate for AI routes: require auth + apply a per-user rate limit.
 * Returns a Response to short-circuit with, or the userId to proceed.
 */
export async function guardAI(req: Request, limit = 20, windowMs = 60_000): Promise<Response | string> {
  const userId = await getRequestUserId(req);
  if (!userId) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!rateLimit(`ai:${userId}`, limit, windowMs)) {
    return Response.json({ error: "Too many requests — please slow down" }, { status: 429 });
  }
  return userId;
}
