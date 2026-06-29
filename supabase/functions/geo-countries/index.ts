import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import countries from "npm:world-countries";

// Country reference data from the open `world-countries` dataset. Stable reference
// data (not user data). Flags via the keyless flagcdn CDN. Cached in instance memory.
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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

let cache: unknown[] | null = null;

function build() {
  if (cache) return cache;
  cache = (countries as unknown as WCCountry[])
    .map((c) => {
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

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  return Response.json({ countries: build() }, { headers: cors });
});
