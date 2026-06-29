import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Representative city photo via Wikipedia page images (keyless). Only a URL is returned.
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const memo = new Map<string, string | null>();

async function pageImage(title: string): Promise<string | null> {
  const url = "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages|pageprops&piprop=thumbnail&pithumbsize=800&ppprop=disambiguation&titles=" + encodeURIComponent(title);
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data.query?.pages;
  const page = pages ? (Object.values(pages)[0] as Record<string, unknown>) : undefined;
  if (!page || (page.pageprops as Record<string, unknown>)?.disambiguation !== undefined) return null;
  return ((page.thumbnail as Record<string, unknown>)?.source as string) ?? null;
}

async function searchTitle(query: string): Promise<string | null> {
  const url = "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srlimit=1&srsearch=" + encodeURIComponent(query);
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.query?.search?.[0]?.title ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const country = String(body.country ?? "").trim();
  if (!name) return Response.json({ image: null }, { headers: cors });
  const key = `${name}|${country}`.toLowerCase();
  if (memo.has(key)) return Response.json({ image: memo.get(key) }, { headers: cors });
  let image: string | null = null;
  try {
    image = await pageImage(name);
    if (!image) { const best = await searchTitle(`${name} ${country} city`.trim()); if (best) image = await pageImage(best); }
  } catch { image = null; }
  memo.set(key, image);
  return Response.json({ image }, { headers: cors });
});
