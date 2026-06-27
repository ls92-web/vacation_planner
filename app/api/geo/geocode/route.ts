import { NextResponse, type NextRequest } from "next/server";

// Resolve coordinates for a manually-typed city. Open-Meteo first (fast, keyless);
// Nominatim/OpenStreetMap as a fallback for rare places. Returns null coords when
// nothing is found so the UI can warn instead of saving an invalid destination.

interface Resolved {
  name: string;
  countryName: string;
  countryCode: string;
  lat: number;
  lng: number;
}

interface OpenMeteoRow {
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  country?: string;
}

async function viaOpenMeteo(name: string, code: string): Promise<Resolved | null> {
  const params = new URLSearchParams({ name, count: "10", language: "en", format: "json" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: OpenMeteoRow[] };
  const rows = data.results ?? [];
  const match = code ? rows.find((r) => (r.country_code ?? "").toUpperCase() === code.toUpperCase()) : rows[0];
  if (!match) return null;
  return {
    name: match.name,
    countryName: match.country ?? "",
    countryCode: (match.country_code ?? code).toUpperCase(),
    lat: match.latitude,
    lng: match.longitude,
  };
}

interface NominatimRow {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  address?: { country_code?: string; country?: string };
}

async function viaNominatim(name: string, country: string, code: string): Promise<Resolved | null> {
  const params = new URLSearchParams({ city: name, format: "jsonv2", limit: "1", addressdetails: "1" });
  if (country) params.set("country", country);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { "User-Agent": "Itinera/1.0 (travel itinerary planner)" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as NominatimRow[];
  const row = rows[0];
  if (!row) return null;
  return {
    name: row.name || name,
    countryName: row.address?.country ?? country,
    countryCode: (row.address?.country_code ?? code).toUpperCase(),
    lat: Number(row.lat),
    lng: Number(row.lon),
  };
}

export async function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get("name") ?? "").trim();
  const country = (req.nextUrl.searchParams.get("country") ?? "").trim();
  const code = (req.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();
  if (!name) return NextResponse.json({ result: null });

  try {
    const result = (await viaOpenMeteo(name, code)) ?? (await viaNominatim(name, country, code));
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ result: null });
  }
}
