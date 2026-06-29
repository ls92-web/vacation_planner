"use client";

import { getSupabase } from "./supabase/client";

// ===== Client helpers for calling Supabase Edge Functions =====
// All server logic runs as edge functions at <project>.supabase.co/functions/v1/*.
// Each call carries the user's session token (or the anon key when signed out) so
// auth-gated functions can verify the caller; the anon key also satisfies the
// platform's apikey requirement.

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "") + "/functions/v1";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function fnUrl(name: string): string {
  return `${BASE}/${name}`;
}

export async function fnHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const sb = getSupabase();
  let token = ANON;
  if (sb) {
    const { data } = await sb.auth.getSession();
    token = data.session?.access_token ?? ANON;
  }
  return { apikey: ANON, Authorization: `Bearer ${token}`, ...extra };
}

/** POST JSON to an edge function; returns parsed JSON, or null on any failure (caller falls back). */
export async function callFn<T>(name: string, body?: unknown): Promise<T | null> {
  if (!BASE || !ANON) return null;
  try {
    const res = await fetch(fnUrl(name), {
      method: "POST",
      headers: await fnHeaders({ "Content-Type": "application/json" }),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
