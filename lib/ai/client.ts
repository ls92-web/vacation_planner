import { AIConfigError, AIRequestError, type ChatProvider, type ChatRequest } from "./types";

// ===== OpenRouter client (server-only). All config comes from env vars. =====

interface OpenRouterConfig {
  apiKey?: string;
  model?: string;
  baseUrl: string;
  maxRetries: number;
  referer?: string;
  title?: string;
}

function readConfig(): OpenRouterConfig {
  return {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL,
    baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    maxRetries: Math.max(0, Number(process.env.OPENROUTER_MAX_RETRIES ?? 2) || 0),
    referer: process.env.OPENROUTER_SITE_URL,
    title: process.env.OPENROUTER_SITE_NAME,
  };
}

const isDev = process.env.NODE_ENV !== "production";

function logError(scope: string, err: unknown) {
  // Errors are always surfaced; OpenRouter responses can be flaky on free tiers.
  console.error(`[ai:${scope}]`, err instanceof Error ? `${err.name}: ${err.message}` : err);
}
function logDebug(scope: string, msg: string) {
  if (isDev) console.debug(`[ai:${scope}]`, msg);
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt: number) => Math.min(8000, 2 ** attempt * 400) + Math.floor(Math.random() * 250);

function buildHeaders(cfg: OpenRouterConfig): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
    "Content-Type": "application/json",
  };
  // Optional attribution headers recommended by OpenRouter.
  if (cfg.referer) h["HTTP-Referer"] = cfg.referer;
  if (cfg.title) h["X-Title"] = cfg.title;
  return h;
}

interface RequestBody {
  messages: ChatRequest["messages"];
  temperature: number;
  max_tokens?: number;
  stream: boolean;
  response_format?: { type: "json_object" };
}

function buildBody(req: ChatRequest, stream: boolean): Omit<RequestBody, "model"> & { model?: string } {
  const body: RequestBody = {
    messages: req.messages,
    temperature: req.temperature ?? 0.7,
    stream,
  };
  if (req.maxTokens) body.max_tokens = req.maxTokens;
  if (req.json) body.response_format = { type: "json_object" };
  return body;
}

/** POST /chat/completions with retry/backoff on transient failures. Returns the raw ok Response. */
async function requestRaw(cfg: OpenRouterConfig, body: object, signal?: AbortSignal): Promise<Response> {
  if (!cfg.apiKey) throw new AIConfigError("OPENROUTER_API_KEY is not set");
  if (!cfg.model) throw new AIConfigError("OPENROUTER_MODEL is not set");

  const url = `${cfg.baseUrl}/chat/completions`;
  const payload = JSON.stringify({ ...body, model: cfg.model });
  let lastErr: unknown;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers: buildHeaders(cfg), body: payload, signal });
      if (res.ok) return res;

      const detail = await res.text().catch(() => "");
      if (!RETRYABLE_STATUS.has(res.status) || attempt === cfg.maxRetries) {
        throw new AIRequestError(`OpenRouter request failed (HTTP ${res.status})`, res.status, detail);
      }
      logDebug("retry", `HTTP ${res.status}, retrying (attempt ${attempt + 1}/${cfg.maxRetries})`);
    } catch (err) {
      if (err instanceof AIRequestError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      lastErr = err;
      if (attempt === cfg.maxRetries) {
        throw new AIRequestError(`OpenRouter network error: ${err instanceof Error ? err.message : String(err)}`);
      }
      logDebug("retry", `network error, retrying (attempt ${attempt + 1}/${cfg.maxRetries})`);
    }
    await sleep(backoff(attempt));
  }
  throw new AIRequestError(`OpenRouter request failed after retries: ${String(lastErr)}`);
}

async function chat(req: ChatRequest): Promise<string> {
  const cfg = readConfig();
  try {
    const res = await requestRaw(cfg, buildBody(req, false), req.signal);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new AIRequestError("OpenRouter returned an empty completion");
    }
    return content;
  } catch (err) {
    logError("chat", err);
    throw err;
  }
}

async function* stream(req: ChatRequest): AsyncGenerator<string> {
  const cfg = readConfig();
  let res: Response;
  try {
    res = await requestRaw(cfg, buildBody(req, true), req.signal);
  } catch (err) {
    logError("stream", err);
    throw err;
  }
  if (!res.body) throw new AIRequestError("OpenRouter streaming response had no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue; // skip SSE comments/keep-alives
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) yield delta;
        } catch {
          // Ignore partial/non-JSON chunks; they coalesce on the next read.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const openRouterProvider: ChatProvider = {
  name: "openrouter",
  isConfigured() {
    const cfg = readConfig();
    return !!cfg.apiKey && !!cfg.model;
  },
  modelId() {
    return readConfig().model;
  },
  chat,
  stream,
};
