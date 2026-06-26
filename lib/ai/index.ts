// Public surface of the AI module.
export { getProvider, isAIConfigured, activeModel } from "./provider";
export {
  streamAssistant,
  generateItinerary,
  recommendPlaces,
  planningInsights,
  type Recommendation,
} from "./service";
export type { TripContext } from "./prompts";
export { AIConfigError, AIRequestError, type AIMessage } from "./types";
