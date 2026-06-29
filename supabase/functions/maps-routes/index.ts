import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Server proxy for the Google Routes API. Dormant unless GOOGLE_MAPS_SERVER_API_KEY
// is set as a function secret. Returns a compact route or a generic error.
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const KEY = Deno.env.get("GOOGLE_MAPS_SERVER_API_KEY") ?? "";
const json = (o: unknown, status = 200) => Response.json(o, { status, headers: cors });
interface Pt { lat: number; lng: number }
const waypoint = (p: Pt) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!KEY) return json({ error: "Routes proxy is not configured" }, 503);
  const body = await req.json().catch(() => ({}));
  const origin = body.origin as Pt | undefined;
  const destination = body.destination as Pt | undefined;
  const intermediates = (body.intermediates ?? []) as Pt[];
  const travelMode = String(body.travelMode ?? "DRIVE");
  if (!origin || !destination) return json({ error: "Missing 'origin' or 'destination'" }, 400);
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline" },
      body: JSON.stringify({ origin: waypoint(origin), destination: waypoint(destination), intermediates: intermediates.map(waypoint), travelMode, polylineEncoding: "ENCODED_POLYLINE", ...(travelMode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}) }),
    });
    if (!res.ok) { console.error("[maps-routes] upstream", res.status, await res.text().catch(() => "")); return json({ error: "Routing unavailable" }, 502); }
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return json({ error: "No route found" }, 404);
    const durationSeconds = typeof route.duration === "string" ? parseInt(route.duration, 10) || 0 : Number(route.duration) || 0;
    return json({ route: { distanceMeters: route.distanceMeters ?? 0, durationSeconds, polyline: route.polyline?.encodedPolyline ?? "" } });
  } catch (e) { console.error("[maps-routes]", e); return json({ error: "Routing unavailable" }, 502); }
});
