// ===== Google Maps configuration — all values come from env, nothing hardcoded. =====

export const MAPS_LIBRARIES = ["places", "marker", "geometry", "routes"] as const;

export const mapsConfig = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
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
