"use client";

import { cached, TTL } from "./cache";
import { mapsConfig } from "./config";
import { callFn } from "@/lib/edge";
import type { LatLng, RouteResult, TravelMode } from "./types";

const waypoint = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

function parseRoute(data: unknown): RouteResult | null {
  const r = (data as { routes?: Record<string, unknown>[] })?.routes?.[0];
  if (!r) return null;
  const durationSeconds = typeof r.duration === "string" ? parseInt(r.duration, 10) || 0 : Number(r.duration) || 0;
  const polyline = (r.polyline as { encodedPolyline?: string } | undefined)?.encodedPolyline ?? "";
  return { distanceMeters: Number(r.distanceMeters) || 0, durationSeconds, polyline };
}

/**
 * Browser-side call to the Google Routes API. The browser sends a referrer, so this
 * works with an HTTP-referrer-restricted public key (server-side calls don't).
 */
async function viaRoutesApi(
  origin: LatLng,
  destination: LatLng,
  intermediates: LatLng[],
  travelMode: TravelMode
): Promise<RouteResult | null> {
  if (!mapsConfig.apiKey) return null;
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": mapsConfig.apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: waypoint(origin),
        destination: waypoint(destination),
        intermediates: intermediates.map(waypoint),
        travelMode,
        polylineEncoding: "ENCODED_POLYLINE",
        ...(travelMode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
      }),
    });
    if (!res.ok) return null;
    return parseRoute(await res.json());
  } catch {
    return null;
  }
}

/**
 * Compute a route. Prefers the browser Routes API call (works with referrer-restricted
 * keys), then falls back to the server proxy (for dedicated server-key setups).
 * Cached + de-duplicated. Returns null on any failure so callers degrade gracefully.
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
      const direct = await viaRoutesApi(origin, destination, intermediates, travelMode);
      if (direct) return direct;

      const data = await callFn<{ route?: RouteResult }>("maps-routes", { origin, destination, intermediates, travelMode });
      return data?.route ?? null;
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
