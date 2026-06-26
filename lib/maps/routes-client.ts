"use client";

import { cached, TTL } from "./cache";
import type { LatLng, RouteResult, TravelMode } from "./types";

/**
 * Compute a route via the server proxy (Routes API). Cached + de-duplicated.
 * Returns null on any failure so callers can fall back gracefully.
 */
export async function fetchRoute(
  origin: LatLng,
  destination: LatLng,
  opts: { intermediates?: LatLng[]; travelMode?: TravelMode } = {}
): Promise<RouteResult | null> {
  const { intermediates = [], travelMode = "DRIVE" } = opts;
  const pt = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  const key = `route:${travelMode}:${pt(origin)}>${intermediates.map(pt).join("|")}>${pt(destination)}`;
  try {
    return await cached<RouteResult | null>(key, TTL.routes, async () => {
      const res = await fetch("/api/maps/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, intermediates, travelMode }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data?.route as RouteResult) ?? null;
    });
  } catch {
    return null;
  }
}

export function formatDistance(meters: number, units: "km" | "mi" = "km"): string {
  if (units === "mi") return `${(meters / 1609.34).toFixed(1)} mi`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
