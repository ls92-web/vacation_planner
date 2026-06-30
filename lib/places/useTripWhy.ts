"use client";

import { useEffect, useRef, useState } from "react";
import { fetchRecommendations } from "@/lib/ai-client";
import type { ExplorePlace } from "./types";

interface WhyContext {
  destination: string;
  /** Preference summary used as the traveller context. */
  travelers: string;
  numDays: number;
}

const norm = (s: string) => s.trim().toLowerCase();
const MAX_CANDIDATES = 14;

/**
 * Optional LLM layer on top of the rule-based ranking: asks the `ai` edge function
 * for a one-line "why this fits the trip" per place. Returns a placeId → sentence
 * map. Debounced + cached per (destination · prefs · place set); fails silent so
 * the cards still show their rule-based badges when AI is off or rate-limited.
 */
export function useTripWhy(places: ExplorePlace[], ctx: WhyContext, enabled: boolean): Record<string, string> {
  const [why, setWhy] = useState<Record<string, string>>({});
  const cache = useRef<Map<string, Record<string, string>>>(new Map());

  const subset = places.slice(0, MAX_CANDIDATES);
  const sig = enabled && ctx.travelers ? `${ctx.destination}::${ctx.travelers}::${subset.map((p) => p.id).join(",")}` : "";

  useEffect(() => {
    if (!sig) { setWhy({}); return; }
    const cached = cache.current.get(sig);
    if (cached) { setWhy(cached); return; }

    let cancelled = false;
    const t = setTimeout(async () => {
      const candidates = subset.map((p) => ({ name: p.name, category: p.category }));
      const recs = await fetchRecommendations(
        { destination: ctx.destination, travelers: ctx.travelers, numDays: Math.max(1, ctx.numDays) },
        candidates
      ).catch(() => null);
      if (cancelled || !recs) return;
      const byNorm = new Map(subset.map((p) => [norm(p.name), p.id]));
      const map: Record<string, string> = {};
      for (const r of recs) {
        const id = r?.name ? byNorm.get(norm(r.name)) : undefined;
        if (id && r.why?.trim()) map[id] = r.why.trim();
      }
      cache.current.set(sig, map);
      if (!cancelled) setWhy(map);
    }, 900);

    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return why;
}
