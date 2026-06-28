"use client";

import { useAuth } from "@/lib/auth/store";
import { getCurrency, type Currency } from "./estimate";
import { useLiveRates } from "./rates";

/**
 * The user's chosen display currency (defaults to KWD), with its conversion rate
 * overridden by the live exchange rate whenever available. Falls back to the
 * static reference rate in estimate.ts if live rates haven't loaded / failed.
 */
export function useCurrency(): Currency {
  const { state } = useAuth();
  const live = useLiveRates();
  const base = getCurrency(state.preferences?.currency);
  const liveRate = live?.[base.code];
  return typeof liveRate === "number" && liveRate > 0 ? { ...base, rate: liveRate } : base;
}
