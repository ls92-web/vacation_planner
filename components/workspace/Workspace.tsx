"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Clock, Compass, Lightbulb, MapPin, Moon, Plus, Send, Sparkles, Star, Wallet, X } from "lucide-react";
import { queryLink } from "@/lib/maps";
import { getRepository } from "@/lib/itinerary/repository";
import { geocodeCity } from "@/lib/geo";
import { SLOT_LABELS, SLOTS, type ExplorePlace, type ItineraryItem } from "@/lib/places";
import { planTrip, type PlaceSuggestion } from "@/lib/ai-client";
import { applyScheduleOps, dayStructure, serializeSchedule } from "@/lib/planner/schedulePlan";
import { optimizeDay } from "@/lib/planner/optimize";
import { lookupPlace } from "@/lib/places/lookup";
import { buildWeatherContext, type DaySignal } from "@/lib/weather/signal";
import { describeWeather } from "@/lib/weather/codes";
import { buildBudgetContext, type BudgetDaySignal } from "@/lib/budget/signal";
import { buildTransportContext } from "@/lib/planner/transportSignal";
import { deriveBriefing, deriveInsights, nextActions, type Insight } from "@/lib/planner/insights";
import { withSave } from "@/lib/ui/saveStatus";
import { useTrip } from "@/lib/store";
import { useTrips } from "@/lib/trips/store";
import { useTripLoader } from "@/lib/trips/useTripLoader";
import type { ComposedTrip } from "@/lib/ai-client";
import { applyTrip } from "@/lib/trips/applyTrip";
import { loadChat, saveChat, saveTrip, type ChatTurn } from "@/lib/destinations/repository";
import { TripContextCard } from "./TripContextCard";
import { fmtMonthDay, MODE_TEMPLATES, nightsBetween, recommend } from "@/lib/data";
import { addBreakdowns, computeBudget, convertCostText, EMPTY_BREAKDOWN, formatMoney } from "@/lib/budget/estimate";
import { useCurrency } from "@/lib/budget/useCurrency";
import { summarizePreferences } from "@/lib/trips/preferences";
import { GoogleMap, MapsApiProvider } from "@/components/maps";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import type { LatLng } from "@/lib/maps";
import { CityImage } from "@/components/destinations/CityImage";
import { ExportControl } from "@/components/export/ExportButton";
import { ImmersiveMenu } from "@/components/immersive/ImmersiveMenu";
import { JourneyCore, type CoreNode } from "@/components/immersive/JourneyCore";
import { Logo } from "@/components/Logo";

const sigOf = (t: ComposedTrip) =>
  JSON.stringify({ n: t.name, d: t.destinations.map((x) => `${x.city.toLowerCase()}#${x.nights}`), p: t.preferences });

/** Stable id for a suggested place, so saving is idempotent and "saved" survives reload. */
const suggestionId = (s: PlaceSuggestion) => `sugg:${s.city.toLowerCase()}:${s.name.toLowerCase()}`.replace(/\s+/g, "-");

/** A curated suggestion enriched with real Places data (as stored in chat memory). */
type RichSuggestion = NonNullable<ChatTurn["suggestions"]>[number];

/** Rough visit-duration estimate from place types, for the premium card. */
function estVisit(types?: string[]): string {
  const t = types ?? [];
  if (t.some((x) => ["restaurant", "cafe", "bar", "bakery"].includes(x))) return "~1h";
  if (t.some((x) => ["museum", "art_gallery", "aquarium", "zoo", "amusement_park"].includes(x))) return "~2–3h";
  if (t.some((x) => ["park", "tourist_attraction", "natural_feature"].includes(x))) return "~1–2h";
  return "~2h";
}

/** The companion "speaks" — reveals its reply progressively, like it's thinking aloud. */
function TypedText({ text, onTick }: { text: string; onTick?: () => void }) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) { setN(text.length); return; }
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(text.length, i + 2);
      setN(i);
      onTick?.();
      if (i >= text.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="type-caret" aria-hidden />}
    </>
  );
}

export function Workspace() {
  const { state, actions } = useTrip();
  const { activeTrip, actions: tripActions } = useTrips();
  const loadPlan = useTripLoader();
  const currency = useCurrency();

  const [messages, setMessages] = useState<ChatTurn[]>([]);
  // Which assistant message is currently "being spoken" (streamed in). -1 = none.
  const [animateIdx, setAnimateIdx] = useState(-1);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // Particle bursts that flow from a tapped action toward the AI brandmark.
  const headerLogoRef = useRef<HTMLButtonElement>(null);
  const burstId = useRef(0);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; dots: { dx: number; dy: number }[] }[]>([]);
  const fireBurst = (from: HTMLElement) => {
    const target = headerLogoRef.current;
    if (!target) return;
    const a = from.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const ox = a.left + a.width / 2, oy = a.top + a.height / 2;
    const tx = b.left + b.width / 2, ty = b.top + b.height / 2;
    const dots = Array.from({ length: 7 }, (_, i) => ({ dx: tx - ox + (i - 3) * 9, dy: ty - oy + (i % 2 ? -6 : 6) }));
    const id = ++burstId.current;
    setBursts((p) => [...p, { id, x: ox, y: oy, dots }]);
    setTimeout(() => setBursts((p) => p.filter((x) => x.id !== id)), 1000);
  };
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const itineraryRef = useRef<ItineraryItem[]>([]);
  itineraryRef.current = itinerary;
  const [weatherByDay, setWeatherByDay] = useState<Map<number, DaySignal>>(new Map());
  const weatherTextRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Budget signal: derived synchronously from the plan + trip level (no fetch).
  const budget = useMemo(
    () => buildBudgetContext(state.destinations, itinerary, state.adults + state.kids, state.budgetLevel, currency),
    [state.destinations, itinerary, state.adults, state.kids, state.budgetLevel, currency]
  );
  const budgetTextRef = useRef("");
  budgetTextRef.current = budget.text;
  // Transport signal: inter-city legs (mode/duration/cost/travel day).
  const transportTextRef = useRef("");
  transportTextRef.current = useMemo(
    () => buildTransportContext(state.destinations, state.transports, currency).text,
    [state.destinations, state.transports, currency]
  );

  const saved = useMemo(() => state.destinations.filter((d) => d.saved && d.name.trim()), [state.destinations]);
  // Proactive intelligence: the companion's own observations about the current plan.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // One-time trip-context prompt (who's travelling / pace / budget / interests).
  const [ctxDismissed, setCtxDismissed] = useState<Set<string>>(new Set());
  const insights = useMemo(
    () => deriveInsights(saved, itinerary, weatherByDay, budget.byDay, state.budgetLevel, state.transports, 3),
    [saved, itinerary, weatherByDay, budget.byDay, state.budgetLevel, state.transports]
  );
  const activeInsights = insights.filter((i) => !dismissed.has(i.id));
  const travelers = state.adults + state.kids;
  const struct: ComposedTrip = useMemo(
    () => ({
      name: activeTrip?.name || state.dest.split(",")[0] || "Your trip",
      destinations: saved.map((d) => ({ city: d.name, country: d.country, nights: nightsBetween(d.arrive, d.depart) || 2 })),
      preferences: state.preferences,
    }),
    [activeTrip?.name, saved, state.preferences, state.dest]
  );

  // Load this trip's conversation memory + which suggested places are already saved.
  const greeted = useRef(false);
  const [itinLoaded, setItinLoaded] = useState(false);
  // Proactive conflict nudges: remember which issues already existed so the
  // companion only speaks up about NEW ones an edit introduces.
  const nudgeSeen = useRef<Set<string>>(new Set());
  const nudgeBaseline = useRef(false);
  useEffect(() => {
    greeted.current = false;
    nudgeBaseline.current = false;
    nudgeSeen.current = new Set();
    setSavedIds(new Set());
    setItinerary([]);
    setItinLoaded(false);
    if (!activeTrip) return;
    let cancelled = false;
    loadChat(activeTrip.id).then((chat) => {
      if (cancelled) return;
      if (chat.length) { greeted.current = true; setMessages(chat); }
      else setMessages([]);
    });
    getRepository().listFavorites(activeTrip.id).then((favs) => {
      if (!cancelled) setSavedIds(new Set(favs.map((p) => p.id)));
    }).catch(() => {});
    getRepository().listItinerary(activeTrip.id)
      .then((items) => { if (!cancelled) setItinerary(items); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setItinLoaded(true); }); // greet only once the plan is known
    return () => { cancelled = true; };
  }, [activeTrip?.id]);

  // Save a suggested place to this trip (shows on the Saved Places page).
  const saveSuggestion = async (s: RichSuggestion) => {
    if (!activeTrip) return;
    const id = suggestionId(s);
    if (savedIds.has(id)) return;
    setSavedIds((prev) => new Set(prev).add(id)); // optimistic
    let place: ExplorePlace;
    if (s.placeId && typeof s.lat === "number") {
      // Already enriched on the card — reuse it (no second lookup).
      place = {
        id, placeId: s.placeId, name: s.name, category: "Recommended",
        position: { lat: s.lat, lng: s.lng ?? 0 },
        rating: s.rating, priceLevel: s.priceLevel, hours: s.hours, photoUrl: s.photoUrl,
        address: s.address ?? s.city, description: s.why, tags: [], estDurationMin: 120, recommendedSlot: "morning",
        googleTypes: s.types, source: "google",
      };
    } else {
      // Fall back: look up now, else a city-centre geocode so the pin never lands at 0,0.
      const hit = await lookupPlace(`${s.name}, ${s.city}`).catch(() => null);
      if (hit) {
        place = {
          id, placeId: hit.id, name: hit.name || s.name, category: "Recommended",
          position: hit.position ?? { lat: 0, lng: 0 },
          rating: hit.rating, reviews: hit.reviews, priceLevel: hit.priceLevel, openNow: hit.openNow,
          hours: hit.hours, photoUrl: hit.photoUrl, address: hit.address ?? s.city,
          description: s.why || hit.description || "", tags: [], estDurationMin: 120, recommendedSlot: "morning",
          googleTypes: hit.googleTypes, source: "google",
        };
      } else {
        let g = await geocodeCity(s.name, s.city).catch(() => null);
        if (!g || (g.lat === 0 && g.lng === 0)) g = await geocodeCity(s.city).catch(() => null);
        place = {
          id, name: s.name, category: "Recommended",
          position: { lat: g?.lat ?? 0, lng: g?.lng ?? 0 },
          address: s.city, description: s.why, tags: [], estDurationMin: 120, recommendedSlot: "morning",
          source: "curated",
        };
      }
    }
    try {
      await getRepository().setFavorite(activeTrip.id, s.city, place, true);
    } catch {
      setSavedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); // roll back
      actions.flash("Couldn't save that place — try again.");
    }
  };

  /** Quick Add — drop a suggested place straight into the plan (the AI places it well). */
  const quickAdd = (s: RichSuggestion) => send(`Add ${s.name} in ${s.city} to my plan`);

  // Trip-context prompt: persist the tapped answers to this trip's preferences + budget.
  const applyContext = (patch: Partial<typeof state.preferences>, budget: typeof state.budgetLevel) => {
    if (!activeTrip) return;
    actions.setTripPreferences(patch);
    actions.setBudgetLevel(budget);
    withSave(saveTrip(activeTrip.id, state.destinations, budget, state.transports, { ...state.preferences, ...patch }));
    setCtxDismissed((prev) => new Set(prev).add(activeTrip.id));
    actions.flash("Got it — I'll tailor this trip to that.");
  };
  const skipContext = () => { if (activeTrip) setCtxDismissed((prev) => new Set(prev).add(activeTrip.id)); };
  const needsContext = !!activeTrip && saved.length > 0 && !ctxDismissed.has(activeTrip.id) &&
    (!state.preferences.travellerType || !(state.preferences.interests && state.preferences.interests.length));

  // Greet once the trip's cities AND its plan are loaded — so the companion can
  // open with a real, proactive read on the itinerary rather than a generic hello.
  useEffect(() => {
    if (greeted.current || !activeTrip || messages.length || !saved.length || !itinLoaded) return;
    greeted.current = true;
    const briefing = deriveBriefing(saved, itineraryRef.current, weatherByDay, budget.byDay, state.budgetLevel, state.transports, struct.name);
    setMessages([{ role: "assistant", content: briefing }]);
    setAnimateIdx(0); // the companion "arrives" — its assessment streams in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.length, messages.length, activeTrip?.id, itinLoaded]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, sending]);

  // Weather signal: refresh the per-day forecast whenever the route/dates change.
  // Feeds both the AI (weatherTextRef, sent with each message) and the itinerary UI.
  const weatherKey = saved.map((d) => `${d.name}:${d.lat},${d.lng}:${d.arrive}:${d.depart}`).join("|");
  useEffect(() => {
    if (!saved.length) { setWeatherByDay(new Map()); weatherTextRef.current = ""; return; }
    let cancelled = false;
    buildWeatherContext(state.destinations).then((ctx) => {
      if (cancelled) return;
      weatherTextRef.current = ctx.text;
      setWeatherByDay(ctx.byDay);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherKey]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || sending || !activeTrip) return;
    const history = messages;
    const afterUser = [...messages, { role: "user" as const, content: text }];
    setMessages(afterUser);
    setInput("");
    setSending(true);
    try {
      // Serialize the live schedule so the companion can edit existing stops by ref.
      const { text: scheduleText, refMap } = serializeSchedule(state.destinations, itineraryRef.current);
      const res = await planTrip(struct, scheduleText, weatherTextRef.current, budgetTextRef.current, transportTextRef.current, Object.keys(refMap), history, text);
      if (res) {
        const ck = (n: string) => n.split(",")[0].trim().toLowerCase();
        const cityCenter = (city: string): LatLng | null => {
          const d = saved.find((x) => ck(x.name) === ck(city));
          return d && typeof d.lat === "number" && typeof d.lng === "number" && !(d.lat === 0 && d.lng === 0) ? { lat: d.lat, lng: d.lng } : null;
        };
        // (1) Structural change → rebuild destinations + rehydrate the store.
        if (res.trip && sigOf(res.trip) !== sigOf(struct)) {
          await applyTrip(activeTrip.id, res.trip, state.destinations, state.budgetLevel);
          if (res.trip.name && res.trip.name !== activeTrip.name) await tripActions.rename(activeTrip.id, res.trip.name);
          await loadPlan(activeTrip.id, res.trip.destinations[0].city);
        }
        // (2) Schedule change → enrich added stops with real Google Places data,
        //     then apply minimal edit ops onto the live stops (preserving the rest) + persist.
        if (res.ops) {
          const enrichByIndex = new Map<number, Awaited<ReturnType<typeof lookupPlace>>>();
          await Promise.all(
            res.ops.map(async (op, i) => {
              if (op.op !== "add" || !op.name) return;
              const hit = await lookupPlace(`${op.name}, ${op.city}`, cityCenter(op.city));
              if (hit) enrichByIndex.set(i, hit);
            })
          );
          const items = applyScheduleOps(itineraryRef.current, res.ops, refMap, state.destinations, (i) => enrichByIndex.get(i) ?? undefined);
          setItinerary(items);
          withSave(getRepository().saveItinerary(activeTrip.id, state.destinations[0]?.name ?? "", items));
        }
        // (3) Curated suggestions → enrich into premium cards (photo/rating/hours/place_id).
        let rich: RichSuggestion[] | undefined;
        if (res.suggestions?.length) {
          rich = await Promise.all(
            res.suggestions.map(async (s) => {
              const hit = await lookupPlace(`${s.name}, ${s.city}`, cityCenter(s.city)).catch(() => null);
              return hit
                ? { ...s, placeId: hit.id, photoUrl: hit.photoUrl, rating: hit.rating, hours: hit.hours, address: hit.address, lat: hit.position?.lat, lng: hit.position?.lng, priceLevel: hit.priceLevel, types: hit.googleTypes }
                : s;
            })
          );
        }
        const full = [...afterUser, { role: "assistant" as const, content: res.reply, suggestions: rich }];
        setMessages(full);
        setAnimateIdx(full.length - 1);
        saveChat(activeTrip.id, full);
      } else {
        const full = [...afterUser, { role: "assistant" as const, content: "I couldn't update that just now — mind rephrasing?" }];
        setMessages(full);
        setAnimateIdx(full.length - 1);
        saveChat(activeTrip.id, full);
      }
    } finally {
      setSending(false);
    }
  };

  // Remove one stop from the living schedule (quick action; chat can do more).
  const removeStop = (placeId: string) => {
    if (!activeTrip) return;
    const items = itineraryRef.current.filter((it) => it.place.id !== placeId);
    setItinerary(items);
    withSave(getRepository().saveItinerary(activeTrip.id, state.destinations[0]?.name ?? "", items));
  };

  // The companion posts an unprompted message (nudge / confirmation), streamed in.
  const sayProactively = (content: string) => {
    if (!activeTrip) return;
    const full = [...messages, { role: "assistant" as const, content }];
    setMessages(full);
    setAnimateIdx(full.length - 1);
    saveChat(activeTrip.id, full);
  };

  // Inline "Apply" — a real, instant, deterministic route reorder (no AI round-trip).
  const optimizeDayNow = (apply: NonNullable<Insight["apply"]>) => {
    if (!activeTrip) return;
    const res = optimizeDay(itineraryRef.current, apply.destId, apply.day);
    if (!res) { actions.flash("That day's route is already efficient."); return; }
    setItinerary(res.items);
    withSave(getRepository().saveItinerary(activeTrip.id, state.destinations[0]?.name ?? "", res.items));
    sayProactively(`Done — I reordered Day ${apply.globalDay} into an efficient loop: same stops, about ${Math.round(res.savedKm)} km less walking.`);
  };

  // Baseline: record the issues already present when the plan loads, so nudges
  // only fire for problems a later edit actually introduces (not pre-existing ones).
  useEffect(() => {
    if (!itinLoaded || nudgeBaseline.current) return;
    nudgeSeen.current = new Set(deriveInsights(saved, itineraryRef.current, weatherByDay, budget.byDay, state.budgetLevel, state.transports, 8).map((i) => i.id));
    nudgeBaseline.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itinLoaded]);

  // Speak up when an edit introduces a NEW structural conflict (timing / meal / overload).
  useEffect(() => {
    if (!itinLoaded || !nudgeBaseline.current || sending || !activeTrip) return;
    const all = deriveInsights(saved, itinerary, weatherByDay, budget.byDay, state.budgetLevel, state.transports, 8);
    const fresh = all.filter((i) => !nudgeSeen.current.has(i.id) && (i.kind === "hours" || i.kind === "meal" || i.kind === "busy"));
    nudgeSeen.current = new Set([...nudgeSeen.current, ...all.map((i) => i.id)]);
    if (fresh.length) sayProactively(`Heads up — ${fresh[0].text}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itinerary]);

  return (
    <MapsApiProvider>
    <div className="imm-bg h-screen w-full flex flex-col lg:flex-row overflow-hidden font-body text-white screen-stage">
      {/* ============ Chat (primary) ============ */}
      <section className="flex flex-col lg:w-[40%] lg:max-w-[520px] h-[52vh] lg:h-full border-b lg:border-b-0 lg:border-r border-white/10" style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(10px)" }}>
        <header className="flex items-center gap-2.5 px-4 h-[58px] border-b border-white/10 shrink-0">
          <button ref={headerLogoRef} onClick={actions.goWelcome} title="New journey" className="flex items-center gap-2 cursor-pointer">
            <Logo size={26} variant="plain" animated={sending} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold text-[15px] leading-tight truncate">{activeTrip?.name || "Your trip"}</div>
            <div className="text-[11.5px] text-white/55 flex items-center gap-1"><Sparkles size={11} style={{ color: "var(--accent)" }} />AI travel companion</div>
          </div>
          <ImmersiveMenu />
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto imm-scroll px-4 py-4 flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[88%] ${m.role === "user" ? "self-end" : "self-start"}`}>
              <div
                className="rounded-[16px] px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap"
                style={m.role === "user"
                  ? { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 4 }
                  : { background: "rgba(255,255,255,.07)", color: "#fff", border: "1px solid rgba(255,255,255,.12)", borderBottomLeftRadius: 4 }}
              >
                {m.role === "assistant" && i === animateIdx
                  ? <TypedText text={m.content} onTick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })} />
                  : m.content}
              </div>
              {m.role === "assistant" && m.suggestions?.length ? (
                <div className="mt-2 flex flex-col gap-2">
                  {m.suggestions.map((s, si) => {
                    const isSaved = savedIds.has(suggestionId(s));
                    const price = s.priceLevel != null && s.priceLevel > 0 ? "$".repeat(Math.min(4, s.priceLevel)) : "";
                    return (
                      <div key={si} className="imm-glass rounded-[16px] overflow-hidden vp-fade-fast">
                        {s.photoUrl && (
                          <div className="relative h-[118px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.photoUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(6,12,22,0) 40%, rgba(6,12,22,.6))" }} />
                            <div className="absolute bottom-2 left-3 right-3 text-white">
                              <div className="font-display font-bold text-[14.5px] leading-tight truncate" style={{ textShadow: "0 1px 6px rgba(0,0,0,.5)" }}>{s.name}</div>
                              <div className="text-[11px] text-white/80">{s.city}</div>
                            </div>
                          </div>
                        )}
                        <div className="p-3.5">
                          {!s.photoUrl && (
                            <>
                              <div className="font-display font-bold text-[14px] leading-tight">{s.name}</div>
                              <div className="text-[11px] text-white/50">{s.city}</div>
                            </>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-white/60">
                            {s.rating != null && <span className="inline-flex items-center gap-1" style={{ color: "#E0A44F" }}><Star size={10} fill="currentColor" stroke="none" /><span className="text-white/80 font-semibold">{s.rating.toFixed(1)}</span></span>}
                            <span className="inline-flex items-center gap-1"><Clock size={11} />{estVisit(s.types)}</span>
                            {s.hours && <span className="truncate max-w-[150px]">{s.hours}</span>}
                            {price && <span className="text-white/70">{price}</span>}
                          </div>
                          {s.why && <div className="text-[12px] text-white/75 mt-2 leading-snug">{s.why}</div>}
                          <div className="mt-2.5 flex items-center gap-2">
                            <button
                              onClick={() => quickAdd(s)}
                              disabled={sending}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11.5px] font-bold text-white cursor-pointer transition hover:brightness-[1.06] disabled:opacity-50"
                              style={{ background: "var(--accent)" }}
                            >
                              <Plus size={12} strokeWidth={2.4} />Add to plan
                            </button>
                            <button
                              onClick={() => saveSuggestion(s)}
                              disabled={isSaved}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11.5px] font-semibold transition cursor-pointer disabled:cursor-default border"
                              style={isSaved ? { background: "rgba(255,255,255,.12)", color: "#fff", borderColor: "transparent" } : { background: "transparent", color: "rgba(255,255,255,.8)", borderColor: "rgba(255,255,255,.15)" }}
                            >
                              {isSaved ? <><Check size={12} />Saved</> : <>Save</>}
                            </button>
                            <a
                              href={queryLink(`${s.name}, ${s.city}`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11.5px] font-semibold text-white/60 cursor-pointer hover:text-white transition"
                            >
                              <MapPin size={12} />Map
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
          {sending && (
            <div className="self-start rounded-[16px] pl-2 pr-3.5 py-2 imm-glass inline-flex items-center gap-2 vp-fade-fast" style={{ borderBottomLeftRadius: 4 }}>
              <Logo size={22} variant="plain" animated />
              <span className="text-[12.5px] text-white/70" style={{ animation: "logo_halo 1.8s var(--ease-soft) infinite" }}>Charting your journey…</span>
            </div>
          )}
        </div>

        <div className="shrink-0 px-3 pb-3 pt-1">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {nextActions(saved, itinerary).map((q) => (
              <button
                key={q}
                onClick={(e) => { fireBurst(e.currentTarget); send(q); }}
                disabled={sending}
                className="constellation-chip disabled:opacity-40 disabled:cursor-default"
              >
                <span className="constellation-star" aria-hidden />
                {q}
              </button>
            ))}
          </div>
          <div className="imm-glass flex items-end gap-2 rounded-[16px] p-2" style={{ boxShadow: "0 8px 24px -16px rgba(0,0,0,.5)" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder="Tell me how to shape this trip…"
              className="flex-1 resize-none bg-transparent outline-none border-none px-2 py-1.5 text-[14px] leading-relaxed text-white placeholder:text-white/40 max-h-[120px]"
            />
            <button onClick={() => send()} disabled={sending || !input.trim()} className="shrink-0 w-9 h-9 rounded-[12px] grid place-items-center cursor-pointer disabled:opacity-40 hover:brightness-[1.08] active:scale-95" style={{ background: "var(--accent)", color: "#fff", transition: "transform .2s var(--ease-spring), filter .2s ease" }}>
              <Send size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </section>

      {/* ============ Live journey ============ */}
      <section className="flex-1 overflow-y-auto imm-scroll">
        {needsContext && (
          <div className="max-w-[760px] mx-auto px-[clamp(16px,3vw,28px)] pt-6">
            <TripContextCard preferences={state.preferences} budgetLevel={state.budgetLevel} onApply={applyContext} onSkip={skipContext} />
          </div>
        )}
        <JourneyPanel saved={saved} travelers={travelers} currency={currency} budgetLevel={state.budgetLevel} preferences={summarizePreferences(state.preferences, state.budgetLevel)} itinerary={itinerary} onRemoveStop={removeStop} weatherByDay={weatherByDay} budgetByDay={budget.byDay} transports={state.transports} insights={activeInsights} coreState={sending ? "routing" : "idle"} onInsightAction={(it) => { setDismissed((prev) => new Set(prev).add(it.id)); if (it.apply) optimizeDayNow(it.apply); else send(it.message); }} onInsightDismiss={(id) => setDismissed((prev) => new Set(prev).add(id))} />
      </section>

      {/* particle bursts flowing toward the companion */}
      <div className="fixed inset-0 pointer-events-none z-[60]">
        {bursts.map((b) => (
          <span key={b.id} className="fixed" style={{ left: b.x, top: b.y }}>
            {b.dots.map((dt, i) => (
              <span key={i} className="burst-dot" style={{ ["--dx" as string]: `${dt.dx}px`, ["--dy" as string]: `${dt.dy}px`, animationDelay: `${i * 0.02}s` }} />
            ))}
          </span>
        ))}
      </div>
    </div>
    </MapsApiProvider>
  );
}

function JourneyPanel({ saved, travelers, currency, budgetLevel, preferences, itinerary, onRemoveStop, weatherByDay, budgetByDay, transports, insights, coreState, onInsightAction, onInsightDismiss }: {
  saved: ReturnType<typeof useTrip>["state"]["destinations"];
  travelers: number; currency: ReturnType<typeof useCurrency>; budgetLevel: "budget" | "standard" | "luxury"; preferences: string;
  itinerary: ItineraryItem[];
  onRemoveStop: (placeId: string) => void;
  weatherByDay: Map<number, DaySignal>;
  budgetByDay: Map<number, BudgetDaySignal>;
  transports: Record<string, string>;
  insights: Insight[];
  coreState: "idle" | "thinking" | "routing";
  onInsightAction: (insight: Insight) => void;
  onInsightDismiss: (id: string) => void;
}) {
  const geo = saved.filter((d) => typeof d.lat === "number" && typeof d.lng === "number" && !(d.lat === 0 && d.lng === 0));
  const center: LatLng = geo[0] ? { lat: geo[0].lat as number, lng: geo[0].lng as number } : { lat: 41.39, lng: 2.16 };
  // The trip's cities become the Core's destination nodes; consecutive nodes draw the route.
  const coreNodes: CoreNode[] = saved.length <= 1
    ? [{ x: 0, y: 0, active: true }]
    : saved.map((_, i) => { const ang = -Math.PI / 2 + (i / saved.length) * 2 * Math.PI; return { x: Math.cos(ang) * 0.6, y: Math.sin(ang) * 0.6, active: i === 0 }; });
  const totalNights = saved.reduce((s, d) => s + (nightsBetween(d.arrive, d.depart) || 0), 0);
  let agg = EMPTY_BREAKDOWN; let budgetTotal = 0;
  for (const d of saved) {
    const b = computeBudget({ travelers, nights: nightsBetween(d.arrive, d.depart) || 0, hotels: d.accoms.length, level: budgetLevel });
    agg = addBreakdowns(agg, b);
    budgetTotal += typeof d.budgetOverride === "number" ? d.budgetOverride : b.total;
  }
  const span = saved.length && saved[0].arrive ? `${fmtMonthDay(saved[0].arrive)} – ${fmtMonthDay(saved[saved.length - 1].depart)}` : "Dates flexible";

  if (!saved.length) {
    return (
      <div className="h-full grid place-items-center p-8 text-center text-white">
        <div>
          <Compass size={40} strokeWidth={1.5} className="mx-auto" style={{ color: "var(--accent)" }} />
          <div className="font-display font-bold text-[18px] mt-3">Your journey will appear here</div>
          <p className="text-white/55 text-[13.5px] mt-1 max-w-[320px]">Tell the companion where you&apos;d like to go and watch the trip build itself.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[760px] mx-auto px-[clamp(16px,3vw,28px)] py-6">
      {/* proactive intelligence */}
      <InsightBar insights={insights} onAction={onInsightAction} onDismiss={onInsightDismiss} />

      {/* Living Journey Canvas — atmospheric map behind the intelligence Core */}
      <div className="relative rounded-[24px] overflow-hidden border border-white/[0.06] h-[clamp(240px,34vh,320px)]">
        <div className="jc-atmomap absolute inset-0">
          <ErrorBoundary fallback={() => null}>
            <GoogleMap atmospheric center={center} zoom={4} className="absolute inset-0 h-full w-full" fallback={<div className="absolute inset-0" style={{ background: "radial-gradient(120% 120% at 50% 30%, #16233c, #060c16)" }} />} />
          </ErrorBoundary>
        </div>
        <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(115% 85% at 50% 8%, rgba(6,12,22,0) 30%, rgba(6,12,22,.78) 82%), linear-gradient(180deg, rgba(6,12,22,.4), rgba(6,12,22,.15))" }} />
        <div className="absolute inset-0 grid place-items-center">
          <JourneyCore size="clamp(200px,26vh,280px)" state={coreState} nodes={coreNodes} />
        </div>
      </div>

      {/* summary strip */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-white/85">
        <span className="inline-flex items-center gap-1.5"><MapPin size={14} style={{ color: "var(--accent)" }} />{saved.length} {saved.length === 1 ? "city" : "cities"}</span>
        <span className="inline-flex items-center gap-1.5"><Moon size={14} style={{ color: "var(--accent)" }} />{totalNights} night{totalNights !== 1 ? "s" : ""}</span>
        <span className="inline-flex items-center gap-1.5 text-white/55">{span}</span>
        <span className="inline-flex items-center gap-1.5 ml-auto font-bold text-white"><Wallet size={14} style={{ color: "var(--accent)" }} />{formatMoney(budgetTotal, currency)}</span>
      </div>
      {preferences && <div className="mt-2 text-[12px] text-white/55">{preferences}</div>}

      {/* the journey */}
      <div className="mt-5 flex flex-col">
        {saved.map((d, i) => {
          const next = saved[i + 1];
          const n = nightsBetween(d.arrive, d.depart);
          return (
            <div key={d.id}>
              <div className="imm-glass flex gap-3.5 rounded-[18px] overflow-hidden vp-fade-fast">
                <div className="w-[112px] shrink-0 relative" style={{ background: "rgba(255,255,255,.06)" }}>
                  <CityImage name={d.name} country={d.country} className="absolute inset-0 w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold text-white" style={{ background: "var(--accent)" }}>{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0 py-3 pr-3">
                  <div className="font-display font-bold text-[16px] truncate">{d.name}</div>
                  <div className="text-[12px] text-white/50 truncate">{d.country}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11.5px]">
                    {d.arrive && <span className="px-2 py-0.5 rounded-md text-white/80" style={{ background: "rgba(255,255,255,.08)" }}>{fmtMonthDay(d.arrive)} – {fmtMonthDay(d.depart)}</span>}
                    <span className="px-2 py-0.5 rounded-md text-white/80" style={{ background: "rgba(255,255,255,.08)" }}>{n ?? "—"} night{n !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>
              {next && (() => {
                const rec = recommend(d, next);
                const mode = (transports[rec.key] || rec.recMode) as typeof rec.recMode;
                const tpl = rec.override && rec.override.mode === mode ? rec.override : MODE_TEMPLATES[mode];
                return (
                  <div className="flex items-center gap-2 py-2 pl-[52px] text-[11.5px] text-white/55">
                    <span className="w-px h-4" style={{ background: "rgba(255,255,255,.2)" }} />
                    <span className="font-semibold text-white/90">{mode}</span>
                    <span>· {tpl.duration} · {convertCostText(tpl.cost, currency)} → {next.name}</span>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* living itinerary */}
      <ScheduleView saved={saved} itinerary={itinerary} onRemoveStop={onRemoveStop} weatherByDay={weatherByDay} budgetByDay={budgetByDay} budgetLevel={budgetLevel} />

      {/* actions */}
      <div className="mt-6 flex flex-wrap gap-2.5">
        <ExportControl
          itinerary={itinerary}
          destination={saved[0]?.name ?? ""}
          center={center}
          transportMode="walk"
          units="km"
          label="Export your travel document"
          disabled={!itinerary.length}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[12px] bg-accent text-white text-[13.5px] font-bold cursor-pointer transition hover:brightness-[1.06] disabled:opacity-40"
        />
      </div>
    </div>
  );
}

/* ---------------- the living day-by-day schedule ---------------- */
const totalMinutes = (items: ItineraryItem[]) => items.reduce((s, it) => s + (it.durationMin ?? it.place.estDurationMin), 0);
const fmtHrs = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`; };

/** Proactive, dismissible AI observations — acting on one sends its pre-written prompt. */
function InsightBar({ insights, onAction, onDismiss }: { insights: Insight[]; onAction: (insight: Insight) => void; onDismiss: (id: string) => void }) {
  if (!insights.length) return null;
  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[.14em] text-white/45 mb-0.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)", boxShadow: "0 0 8px 1px color-mix(in oklab, var(--accent) 80%, transparent)", animation: "jc_halo 2.4s var(--ease-soft) infinite" }} />
        Companion analysis
      </div>
      {insights.map((it) => (
        <div key={it.id} className="imm-glass rounded-[14px] px-3.5 py-3 flex items-start gap-3 vp-fade-fast">
          <span className="w-8 h-8 rounded-full grid place-items-center shrink-0 mt-0.5" style={{ background: "rgba(255,255,255,.08)", color: "var(--accent)" }}><Lightbulb size={15} strokeWidth={2} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-white/85 leading-snug">{it.text}</div>
            <div className="mt-2 flex items-center gap-3">
              <button onClick={() => onAction(it)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-bold text-white cursor-pointer transition hover:brightness-[1.06]" style={{ background: "var(--accent)" }}>{it.actionLabel}<ArrowRight size={12} strokeWidth={2.2} /></button>
              <button onClick={() => onDismiss(it.id)} className="text-[12px] font-semibold text-white/45 hover:text-white/70 cursor-pointer transition">Dismiss</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WeatherChip({ w }: { w: DaySignal }) {
  const Icon = describeWeather(w.code).icon;
  const alert = w.hot || w.rain;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      title={`${w.label}${w.seasonal ? " (seasonal average)" : ""}${w.hot ? " · hot" : ""}${w.rain ? " · rain likely" : ""}`}
      style={alert ? { background: "#FCEFD6", color: "#9A6512" } : { background: "rgba(255,255,255,.1)", color: "#fff" }}
    >
      <Icon size={12} strokeWidth={2} />{Math.round(w.tMax)}°{w.rain ? " · rain" : w.hot ? " · hot" : ""}
    </span>
  );
}

function BudgetChip({ premium, level }: { premium: number; level: "budget" | "standard" | "luxury" }) {
  // Flag a day that stacks premium ($$$+) stops — louder on a budget trip.
  const alert = level === "budget" ? premium >= 1 : premium >= 2;
  if (!alert) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      title={`${premium} premium ($$$+) stop${premium !== 1 ? "s" : ""} — ${level === "budget" ? "over your budget level" : "a pricey day"}`}
      style={{ background: "#FCEFD6", color: "#9A6512" }}
    >
      <Wallet size={12} strokeWidth={2} />$$$·{premium}
    </span>
  );
}

function ScheduleView({ saved, itinerary, onRemoveStop, weatherByDay, budgetByDay, budgetLevel }: {
  saved: ReturnType<typeof useTrip>["state"]["destinations"];
  itinerary: ItineraryItem[];
  onRemoveStop: (placeId: string) => void;
  weatherByDay: Map<number, DaySignal>;
  budgetByDay: Map<number, BudgetDaySignal>;
  budgetLevel: "budget" | "standard" | "luxury";
}) {
  if (!itinerary.length) {
    return (
      <div className="mt-6 rounded-[16px] border border-dashed border-white/15 px-4 py-5 text-center text-white">
        <div className="font-display font-bold text-[14.5px]">No day-by-day plan yet</div>
        <p className="text-white/55 text-[12.5px] mt-1 max-w-[420px] mx-auto">Ask the companion to <span className="text-white font-semibold">“plan my days”</span> — then refine it by chat: move stops between days, reorder, make a day less busy, or swap in alternatives.</p>
      </div>
    );
  }

  const struct = dayStructure(saved);
  const firstKey = struct[0] ? struct[0].city.split(",")[0].trim().toLowerCase() : "";
  const cityKey = (n: string) => n.split(",")[0].trim().toLowerCase();

  return (
    <div className="mt-6">
      <div className="font-display font-bold text-[16px] mb-3 flex items-center gap-2 text-white"><Sparkles size={15} style={{ color: "var(--accent)" }} />Your itinerary</div>
      <div className="flex flex-col gap-4">
        {struct.map((ds) => {
          const cityItems = itinerary.filter((it) => (it.destId ? cityKey(it.destId) : firstKey) === cityKey(ds.city));
          return (
            <div key={ds.destId} className="imm-glass rounded-[16px] overflow-hidden text-white">
              <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                <div className="font-display font-bold text-[14.5px]">{ds.city}</div>
                <div className="text-[11.5px] text-white/50">{cityItems.length} stop{cityItems.length !== 1 ? "s" : ""}</div>
              </div>
              <div className="p-3 flex flex-col gap-3">
                {Array.from({ length: ds.nights }).map((_, d) => {
                  const dayItems = cityItems.filter((it) => it.day === d).sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.position - b.position);
                  const globalDay = ds.globalStart + d + 1;
                  const mins = totalMinutes(dayItems);
                  return (
                    <div key={d} className="relative pl-5 vp-fade-fast" style={{ animationDelay: `${d * 0.06}s` }}>
                      {/* living timeline: a glowing star node + spine down the day */}
                      <span className="absolute left-[2px] top-[5px] w-[9px] h-[9px] rounded-full" style={{ background: "var(--accent)", boxShadow: "0 0 8px 1px color-mix(in oklab, var(--accent) 75%, transparent)" }} />
                      <span aria-hidden className="absolute left-[6px] top-[16px] bottom-[-12px] w-px" style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--accent) 45%, transparent), transparent)" }} />
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-display font-bold text-[13.5px]">Day {globalDay}</span>
                        {weatherByDay.get(globalDay) && <WeatherChip w={weatherByDay.get(globalDay) as DaySignal} />}
                        {budgetByDay.get(globalDay) && <BudgetChip premium={(budgetByDay.get(globalDay) as BudgetDaySignal).premium} level={budgetLevel} />}
                        {dayItems.length > 0 && <span className="text-[11px] text-white/50 inline-flex items-center gap-1"><Clock size={11} />{fmtHrs(mins)} planned</span>}
                      </div>
                      {dayItems.length ? (
                        <div className="flex flex-col gap-1.5">
                          {dayItems.map((it) => {
                            const p = it.place;
                            const meta = [
                              p.category && p.category !== "Recommended" ? p.category : "",
                              p.rating != null ? `★ ${p.rating.toFixed(1)}` : "",
                              p.hours ?? "",
                            ].filter(Boolean).join(" · ");
                            return (
                              <div key={p.id} className="group flex items-center gap-2.5 px-2.5 py-2 rounded-[10px]" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[.04em] w-[54px]" style={{ color: "var(--accent)" }}>{SLOT_LABELS[it.slot]}</span>
                                {p.photoUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.photoUrl} alt="" loading="lazy" className="w-9 h-9 rounded-[7px] object-cover shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="text-[13px] font-semibold text-white truncate">{p.name}</div>
                                  {meta && <div className="text-[11px] text-white/50 truncate">{meta}</div>}
                                </div>
                                <span className="shrink-0 text-[11px] text-white/50">{fmtHrs(it.durationMin ?? p.estDurationMin)}</span>
                                <button onClick={() => onRemoveStop(p.id)} title="Remove" className="shrink-0 w-6 h-6 rounded-md border border-white/15 text-white/50 grid place-items-center cursor-pointer hover:text-[#F1A88C] hover:border-[#F1A88C] opacity-0 group-hover:opacity-100 transition"><X size={12} strokeWidth={2} /></button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[11.5px] text-white/50 px-2.5 py-2 rounded-[10px] border border-dashed border-white/15">Free day — ask to add something or keep it open.</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
