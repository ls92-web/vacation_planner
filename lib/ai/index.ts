// Public surface of the AI module — types only. The server logic (OpenRouter
// client, prompts, itinerary/insights/recommendations/assistant) now lives in the
// `ai` Supabase Edge Function (supabase/functions/ai). The browser calls it via
// lib/ai-client.ts.
export type { AIMessage, TripContext, Recommendation } from "./types";
