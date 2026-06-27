import type { AIMessage } from "./types";

// ===== Prompt builders. Kept separate so the service stays about orchestration. =====

export interface TripContext {
  destination: string;
  travelers: string;
  numDays: number;
  selected?: { name: string; category: string; type: string; priority?: string; lat?: number; lng?: number }[];
  /** Places the user discovered via Google Places and added to the trip. */
  discovered?: { name: string; category: string }[];
}

function contextBlock(ctx: TripContext): string {
  const places =
    ctx.selected && ctx.selected.length
      ? ctx.selected
          .map((p) => {
            const coords = p.lat != null && p.lng != null ? ` @${p.lat.toFixed(4)},${p.lng.toFixed(4)}` : "";
            return `- ${p.name} (${p.category}${p.priority ? `, ${p.priority}` : ""})${coords}`;
          })
          .join("\n")
      : "(none selected yet)";
  const lines = [
    `Destination: ${ctx.destination}`,
    `Travelers: ${ctx.travelers}`,
    `Trip length: ${ctx.numDays} day(s)`,
    `Selected places (with coordinates where known):\n${places}`,
  ];
  if (ctx.discovered && ctx.discovered.length) {
    lines.push(`Also added from the map:\n${ctx.discovered.map((d) => `- ${d.name} (${d.category})`).join("\n")}`);
  }
  return lines.join("\n");
}

export function assistantMessages(ctx: TripContext, history: AIMessage[]): AIMessage[] {
  const system: AIMessage = {
    role: "system",
    content:
      "You are Itinera, a warm, concise AI travel assistant — every journey, perfectly planned. " +
      "Help plan and adjust multi-day, multi-destination trips for any kind of traveler. " +
      "Be practical: opening hours, walking distance, pacing, meals, rainy-day backups, accessibility, and family-friendliness when the trip includes kids. " +
      "You have the selected places with coordinates — use them to reason about distances: recommend attractions and " +
      "restaurants near each other or near the hotel, suggest efficient routes that reduce backtracking and driving, " +
      "warn when two places are far apart, and offer closer alternatives. " +
      "Keep replies short and skimmable (a few sentences or a tight bullet list). Never invent prices or hours you are unsure about.\n\n" +
      `Trip context:\n${contextBlock(ctx)}`,
  };
  return [system, ...history];
}

export function itineraryMessages(ctx: TripContext): AIMessage[] {
  return [
    {
      role: "system",
      content:
        "You are an expert travel itinerary planner. Build a realistic day-by-day itinerary and return ONLY valid JSON. " +
        "Optimize for sensible pacing, grouping nearby stops, meals at meal times, hours that make sense, and family-friendliness when the trip includes kids.",
    },
    {
      role: "user",
      content:
        `${contextBlock(ctx)}\n\n` +
        `Return JSON with this exact shape:\n` +
        `{"days":[{"day":"Day 1","date":"Mon, Jul 14","meta":"short theme","emoji":"landmark","title":"day title","note":"one-line pacing note","stops":[{"time":"09:00","title":"Place","cat":"Landmark","kid":true,"age":"All ages","hours":"9:00-18:00","duration":"2 hr","blurb":"one sentence","dist":0.6,"mode":"Walk","travelTime":"8 min","x":"30%","y":"40%"}]}]}\n` +
        `Rules: "emoji" is one of landmark|fish|flask. "mode" is one of Walk|Metro|Taxi or "" for the last stop of a day. ` +
        `"dist"/"travelTime"/"mode" describe travel to the NEXT stop; the last stop of each day uses dist 0, mode "", travelTime "". ` +
        `"x"/"y" are map positions as percent strings between "8%" and "92%". Include 4-5 stops per day. Use the selected places where they fit. JSON only, no prose.`,
    },
  ];
}

export function recommendationMessages(ctx: TripContext, candidates: { name: string; category: string }[]): AIMessage[] {
  return [
    {
      role: "system",
      content:
        "You rank places by fit for a specific trip and return ONLY valid JSON. " +
        "Score each candidate 0-100 for how well it suits this traveler, and give a one-sentence reason.",
    },
    {
      role: "user",
      content:
        `${contextBlock(ctx)}\n\n` +
        `Candidates:\n${candidates.map((c) => `- ${c.name} (${c.category})`).join("\n")}\n\n` +
        `Return JSON: {"recommendations":[{"name":"<exact candidate name>","ai":<0-100 integer>,"why":"<one sentence>"}]}. ` +
        `Include every candidate exactly once. JSON only, no prose.`,
    },
  ];
}

export function insightsMessages(ctx: TripContext): AIMessage[] {
  return [
    {
      role: "system",
      content:
        "You give short, concrete planning tips for a trip and return ONLY valid JSON. " +
        "Each tip is one sentence about ordering, proximity, opening hours, meals, pacing, or kid fit.",
    },
    {
      role: "user",
      content:
        `${contextBlock(ctx)}\n\n` +
        `Return JSON: {"insights":["tip one","tip two","tip three"]}. Give 2-4 tips based on the selected places. JSON only, no prose.`,
    },
  ];
}
