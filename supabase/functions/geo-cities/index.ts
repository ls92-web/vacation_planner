import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// City discovery. GEONAMES_USERNAME secret => popular cities by population; else
// Open-Meteo keyless geocoding for typed search. No city data is stored.
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const GEONAMES_USER = Deno.env.get("GEONAMES_USERNAME") ?? "";

interface OutCity { name: string; countryCode: string; countryName: string; lat: number; lng: number; population?: number; admin?: string }

async function fromGeoNames(country: string, q: string): Promise<OutCity[]> {
  const params = new URLSearchParams({ country, featureClass: "P", maxRows: "24", orderby: "population", username: GEONAMES_USER, style: "MEDIUM" });
  if (q) params.set("name_startsWith", q);
  const res = await fetch(`https://secure.geonames.org/searchJSON?${params.toString()}`);
  if (!res.ok) throw new Error(`GeoNames ${res.status}`);
  const data = await res.json();
  if (!data.geonames) throw new Error(data.status?.message ?? "GeoNames error");
  return data.geonames.map((g: Record<string, unknown>) => ({ name: g.name, countryCode: g.countryCode, countryName: g.countryName, lat: Number(g.lat), lng: Number(g.lng), population: g.population, admin: g.adminName1 }));
}

async function fromOpenMeteo(country: string, q: string): Promise<OutCity[]> {
  if (!q) return [];
  const params = new URLSearchParams({ name: q, count: "20", language: "en", format: "json" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = await res.json();
  const rows = (data.results ?? []) as Record<string, unknown>[];
  return rows.filter((r) => String(r.country_code ?? "").toUpperCase() === country.toUpperCase()).map((r) => ({ name: r.name as string, countryCode: String(r.country_code ?? country).toUpperCase(), countryName: (r.country as string) ?? "", lat: r.latitude as number, lng: r.longitude as number, population: r.population as number | undefined, admin: r.admin1 as string | undefined }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const body = await req.json().catch(() => ({}));
  const country = String(body.country ?? "").trim().toUpperCase();
  const q = String(body.q ?? "").trim();
  if (!country) return Response.json({ cities: [], source: "none" }, { headers: cors });
  if (GEONAMES_USER) {
    try { const cities = await fromGeoNames(country, q); if (cities.length) return Response.json({ cities, source: "geonames" }, { headers: cors }); } catch { /* fall through */ }
  }
  try { const cities = await fromOpenMeteo(country, q); return Response.json({ cities, source: cities.length ? "open-meteo" : "none" }, { headers: cors }); }
  catch { return Response.json({ cities: [], source: "none" }, { headers: cors }); }
});
