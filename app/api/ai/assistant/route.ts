import { isAIConfigured, streamAssistant, type AIMessage, type TripContext } from "@/lib/ai";
import { guardAI, readJsonCapped } from "@/lib/ai/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGES = 40;
const MAX_CHARS = 24_000;

export async function POST(req: Request) {
  if (!isAIConfigured()) {
    return Response.json({ error: "AI is not configured" }, { status: 503 });
  }

  const gate = await guardAI(req);
  if (gate instanceof Response) return gate;

  const body = await readJsonCapped<{ context?: TripContext; messages?: AIMessage[] }>(req);
  if (body === "too-large") return Response.json({ error: "Request too large" }, { status: 413 });
  if (body === "invalid") return Response.json({ error: "Invalid JSON body" }, { status: 400 });

  const { context, messages } = body;
  if (!context || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Missing 'context' or 'messages'" }, { status: 400 });
  }
  // Cap conversation size to bound token spend per request.
  const total = messages.reduce((n, m) => n + (typeof m?.content === "string" ? m.content.length : 0), 0);
  if (messages.length > MAX_MESSAGES || total > MAX_CHARS) {
    return Response.json({ error: "Conversation too long" }, { status: 413 });
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
