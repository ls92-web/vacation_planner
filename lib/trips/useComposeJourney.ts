"use client";

import { useState } from "react";
import { useTrip } from "@/lib/store";
import { useTrips } from "@/lib/trips/store";
import { useTripLoader } from "@/lib/trips/useTripLoader";
import { composeTrip } from "@/lib/ai-client";
import { classifyIntent } from "@/lib/ai/intent";
import { geocodeCity } from "@/lib/geo";
import { saveTrip } from "@/lib/destinations/repository";
import type { Destination } from "@/lib/types";

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * "Describe a journey → the AI builds it" — the single compose flow shared by the
 * Welcome hub and the Trip List. A trip is created ONLY on a confident result
 * (never from the raw prompt); transient/unparseable outcomes leave `error` set
 * so the caller can offer a one-click retry with the prompt preserved.
 *
 * `onBeforeEnter` runs right before navigating into the new journey — used to play
 * the "warp into the journey" transition.
 */
export function useComposeJourney(onBeforeEnter?: () => Promise<void> | void) {
  const { actions } = useTrip();
  const { actions: tripActions } = useTrips();
  const loadPlan = useTripLoader();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compose = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    // Don't spend a model call on a greeting or keyboard-mashing — nudge instead.
    const intent = classifyIntent(t);
    if (intent === "gibberish" || intent === "greeting" || intent === "farewell" || intent === "thanks" || intent === "confirmation") {
      setError("Tell me where you’d like to go — a city, a country, or a vibe like “a relaxed week of food in Italy”.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const outcome = await composeTrip(t);
      if (outcome.status !== "ok") {
        setBusy(false);
        setError(
          outcome.status === "busy"
            ? "I’m gathering my thoughts — give it another moment and try again."
            : "I couldn’t turn that into a trip yet — try naming a destination or two."
        );
        return;
      }
      const composed = outcome.trip;
      const trip = await tripActions.createTrip(composed.name || composed.destinations[0].city, composed.destinations[0].city);
      if (!trip) throw new Error("createTrip failed");
      const cursor = new Date();
      cursor.setDate(cursor.getDate() + 30); // sensible default start ~a month out
      const dests: Destination[] = [];
      for (let i = 0; i < composed.destinations.length; i++) {
        const c = composed.destinations[i];
        const g = await geocodeCity(c.city, c.country).catch(() => null);
        const arrive = new Date(cursor);
        cursor.setDate(cursor.getDate() + c.nights);
        dests.push({
          id: i + 1, name: c.city, country: g?.countryName || c.country || "", countryCode: g?.countryCode || "",
          lat: g?.lat, lng: g?.lng, image: null, saved: true, expanded: false,
          arrive: fmtDate(arrive), depart: fmtDate(cursor), accoms: [], budgetOverride: null,
        });
      }
      await saveTrip(trip.id, dests, "standard", {}, composed.preferences || {});
      await onBeforeEnter?.();
      actions.goWorkspace();
      await loadPlan(trip.id, composed.destinations[0].city);
    } catch {
      setBusy(false);
      setError("Something went wrong starting your trip. Please try again.");
    }
  };

  return { compose, busy, error, setError };
}
