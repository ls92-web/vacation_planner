import { NextResponse, type NextRequest } from "next/server";

// City discovery proxy. Keeps any GeoNames username server-side.
//  - GEONAMES_USERNAME set  -> popular cities by population (best experience).
//  - not set                -> Open-Meteo geocoding fallback (free, no key) for
//                              typed search; initial list is empty so the client
//                              seeds the capital. No city data is stored in our DB.

interface OutCity {
  name: string;
  countryCode: string;
  countryName: string;
  lat: number;
  lng: number;
  population?: number;
  admin?: string;
}

const GEONAMES_USER = process.env.GEONAMES_USERNAME ?? "";

interface GeoNamesRow {
  name: string;
  countryCode: string;
  countryName: string;
  lat: string;
  lng: string;
  population?: number;
  adminName1?: string;
}

async function fromGeoNames(country: string, q: string): Promise<OutCity[]> {
  const params = new URLSearchParams({
    country,
    featureClass: "P", // populated places
    maxRows: "24",
    orderby: "population",
    username: GEONAMES_USER,
    style: "MEDIUM",
  });
  if (q) params.set("name_startsWith", q);
  const res = await fetch(`https://secure.geonames.org/searchJSON?${params.toString()}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`GeoNames ${res.status}`);
  const data = (await res.json()) as { geonames?: GeoNamesRow[]; status?: { message: string } };
  if (!data.geonames) throw new Error(data.status?.message ?? "GeoNames error");
  return data.geonames.map((g) => ({
    name: g.name,
    countryCode: g.countryCode,
    countryName: g.countryName,
    lat: Number(g.lat),
    lng: Number(g.lng),
    population: g.population,
    admin: g.adminName1,
  }));
}

interface OpenMeteoRow {
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  country?: string;
  population?: number;
  admin1?: string;
}

async function fromOpenMeteo(country: string, q: string): Promise<OutCity[]> {
  if (!q) return []; // Open-Meteo needs a search term; client seeds the capital otherwise.
  const params = new URLSearchParams({ name: q, count: "20", language: "en", format: "json" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = (await res.json()) as { results?: OpenMeteoRow[] };
  const rows = data.results ?? [];
  return rows
    .filter((r) => (r.country_code ?? "").toUpperCase() === country.toUpperCase())
    .map((r) => ({
      name: r.name,
      countryCode: (r.country_code ?? country).toUpperCase(),
      countryName: r.country ?? "",
      lat: r.latitude,
      lng: r.longitude,
      population: r.population,
      admin: r.admin1,
    }));
}

export async function GET(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") ?? "").trim().toUpperCase();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!country) return NextResponse.json({ cities: [], source: "none" });

  if (GEONAMES_USER) {
    try {
      const cities = await fromGeoNames(country, q);
      if (cities.length) return NextResponse.json({ cities, source: "geonames" });
    } catch {
      /* fall through to the keyless fallback */
    }
  }

  try {
    const cities = await fromOpenMeteo(country, q);
    return NextResponse.json({ cities, source: cities.length ? "open-meteo" : "none" });
  } catch {
    return NextResponse.json({ cities: [], source: "none" });
  }
}
