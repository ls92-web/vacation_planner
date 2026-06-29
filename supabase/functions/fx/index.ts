import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Live EUR-base exchange rates (keyless open.er-api.com; includes GCC). Public —
// verify_jwt is disabled so the browser CORS preflight isn't blocked; we handle
// CORS + (no) auth in-function. Cached in module memory for 12h per warm instance.
const SOURCE = "https://open.er-api.com/v6/latest/EUR";
const TTL_MS = 12 * 60 * 60 * 1000;

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

let cache: { at: number; rates: Record<string, number> } | null = null;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      const res = await fetch(SOURCE);
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      const data = await res.json();
      if (data?.result !== "success" || !data?.rates) throw new Error("bad payload");
      cache = { at: Date.now(), rates: data.rates as Record<string, number> };
    }
    return Response.json({ base: "EUR", rates: cache.rates, updatedAt: cache.at }, { headers: cors });
  } catch {
    return Response.json({ base: "EUR", rates: null, updatedAt: 0 }, { headers: cors });
  }
});
