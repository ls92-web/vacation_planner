// ===== Google Maps configuration — all values come from env, nothing hardcoded. =====

export const MAPS_LIBRARIES = ["places", "marker", "geometry", "routes"] as const;

export const mapsConfig = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  // Optional dedicated server-side key for the Routes API proxy. Falls back to the
  // public key — but a referrer-restricted public key will be rejected server-side,
  // so set this (IP-restricted) if you want the proxy path to work.
  serverApiKey:
    process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  // Advanced Markers + cloud styling need a Map ID; DEMO_MAP_ID is fine for dev.
  mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
  // Barcelona — matches the seed trip; user destinations re-center the map.
  defaultCenter: { lat: 41.3874, lng: 2.1686 },
  defaultZoom: 12,
};

/** True when a Maps key is present. When false the app uses the stylized fallback map. */
export function isMapsConfigured(): boolean {
  return mapsConfig.apiKey.trim().length > 0;
}

/** True when the server-side Routes proxy has a usable key. */
export function isRoutesProxyConfigured(): boolean {
  return mapsConfig.serverApiKey.trim().length > 0;
}
