import { generateItinerary, isAIConfigured, type TripContext } from "@/lib/ai";

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
    const days = await generateItinerary(body.context);
    return Response.json({ days });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "AI error" }, { status: 502 });
  }
}
