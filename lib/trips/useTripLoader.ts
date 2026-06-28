"use client";

import { useCallback } from "react";
import { useTrip } from "@/lib/store";
import { loadTrip } from "@/lib/destinations/repository";
import type { TransportMode } from "@/lib/types";

/**
 * Centralised trip-plan loader used by both "open trip" and the retry control.
 * Shows the loading skeleton, then hydrates on success or flips to a retryable
 * error state on failure — so a transient auth/network hiccup never looks like
 * an empty trip (data loss).
 */
export function useTripLoader() {
  const { actions } = useTrip();
  return useCallback(
    async (tripId: string, destination: string) => {
      actions.setDestination(destination);
      actions.beginTripLoad();
      try {
        const plan = await loadTrip(tripId);
        actions.hydrateTrip(plan.destinations, plan.budgetLevel, plan.transports as Record<string, TransportMode>);
      } catch {
        actions.failTripLoad();
      }
    },
    [actions]
  );
}
