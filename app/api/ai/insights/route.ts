import { isAIConfigured, planningInsights, type TripContext } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAIConfigured()) {
    return Response.json({ error: "AI is not configured" }, { status: 503 });
  }

  let body: { context?: TripContext };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.context) {
    return Response.json({ error: "Missing 'context'" }, { status: 400 });
  }

  try {
    const insights = await planningInsights(body.context);
    return Response.json({ insights });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "AI error" }, { status: 502 });
  }
}
