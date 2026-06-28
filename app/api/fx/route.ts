import { NextResponse } from "next/server";

// Live exchange rates (base EUR) from the keyless open.er-api.com endpoint, which
// — unlike ECB-only providers — includes the GCC currencies we support. Cached for
// 12h; the client falls back to static reference rates if this ever fails.
const SOURCE = "https://open.er-api.com/v6/latest/EUR";

export async function GET() {
  try {
    const res = await fetch(SOURCE, { next: { revalidate: 43200 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    if (data?.result !== "success" || !data?.rates) throw new Error("bad payload");
    return NextResponse.json(
      { base: "EUR", rates: data.rates as Record<string, number>, updatedAt: (data.time_last_update_unix ?? 0) * 1000 },
      { headers: { "Cache-Control": "public, max-age=43200, stale-while-revalidate=86400" } }
    );
  } catch {
    // Signal the client to use its static fallback rates.
    return NextResponse.json({ base: "EUR", rates: null, updatedAt: 0 }, { status: 200 });
  }
}
