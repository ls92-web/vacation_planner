"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return url.trim().length > 0 && anonKey.trim().length > 0;
}

// Persist the singleton on globalThis so Fast Refresh (which re-evaluates this
// module) reuses one client instead of spawning "Multiple GoTrueClient instances".
const globalForSb = globalThis as unknown as { __itineraSb?: SupabaseClient | null };

/** Singleton browser Supabase client (null when not configured → repo uses localStorage). */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!globalForSb.__itineraSb) {
    globalForSb.__itineraSb = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // handles password-recovery / confirmation links
      },
    });
  }
  return globalForSb.__itineraSb;
}
