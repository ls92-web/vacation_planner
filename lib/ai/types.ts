// ===== Shared AI types used by the client when calling the `ai` edge function. =====
// (The OpenRouter client, prompts, and service now live in the Deno edge function
// at supabase/functions/ai — not in the Next.js bundle.)

export type AIRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIRole;
  content: string;
}

export interface TripContext {
  destination: string;
  travelers: string;
  numDays: number;
  selected?: { name: string; category: string; type: string; priority?: string; lat?: number; lng?: number }[];
  /** Places the user discovered via Google Places and added to the trip. */
  discovered?: { name: string; category: string }[];
}

export interface Recommendation {
  name: string;
  ai: number;
  why: string;
}
