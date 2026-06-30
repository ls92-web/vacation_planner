// OpenRouter client (Deno). Config from edge-function secrets.
export interface AIMessage { role: "system" | "user" | "assistant"; content: string }
export interface ChatReq { messages: AIMessage[]; temperature?: number; maxTokens?: number; json?: boolean }

function cfg() {
  return {
    apiKey: Deno.env.get("OPENROUTER_API_KEY") ?? "",
    model: Deno.env.get("OPENROUTER_MODEL") ?? "",
    baseUrl: Deno.env.get("OPENROUTER_BASE_URL") || "https://openrouter.ai/api/v1",
    maxRetries: Math.max(0, Number(Deno.env.get("OPENROUTER_MAX_RETRIES") ?? 2) || 0),
    referer: Deno.env.get("OPENROUTER_SITE_URL") ?? "",
    title: Deno.env.get("OPENROUTER_SITE_NAME") ?? "",
  };
}
export function isConfigured(): boolean { const c = cfg(); return !!c.apiKey && !!c.model; }

const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (a: number) => Math.min(8000, 2 ** a * 400) + Math.floor(Math.random() * 250);

function headers(c: ReturnType<typeof cfg>): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" };
  if (c.referer) h["HTTP-Referer"] = c.referer;
  if (c.title) h["X-Title"] = c.title;
  return h;
}
function buildBody(req: ChatReq, stream: boolean) {
  const b: Record<string, unknown> = { messages: req.messages, temperature: req.temperature ?? 0.7, stream };
  if (req.maxTokens) b.max_tokens = req.maxTokens;
  // NOTE: response_format:json_object is NOT sent — many OpenRouter models
  // (incl. the free tiers) reject it with an upstream error. The prompts already
  // demand strict JSON and extractJson() parses it out robustly.
  return b;
}
async function requestRaw(req: ChatReq, stream: boolean): Promise<Response> {
  const c = cfg();
  const url = `${c.baseUrl}/chat/completions`;
  const payload = JSON.stringify({ ...buildBody(req, stream), model: c.model });
  let last: unknown;
  for (let a = 0; a <= c.maxRetries; a++) {
    try {
      const res = await fetch(url, { method: "POST", headers: headers(c), body: payload });
      if (res.ok) return res;
      const errText = await res.text().catch(() => "");
      if (!RETRYABLE.has(res.status) || a === c.maxRetries) throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 200)}`);
    } catch (e) { last = e; if (a === c.maxRetries) throw e; }
    await sleep(backoff(a));
  }
  throw new Error(`OpenRouter failed: ${String(last)}`);
}
export async function chat(req: ChatReq): Promise<string> {
  const res = await requestRaw(req, false);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("empty completion");
  return content;
}
export async function* streamDeltas(req: ChatReq): AsyncGenerator<string> {
  const res = await requestRaw(req, true);
  if (!res.body) throw new Error("no body");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t || !t.startsWith("data:")) continue;
        const p = t.slice(5).trim();
        if (p === "[DONE]") return;
        try { const j = JSON.parse(p); const d = j?.choices?.[0]?.delta?.content; if (typeof d === "string" && d) yield d; } catch { /* partial */ }
      }
    }
  } finally { reader.releaseLock(); }
}
