import { NextResponse } from "next/server";
import countries from "world-countries";
import type { GeoCountry } from "@/lib/geo/types";

// Country reference data comes from the open `world-countries` dataset (the same
// data REST Countries served, which was deprecated). It is stable reference data,
// not user data, so it lives in the bundle — never in our database. Flags are the
// keyless flagcdn CDN. The client fetches this once and caches it.

interface WCCountry {
  name: { common: string; official: string };
  cca2: string;
  region: string;
  subregion?: string;
  capital?: string[];
  capitalInfo?: { latlng?: [number, number] };
  latlng?: [number, number];
  currencies?: Record<string, { name?: string }>;
  languages?: Record<string, string>;
}

let cache: GeoCountry[] | null = null;

function build(): GeoCountry[] {
  if (cache) return cache;
  cache = (countries as unknown as WCCountry[])
    .map((c): GeoCountry => {
      const cur = c.currencies ? Object.entries(c.currencies)[0] : undefined;
      const code = c.cca2;
      return {
        name: c.name.common,
        official: c.name.official,
        code,
        flagSvg: code ? `https://flagcdn.com/${code.toLowerCase()}.svg` : "",
        region: c.region ?? "",
        subregion: c.subregion,
        currency: cur ? `${cur[1]?.name ?? cur[0]} (${cur[0]})` : undefined,
        currencyCode: cur?.[0],
        languages: c.languages ? Object.values(c.languages) : [],
        capital: c.capital?.[0],
        capitalLatlng: c.capitalInfo?.latlng,
        latlng: c.latlng,
      };
    })
    .filter((c) => c.name && c.code)
    .sort((a, b) => a.name.localeCompare(b.name));
  return cache;
}

export async function GET() {
  return NextResponse.json({ countries: build() });
}
