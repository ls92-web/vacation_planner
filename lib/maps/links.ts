import type { LatLng, TravelMode } from "./types";

// ===== Google Maps URL builders (Maps URLs API). =====
// These are plain external links — no API key, no billing, no Directions/Routes API
// calls. They let users get directions in Google Maps itself. Internal route
// calculation is intentionally NOT done here (see lib/maps/routes-client.ts, which
// stays as a dormant seam for a future premium in-app routing feature).

const MAPS_TRAVEL_MODE: Record<TravelMode, string> = {
  DRIVE: "driving",
  WALK: "walking",
  BICYCLE: "bicycling",
  TRANSIT: "transit",
};

const coord = (p: LatLng) => `${p.lat},${p.lng}`;

/** Link that opens a single place in Google Maps (by place id, coords, or name). */
export function placeLink(opts: { name?: string; position?: LatLng | null; placeId?: string | null }): string {
  const params = new URLSearchParams({ api: "1" });
  if (opts.placeId) {
    params.set("query", opts.name || "place");
    params.set("query_place_id", opts.placeId);
  } else if (opts.position) {
    params.set("query", coord(opts.position));
  } else {
    params.set("query", opts.name || "");
  }
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/** Link that opens a free-text query (e.g. an accommodation address) in Google Maps. */
export function queryLink(query: string): string {
  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/**
 * Directions link through ordered stops. For a multi-stop day this becomes
 * origin → waypoints → destination, opened in Google Maps for turn-by-turn.
 */
export function directionsLink(opts: {
  origin: LatLng;
  destination: LatLng;
  waypoints?: LatLng[];
  travelMode?: TravelMode;
}): string {
  const params = new URLSearchParams({ api: "1", travelmode: MAPS_TRAVEL_MODE[opts.travelMode ?? "DRIVE"] });
  params.set("origin", coord(opts.origin));
  params.set("destination", coord(opts.destination));
  if (opts.waypoints && opts.waypoints.length) {
    params.set("waypoints", opts.waypoints.map(coord).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Build a day's directions link from an ordered list of stop coordinates (null if <2). */
export function dayDirectionsLink(stops: LatLng[], travelMode?: TravelMode): string | null {
  if (stops.length < 2) return null;
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(1, -1);
  return directionsLink({ origin, destination, waypoints, travelMode });
}
