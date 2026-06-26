import { isAIConfigured, recommendPlaces, type TripContext } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAIConfigured()) {
    return Response.json({ error: "AI is not configured" }, { status: 503 });
  }

  let body: { context?: TripContext; candidates?: { name: string; category: string }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.context || !Array.isArray(body.candidates) || body.candidates.length === 0) {
    return Response.json({ error: "Missing 'context' or 'candidates'" }, { status: 400 });
  }

  try {
    const recommendations = await recommendPlaces(body.context, body.candidates);
    return Response.json({ recommendations });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "AI error" }, { status: 502 });
  }
}
