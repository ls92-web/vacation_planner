import type { AIMessage } from "./openrouter.ts";

export interface TripContext {
  destination: string;
  travelers: string;
  numDays: number;
  selected?: { name: string; category: string; type: string; priority?: string; lat?: number; lng?: number }[];
  discovered?: { name: string; category: string }[];
}

function contextBlock(ctx: TripContext): string {
  const places = ctx.selected && ctx.selected.length
    ? ctx.selected.map((p) => { const coords = p.lat != null && p.lng != null ? ` @${p.lat.toFixed(4)},${p.lng.toFixed(4)}` : ""; return `- ${p.name} (${p.category}${p.priority ? `, ${p.priority}` : ""})${coords}`; }).join("\n")
    : "(none selected yet)";
  const lines = [`Destination: ${ctx.destination}`, `Travelers: ${ctx.travelers}`, `Trip length: ${ctx.numDays} day(s)`, `Selected places (with coordinates where known):\n${places}`];
  if (ctx.discovered && ctx.discovered.length) lines.push(`Also added from the map:\n${ctx.discovered.map((d) => `- ${d.name} (${d.category})`).join("\n")}`);
  return lines.join("\n");
}

export function assistantMessages(ctx: TripContext, history: AIMessage[]): AIMessage[] {
  return [{ role: "system", content: "You are Itinera, a warm, concise AI travel assistant — every journey, perfectly planned. Help plan and adjust multi-day, multi-destination trips for any kind of traveler. Be practical: opening hours, walking distance, pacing, meals, rainy-day backups, accessibility, and family-friendliness when the trip includes kids. You have the selected places with coordinates — use them to reason about distances: recommend attractions and restaurants near each other or near the hotel, suggest efficient routes that reduce backtracking and driving, warn when two places are far apart, and offer closer alternatives. Keep replies short and skimmable (a few sentences or a tight bullet list). Never invent prices or hours you are unsure about.\n\nTrip context:\n" + contextBlock(ctx) }, ...history];
}
export function itineraryMessages(ctx: TripContext): AIMessage[] {
  return [
    { role: "system", content: "You are an expert travel itinerary planner. Build a realistic day-by-day itinerary and return ONLY valid JSON. Optimize for sensible pacing, grouping nearby stops, meals at meal times, hours that make sense, and family-friendliness when the trip includes kids." },
    { role: "user", content: `${contextBlock(ctx)}\n\nReturn JSON with this exact shape:\n{"days":[{"day":"Day 1","date":"Mon, Jul 14","meta":"short theme","emoji":"landmark","title":"day title","note":"one-line pacing note","stops":[{"time":"09:00","title":"Place","cat":"Landmark","kid":true,"age":"All ages","hours":"9:00-18:00","duration":"2 hr","blurb":"one sentence","dist":0.6,"mode":"Walk","travelTime":"8 min","x":"30%","y":"40%"}]}]}\nRules: "emoji" is one of landmark|fish|flask. "mode" is one of Walk|Metro|Taxi or "" for the last stop of a day. "dist"/"travelTime"/"mode" describe travel to the NEXT stop; the last stop of each day uses dist 0, mode "", travelTime "". "x"/"y" are map positions as percent strings between "8%" and "92%". Include 4-5 stops per day. Use the selected places where they fit. JSON only, no prose.` },
  ];
}
export function recommendationMessages(ctx: TripContext, candidates: { name: string; category: string }[]): AIMessage[] {
  return [
    { role: "system", content: "You rank places by fit for a specific trip and return ONLY valid JSON. Score each candidate 0-100 for how well it suits this traveler, and give a one-sentence reason." },
    { role: "user", content: `${contextBlock(ctx)}\n\nCandidates:\n${candidates.map((c) => `- ${c.name} (${c.category})`).join("\n")}\n\nReturn JSON: {"recommendations":[{"name":"<exact candidate name>","ai":<0-100 integer>,"why":"<one sentence>"}]}. Include every candidate exactly once. JSON only, no prose.` },
  ];
}
export function composeMessages(text: string): AIMessage[] {
  return [
    { role: "system", content: "You turn a traveller's free-text trip description into a structured plan and return ONLY valid JSON. Infer real destinations (cities, in sensible travel order). If only a country or region is named, choose 2-4 well-known cities that form a good route. Infer nights per city (split a stated total sensibly; otherwise pick reasonable lengths). Infer travellers, pace, interests and accessibility from the wording. Do not invent specifics the user didn't imply beyond reasonable defaults." },
    { role: "user", content: `Trip description: "${text}"\n\nReturn JSON exactly:\n{"name":"<short trip title>","destinations":[{"city":"<city>","country":"<country>","nights":<int>}],"preferences":{"travellerType":"family|couple|friends|solo|business|mixed|","ages":{"adults":<int>,"children":<int>,"toddlers":<int>,"seniors":<int>},"travelStyle":"relaxed|balanced|packed|","interests":["attractions|museums|nature|shopping|restaurants|cafes|beaches|themeparks|historical|local|photography|kids"],"accessibility":["stroller|wheelchair|lessWalking|indoor|outdoor|noLateNight"]}}\nRules: 1-6 destinations. Use an empty string, 0, or [] for anything not implied. Use ONLY the listed enum values. JSON only, no prose.` },
  ];
}
export function refineMessages(tripJson: string, history: AIMessage[], message: string): AIMessage[] {
  return [
    {
      role: "system",
      content:
        "You are Itinera, an expert, warm AI travel companion editing ONE trip through conversation. You are given the CURRENT trip as JSON and the recent conversation. Return ONLY valid JSON: {\"reply\":\"<1-3 sentence message to the traveller>\",\"trip\":{\"name\":string,\"destinations\":[{\"city\":string,\"country\":string,\"nights\":int}],\"preferences\":{\"travellerType\":\"family|couple|friends|solo|business|mixed|\",\"ages\":{\"adults\":int,\"children\":int,\"toddlers\":int,\"seniors\":int},\"travelStyle\":\"relaxed|balanced|packed|\",\"interests\":[\"attractions|museums|nature|shopping|restaurants|cafes|beaches|themeparks|historical|local|photography|kids\"],\"accessibility\":[\"stroller|wheelchair|lessWalking|indoor|outdoor|noLateNight\"]}},\"suggestions\":[{\"name\":string,\"city\":string,\"why\":string}]}. If the traveller asks to change the trip (add/remove/reorder cities, change nights, change who's travelling, pace, interests, or accessibility, rename), update the trip accordingly and PRESERVE everything they didn't ask to change. If they only ask a question or chat, return the trip EXACTLY as given and put the answer in reply. Always notice and gently flag real issues (backtracking, too-rushed days, a city that doesn't fit their stated tastes) and explain WHY. \"suggestions\" is for curated place ideas: when the traveller asks what to do/see/eat or for recommendations, fill it with 3-4 REAL, well-known places in cities ON THIS TRIP, each with a one-sentence \"why\" tailored to their stated preferences (city must be one of the trip's cities). Otherwise return \"suggestions\":[]. Never invent places you are not confident are real. Use ONLY the listed enum values. JSON only, no prose.",
    },
    ...history,
    { role: "user", content: `CURRENT TRIP:\n${tripJson}\n\nTraveller says: "${message}"\n\nReturn the JSON now.` },
  ];
}
export function insightsMessages(ctx: TripContext): AIMessage[] {
  return [
    { role: "system", content: "You give short, concrete planning tips for a trip and return ONLY valid JSON. Each tip is one sentence about ordering, proximity, opening hours, meals, pacing, or kid fit." },
    { role: "user", content: `${contextBlock(ctx)}\n\nReturn JSON: {"insights":["tip one","tip two","tip three"]}. Give 2-4 tips based on the selected places. JSON only, no prose.` },
  ];
}
