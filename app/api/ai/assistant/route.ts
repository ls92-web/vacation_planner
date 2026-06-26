import { isAIConfigured, streamAssistant, type AIMessage, type TripContext } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAIConfigured()) {
    return Response.json({ error: "AI is not configured" }, { status: 503 });
  }

  let body: { context?: TripContext; messages?: AIMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { context, messages } = body;
  if (!context || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Missing 'context' or 'messages'" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const gen = streamAssistant(context, messages);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of gen) controller.enqueue(encoder.encode(chunk));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      gen.return?.(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
