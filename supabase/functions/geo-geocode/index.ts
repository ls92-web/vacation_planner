import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Resolve coordinates for a manually-typed city. Open-Meteo first, Nominatim fallback.
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Resolved { name: string; countryName: string; countryCode: string; lat: number; lng: number }

async function viaOpenMeteo(name: string, code: string): Promise<Resolved | null> {
  const params = new URLSearchParams({ name, count: "10", language: "en", format: "json" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  if (!res.ok) return null;
  const data = await res.json();
  const rows = (data.results ?? []) as Record<string, unknown>[];
  const match = code ? rows.find((r) => String(r.country_code ?? "").toUpperCase() === code.toUpperCase()) : rows[0];
  if (!match) return null;
  return { name: match.name as string, countryName: (match.country as string) ?? "", countryCode: String(match.country_code ?? code).toUpperCase(), lat: match.latitude as number, lng: match.longitude as number };
}

async function viaNominatim(name: string, country: string, code: string): Promise<Resolved | null> {
  const params = new URLSearchParams({ city: name, format: "jsonv2", limit: "1", addressdetails: "1" });
  if (country) params.set("country", country);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { "User-Agent": "Itinera/1.0 (travel itinerary planner)" } });
  if (!res.ok) return null;
  const rows = (await res.json()) as Record<string, unknown>[];
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const addr = (row.address as Record<string, unknown>) ?? {};
  return { name: (row.name as string) || name, countryName: (addr.country as string) ?? country, countryCode: String(addr.country_code ?? code).toUpperCase(), lat: Number(row.lat), lng: Number(row.lon) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const country = String(body.country ?? "").trim();
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!name) return Response.json({ result: null }, { headers: cors });
  try {
    const result = (await viaOpenMeteo(name, code)) ?? (await viaNominatim(name, country, code));
    return Response.json({ result }, { headers: cors });
  } catch { return Response.json({ result: null }, { headers: cors }); }
});
