import { openRouterProvider } from "./client";
import type { ChatProvider } from "./types";

/**
 * Returns the active chat provider. Today this is always OpenRouter (which itself
 * routes to Qwen, Claude, GPT, Gemini, … via the OPENROUTER_MODEL env var). To add
 * a non-OpenRouter provider later, branch here on e.g. process.env.AI_PROVIDER and
 * return a different ChatProvider implementation — no caller changes needed.
 */
export function getProvider(): ChatProvider {
  return openRouterProvider;
}

export function isAIConfigured(): boolean {
  return getProvider().isConfigured();
}

export function activeModel(): string | undefined {
  return getProvider().modelId();
}
