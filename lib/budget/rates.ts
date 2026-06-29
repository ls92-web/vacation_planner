"use client";

import { useEffect, useSyncExternalStore } from "react";
import { callFn } from "@/lib/edge";

// ===== Live exchange rates (base EUR) =====
// Fetched once per session from the fx edge function, cached in localStorage 12h, and
// exposed via useLiveRates(). When unavailable, callers fall back to the static
// reference rates in estimate.ts. `rates[code]` = units of `code` per 1 EUR.

type Rates = Record<string, number>;

const CACHE_KEY = "itinera_fx_v1";
const TTL_MS = 12 * 60 * 60 * 1000;

let rates: Rates | null = null;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function readCache(): Rates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, rates: r } = JSON.parse(raw) as { at: number; rates: Rates };
    if (!r || Date.now() - at > TTL_MS) return null;
    return r;
  } catch {
    return null;
  }
}

async function loadLiveRates() {
  if (started) return;
  started = true;
  const cached = readCache();
  if (cached) {
    rates = cached;
    emit();
    return;
  }
  const data = await callFn<{ rates: Rates | null }>("fx");
  if (data?.rates) {
    rates = data.rates;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rates }));
    } catch {}
    emit();
  }
  // else keep rates null → static fallback
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Live rates map (units per EUR), or null until loaded / on failure. Triggers a one-time fetch. */
export function useLiveRates(): Rates | null {
  const snapshot = useSyncExternalStore(subscribe, () => rates, () => null);
  useEffect(() => {
    loadLiveRates();
  }, []);
  return snapshot;
}
