"use client";

import { useAuth } from "@/lib/auth/store";
import { getCurrency, type Currency } from "./estimate";

/** The user's chosen display currency (defaults to KWD). */
export function useCurrency(): Currency {
  const { state } = useAuth();
  return getCurrency(state.preferences?.currency);
}
