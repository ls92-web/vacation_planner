import { NextResponse, type NextRequest } from "next/server";

// Representative city photo via Wikipedia page images (keyless, CC-licensed).
// Tries the city title directly, then a "<city> <country>" search to resolve
// ambiguous names. Only a URL is returned — nothing is stored here.

const memo = new Map<string, string | null>();

interface Page {
  title?: string;
  thumbnail?: { source?: string };
  pageprops?: { disambiguation?: string };
}

async function pageImage(title: string): Promise<string | null> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1" +
    "&prop=pageimages|pageprops&piprop=thumbnail&pithumbsize=800&ppprop=disambiguation" +
    `&titles=${encodeURIComponent(title)}`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } });
  if (!res.ok) return null;
  const data = (await res.json()) as { query?: { pages?: Record<string, Page> } };
  const page = data.query?.pages ? Object.values(data.query.pages)[0] : undefined;
  if (!page || page.pageprops?.disambiguation !== undefined) return null;
  return page.thumbnail?.source ?? null;
}

async function searchTitle(query: string): Promise<string | null> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srlimit=1" +
    `&srsearch=${encodeURIComponent(query)}`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } });
  if (!res.ok) return null;
  const data = (await res.json()) as { query?: { search?: { title: string }[] } };
  return data.query?.search?.[0]?.title ?? null;
}

export async function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get("name") ?? "").trim();
  const country = (req.nextUrl.searchParams.get("country") ?? "").trim();
  if (!name) return NextResponse.json({ image: null });

  const key = `${name}|${country}`.toLowerCase();
  if (memo.has(key)) return NextResponse.json({ image: memo.get(key) });

  let image: string | null = null;
  try {
    image = await pageImage(name);
    if (!image) {
      const best = await searchTitle(`${name} ${country} city`.trim());
      if (best) image = await pageImage(best);
    }
  } catch {
    image = null;
  }

  memo.set(key, image);
  return NextResponse.json({ image });
}
