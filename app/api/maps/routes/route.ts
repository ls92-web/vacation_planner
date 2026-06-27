import { isRoutesProxyConfigured, mapsConfig } from "@/lib/maps/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Pt {
  lat: number;
  lng: number;
}

const waypoint = (p: Pt) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

// Server proxy for the Google Routes API — keeps quota controllable and lets us
// cache/dedupe on the client. Uses the same Maps key (available server-side).
export async function POST(req: Request) {
  if (!isRoutesProxyConfigured()) {
    return Response.json({ error: "Routes proxy is not configured" }, { status: 503 });
  }

  let body: { origin?: Pt; destination?: Pt; intermediates?: Pt[]; travelMode?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { origin, destination, intermediates = [], travelMode = "DRIVE" } = body;
  if (!origin || !destination) {
    return Response.json({ error: "Missing 'origin' or 'destination'" }, { status: 400 });
  }

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": mapsConfig.serverApiKey,
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

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return Response.json({ error: `Routes API ${res.status}`, detail }, { status: 502 });
    }

    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return Response.json({ error: "No route found" }, { status: 404 });

    const durationSeconds =
      typeof route.duration === "string" ? parseInt(route.duration, 10) || 0 : Number(route.duration) || 0;

    return Response.json({
      route: {
        distanceMeters: route.distanceMeters ?? 0,
        durationSeconds,
        polyline: route.polyline?.encodedPolyline ?? "",
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Routes error" }, { status: 502 });
  }
}
