// ===== Shared AI types — provider-agnostic so other providers can be added. =====

export type AIRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIRole;
  content: string;
}

export interface ChatRequest {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the model for a strict JSON object response. */
  json?: boolean;
  signal?: AbortSignal;
}

/**
 * A chat provider. OpenRouter is the only implementation today, but the app
 * talks to this interface only — a future provider (a direct Anthropic/OpenAI
 * client, a local model, etc.) just needs to satisfy this shape.
 */
export interface ChatProvider {
  readonly name: string;
  isConfigured(): boolean;
  modelId(): string | undefined;
  chat(req: ChatRequest): Promise<string>;
  stream(req: ChatRequest): AsyncGenerator<string>;
}

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigError";
  }
}

export class AIRequestError extends Error {
  status?: number;
  detail?: string;
  constructor(message: string, status?: number, detail?: string) {
    super(message);
    this.name = "AIRequestError";
    this.status = status;
    this.detail = detail;
  }
}
