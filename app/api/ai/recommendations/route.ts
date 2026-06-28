import { isAIConfigured, recommendPlaces, type TripContext } from "@/lib/ai";
import { guardAI, readJsonCapped } from "@/lib/ai/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAIConfigured()) {
    return Response.json({ error: "AI is not configured" }, { status: 503 });
  }

  const gate = await guardAI(req);
  if (gate instanceof Response) return gate;

  const body = await readJsonCapped<{ context?: TripContext; candidates?: { name: string; category: string }[] }>(req);
  if (body === "too-large") return Response.json({ error: "Request too large" }, { status: 413 });
  if (body === "invalid") return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  if (!body.context || !Array.isArray(body.candidates) || body.candidates.length === 0) {
    return Response.json({ error: "Missing 'context' or 'candidates'" }, { status: 400 });
  }

  try {
    const recommendations = await recommendPlaces(body.context, body.candidates.slice(0, 60));
    return Response.json({ recommendations });
  } catch (err) {
    console.error("[ai/recommendations]", err);
    return Response.json({ error: "AI request failed" }, { status: 502 });
  }
}
