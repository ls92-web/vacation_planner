"use client";

import { useMemo, useState } from "react";
import { Info, Sparkle } from "@/components/icons";
import { streamAssistantReply } from "@/lib/ai-client";
import type { TripContext } from "@/lib/ai";
import { formatKm, haversineKm, SLOTS, type ItineraryItem } from "@/lib/places";
import { usePlanner } from "@/lib/planner/store";

/** Deterministic, real-data insights about the active day. */
function buildInsights(items: ItineraryItem[], units: "km" | "mi"): string[] {
  if (items.length === 0) return ["Add places from Explore and I'll help you order them, balance the day, and spot anything too far apart."];
  const out: string[] = [];
  const ordered = [...items].sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.position - b.position);

  // proximity
  for (let i = 0; i < ordered.length && out.length < 1; i++)
    for (let j = i + 1; j < ordered.length; j++) {
      const d = haversineKm(ordered[i].place.position, ordered[j].place.position);
      if (d < 0.4) {
        out.push(`${ordered[i].place.name} and ${ordered[j].place.name} are only ${formatKm(d, units)} apart — easy to pair.`);
        break;
      }
    }
  // far-apart consecutive
  for (let i = 0; i < ordered.length - 1; i++) {
    const d = haversineKm(ordered[i].place.position, ordered[i + 1].place.position);
    if (d > 6) {
      out.push(`${ordered[i].place.name} and ${ordered[i + 1].place.name} are ${formatKm(d, units)} apart — consider reordering to cut backtracking.`);
      break;
    }
  }
  // overload
  for (const slot of SLOTS) {
    const n = items.filter((it) => it.slot === slot).length;
    if (n > 3) {
      out.push(`Your ${slot} has ${n} stops — that may feel rushed. I can move one to another part of the day.`);
      break;
    }
  }
  // total time
  const totalMin = items.reduce((sum, it) => sum + it.place.estDurationMin, 0);
  out.push(`This day totals about ${Math.round((totalMin / 60) * 10) / 10} hours of visits across ${items.length} stop${items.length !== 1 ? "s" : ""}.`);
  // food
  const food = items.filter((it) => ["restaurants", "cafes", "breakfast"].includes(it.place.category)).length;
  if (food >= 2) out.push(`You've got ${food} food stops planned — nicely spaced for breaks.`);

  return out.slice(0, 4);
}

export function AssistantInsights({ dayItems }: { dayItems: ItineraryItem[] }) {
  const { state } = usePlanner();
  const insights = useMemo(() => buildInsights(dayItems, state.units), [dayItems, state.units]);
  const [aiText, setAiText] = useState("");
  const [loading, setLoading] = useState(false);

  const optimize = async () => {
    if (!dayItems.length || loading) return;
    setLoading(true);
    setAiText("");
    const ctx: TripContext = {
      destination: state.destination,
      travelers: "a family with two young kids (6 & 9)",
      numDays: state.dayCount,
      selected: dayItems.map((it) => ({
        name: it.place.name,
        category: it.place.category,
        type: it.place.category,
        priority: it.slot,
        lat: it.place.position.lat,
        lng: it.place.position.lng,
      })),
    };
    try {
      await streamAssistantReply(
        ctx,
        [{ role: "user", content: `Optimize Day ${state.day + 1}: suggest a better order and timing, flag anything far apart or overloaded, and recommend nearby swaps. Be concise (a short bullet list).` }],
        (full) => setAiText(full)
      );
    } catch {
      setAiText("AI optimization is unavailable right now — your heuristic insights above still apply.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-line rounded-[18px] p-4">
      <div className="flex items-center gap-1.5 font-display font-bold text-[15px]">
        <span className="text-accent flex"><Sparkle size={16} strokeWidth={1.7} /></span>
        AI travel assistant
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {insights.map((text, i) => (
          <div key={i} className="flex gap-2.5 px-3 py-2.5 rounded-xl bg-tint vp-slide-up">
            <span className="text-accent shrink-0 mt-px flex"><Info size={15} strokeWidth={2} /></span>
            <span className="text-[12.5px] text-ink leading-[1.45]">{text}</span>
          </div>
        ))}
      </div>

      {aiText && (
        <div className="mt-3 px-3 py-2.5 rounded-xl border border-line bg-white text-[12.5px] text-ink leading-[1.5] whitespace-pre-wrap vp-fade-fast">
          {aiText}
        </div>
      )}

      <button
        onClick={optimize}
        disabled={!dayItems.length || loading}
        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-none bg-accent text-white text-[13.5px] font-bold cursor-pointer transition hover:brightness-[1.06] disabled:opacity-50"
      >
        <Sparkle size={15} strokeWidth={1.7} />
        {loading ? "Optimizing…" : "Optimize this day with AI"}
      </button>
    </div>
  );
}
