"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, Compass, MapPin, Moon, Plus, Send, Sparkles, Wallet, X } from "lucide-react";
import { queryLink } from "@/lib/maps";
import { getRepository } from "@/lib/itinerary/repository";
import { geocodeCity } from "@/lib/geo";
import { SLOT_LABELS, SLOTS, type ExplorePlace, type ItineraryItem } from "@/lib/places";
import { planTrip, type PlaceSuggestion } from "@/lib/ai-client";
import { applyScheduleOps, dayStructure, serializeSchedule } from "@/lib/planner/schedulePlan";
import { lookupPlace } from "@/lib/places/lookup";
import { withSave } from "@/lib/ui/saveStatus";
import { useTrip } from "@/lib/store";
import { useTrips } from "@/lib/trips/store";
import { useTripLoader } from "@/lib/trips/useTripLoader";
import type { ComposedTrip } from "@/lib/ai-client";
import { applyTrip } from "@/lib/trips/applyTrip";
import { loadChat, saveChat, type ChatTurn } from "@/lib/destinations/repository";
import { fmtMonthDay, MODE_TEMPLATES, nightsBetween, recommend } from "@/lib/data";
import { addBreakdowns, computeBudget, EMPTY_BREAKDOWN, formatMoney } from "@/lib/budget/estimate";
import { useCurrency } from "@/lib/budget/useCurrency";
import { summarizePreferences } from "@/lib/trips/preferences";
import { GoogleMap, MapsApiProvider, DestinationMarkers } from "@/components/maps";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import type { LatLng, MapMarker } from "@/lib/maps";
import { CityImage } from "@/components/destinations/CityImage";
import { ExportControl } from "@/components/export/ExportButton";
import { Logo } from "@/components/Logo";

const sigOf = (t: ComposedTrip) =>
  JSON.stringify({ n: t.name, d: t.destinations.map((x) => `${x.city.toLowerCase()}#${x.nights}`), p: t.preferences });

const QUICK = ["Plan my days", "What should we do there?", "Make day 1 less busy", "Add another city"];

/** Stable id for a suggested place, so saving is idempotent and "saved" survives reload. */
const suggestionId = (s: PlaceSuggestion) => `sugg:${s.city.toLowerCase()}:${s.name.toLowerCase()}`.replace(/\s+/g, "-");

export function Workspace() {
  const { state, actions } = useTrip();
  const { activeTrip, actions: tripActions } = useTrips();
  const loadPlan = useTripLoader();
  const currency = useCurrency();

  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const itineraryRef = useRef<ItineraryItem[]>([]);
  itineraryRef.current = itinerary;
  const scrollRef = useRef<HTMLDivElement>(null);

  const saved = useMemo(() => state.destinations.filter((d) => d.saved && d.name.trim()), [state.destinations]);
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
  useEffect(() => {
    greeted.current = false;
    setSavedIds(new Set());
    setItinerary([]);
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
    getRepository().listItinerary(activeTrip.id).then((items) => {
      if (!cancelled) setItinerary(items);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeTrip?.id]);

  // Save a suggested place to this trip (shows on the Saved Places page).
  const saveSuggestion = async (s: PlaceSuggestion) => {
    if (!activeTrip) return;
    const id = suggestionId(s);
    if (savedIds.has(id)) return;
    setSavedIds((prev) => new Set(prev).add(id)); // optimistic
    // Prefer real Google Places data (name/coords/photo/rating/hours/place_id).
    // Fall back to a city-centre geocode so the saved pin never lands at 0,0; the
    // card's Maps deep link still opens by name for exact discovery.
    const hit = await lookupPlace(`${s.name}, ${s.city}`).catch(() => null);
    let place: ExplorePlace;
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
    try {
      await getRepository().setFavorite(activeTrip.id, s.city, place, true);
    } catch {
      setSavedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); // roll back
      actions.flash("Couldn't save that place — try again.");
    }
  };

  // Greet once the trip's cities are loaded (so the greeting is personal).
  useEffect(() => {
    if (greeted.current || !activeTrip || messages.length || !saved.length) return;
    greeted.current = true;
    const cities = saved.map((d) => d.name).join(", ");
    setMessages([{ role: "assistant", content: `Your ${struct.name} is taking shape — ${cities}. Tell me how you'd like to shape it: add a city, change how long you stay, adjust the pace or who's coming, or ask me anything.` }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.length, messages.length, activeTrip?.id]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, sending]);

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
      const res = await planTrip(struct, scheduleText, Object.keys(refMap), history, text);
      if (res) {
        // (1) Structural change → rebuild destinations + rehydrate the store.
        if (res.trip && sigOf(res.trip) !== sigOf(struct)) {
          await applyTrip(activeTrip.id, res.trip, state.destinations, state.budgetLevel);
          if (res.trip.name && res.trip.name !== activeTrip.name) await tripActions.rename(activeTrip.id, res.trip.name);
          await loadPlan(activeTrip.id, res.trip.destinations[0].city);
        }
        // (2) Schedule change → enrich added stops with real Google Places data,
        //     then apply minimal edit ops onto the live stops (preserving the rest) + persist.
        if (res.ops) {
          const ck = (n: string) => n.split(",")[0].trim().toLowerCase();
          const cityCenter = (city: string): LatLng | null => {
            const d = saved.find((x) => ck(x.name) === ck(city));
            return d && typeof d.lat === "number" && typeof d.lng === "number" && !(d.lat === 0 && d.lng === 0) ? { lat: d.lat, lng: d.lng } : null;
          };
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
        const full = [...afterUser, { role: "assistant" as const, content: res.reply, suggestions: res.suggestions?.length ? res.suggestions : undefined }];
        setMessages(full);
        saveChat(activeTrip.id, full);
      } else {
        const full = [...afterUser, { role: "assistant" as const, content: "I couldn't update that just now — mind rephrasing?" }];
        setMessages(full);
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

  return (
    <MapsApiProvider>
    <div className="h-screen w-full flex flex-col lg:flex-row overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* ============ Chat (primary) ============ */}
      <section className="flex flex-col lg:w-[40%] lg:max-w-[520px] h-[52vh] lg:h-full border-b lg:border-b-0 lg:border-r border-line" style={{ background: "color-mix(in oklab, var(--bg) 55%, #fff)" }}>
        <header className="flex items-center gap-2.5 px-4 h-[58px] border-b border-line shrink-0">
          <button onClick={actions.goWelcome} title="New journey" className="flex items-center gap-2 cursor-pointer">
            <Logo size={26} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold text-[15px] leading-tight truncate">{activeTrip?.name || "Your trip"}</div>
            <div className="text-[11.5px] text-muted flex items-center gap-1"><Sparkles size={11} className="text-accent" />AI travel companion</div>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto vp-scroll px-4 py-4 flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[88%] ${m.role === "user" ? "self-end" : "self-start"}`}>
              <div
                className="rounded-[16px] px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap"
                style={m.role === "user"
                  ? { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 4 }
                  : { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderBottomLeftRadius: 4 }}
              >
                {m.content}
              </div>
              {m.role === "assistant" && m.suggestions?.length ? (
                <div className="mt-2 flex flex-col gap-2">
                  {m.suggestions.map((s, si) => {
                    const isSaved = savedIds.has(suggestionId(s));
                    return (
                      <div key={si} className="rounded-[14px] border border-line bg-surface px-3.5 py-2.5 vp-fade-fast">
                        <div className="font-display font-bold text-[13.5px] leading-tight">{s.name}</div>
                        <div className="text-[11px] text-muted">{s.city}</div>
                        {s.why && <div className="text-[12px] text-ink/80 mt-1 leading-snug">{s.why}</div>}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => saveSuggestion(s)}
                            disabled={isSaved}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition cursor-pointer disabled:cursor-default"
                            style={isSaved
                              ? { background: "var(--tint)", color: "var(--accent)" }
                              : { background: "var(--accent)", color: "#fff" }}
                          >
                            {isSaved ? <><Check size={12} />Saved</> : <><Plus size={12} />Save</>}
                          </button>
                          <a
                            href={queryLink(`${s.name}, ${s.city}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-line text-[11.5px] font-semibold text-muted cursor-pointer hover:text-accent hover:border-accent transition"
                          >
                            <MapPin size={12} />Map
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
          {sending && (
            <div className="self-start rounded-[16px] px-3.5 py-3 bg-surface border border-line" style={{ borderBottomLeftRadius: 4 }}>
              <span className="inline-flex gap-1">
                {[0, 1, 2].map((d) => <span key={d} className="w-1.5 h-1.5 rounded-full bg-accent" style={{ animation: `vpw_pulse 1s ease-in-out ${d * 0.18}s infinite` }} />)}
              </span>
            </div>
          )}
        </div>

        <div className="shrink-0 px-3 pb-3 pt-1">
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK.map((q) => (
                <button key={q} onClick={() => send(q)} disabled={sending} className="px-2.5 py-1.5 rounded-full border border-line bg-surface text-[12px] font-semibold text-muted cursor-pointer hover:text-accent hover:border-accent disabled:opacity-50">{q}</button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-[16px] border border-line bg-surface p-2" style={{ boxShadow: "0 8px 24px -16px rgba(0,0,0,.4)" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder="Tell me how to shape this trip…"
              className="flex-1 resize-none bg-transparent outline-none border-none px-2 py-1.5 text-[14px] leading-relaxed text-ink placeholder:text-muted max-h-[120px]"
            />
            <button onClick={() => send()} disabled={sending || !input.trim()} className="shrink-0 w-9 h-9 rounded-[12px] grid place-items-center cursor-pointer disabled:opacity-40" style={{ background: "var(--accent)", color: "#fff" }}>
              <Send size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </section>

      {/* ============ Live journey ============ */}
      <section className="flex-1 overflow-y-auto vp-scroll">
        <JourneyPanel saved={saved} travelers={travelers} currency={currency} budgetLevel={state.budgetLevel} preferences={summarizePreferences(state.preferences, state.budgetLevel)} actions={actions} itinerary={itinerary} onRemoveStop={removeStop} />
      </section>

      <style dangerouslySetInnerHTML={{ __html: `@keyframes vpw_pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.3)}}` }} />
    </div>
    </MapsApiProvider>
  );
}

function JourneyPanel({ saved, travelers, currency, budgetLevel, preferences, actions, itinerary, onRemoveStop }: {
  saved: ReturnType<typeof useTrip>["state"]["destinations"];
  travelers: number; currency: ReturnType<typeof useCurrency>; budgetLevel: "budget" | "standard" | "luxury"; preferences: string;
  actions: ReturnType<typeof useTrip>["actions"];
  itinerary: ItineraryItem[];
  onRemoveStop: (placeId: string) => void;
}) {
  const markers: MapMarker[] = saved
    .filter((d) => typeof d.lat === "number" && typeof d.lng === "number" && !(d.lat === 0 && d.lng === 0))
    .map((d, i) => ({ id: String(d.id), name: d.name, kind: "destination", position: { lat: d.lat as number, lng: d.lng as number }, subtitle: `Stop ${i + 1}`, category: d.country }));
  const center: LatLng = markers[0]?.position ?? { lat: 41.39, lng: 2.16 };
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
      <div className="h-full grid place-items-center p-8 text-center">
        <div>
          <Compass size={40} strokeWidth={1.5} className="text-accent mx-auto" />
          <div className="font-display font-bold text-[18px] mt-3">Your journey will appear here</div>
          <p className="text-muted text-[13.5px] mt-1 max-w-[320px]">Tell the companion where you'd like to go and watch the trip build itself.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[760px] mx-auto px-[clamp(16px,3vw,28px)] py-6">
      {/* map */}
      <div className="relative rounded-[18px] overflow-hidden border border-line h-[260px]">
        <ErrorBoundary fallback={() => <div className="absolute inset-0 grid place-items-center bg-[#eef3ec] text-muted text-[13px]">Map unavailable</div>}>
          <GoogleMap center={center} zoom={5} className="absolute inset-0 h-full w-full" fallback={<div className="absolute inset-0 grid place-items-center bg-[#eef3ec] text-muted text-[13px]">Map preview</div>}>
            <DestinationMarkers markers={markers} />
          </GoogleMap>
        </ErrorBoundary>
      </div>

      {/* summary strip */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-accent" />{saved.length} {saved.length === 1 ? "city" : "cities"}</span>
        <span className="inline-flex items-center gap-1.5"><Moon size={14} className="text-accent" />{totalNights} night{totalNights !== 1 ? "s" : ""}</span>
        <span className="inline-flex items-center gap-1.5 text-muted">{span}</span>
        <span className="inline-flex items-center gap-1.5 ml-auto font-bold"><Wallet size={14} className="text-accent" />{formatMoney(budgetTotal, currency)}</span>
      </div>
      {preferences && <div className="mt-2 text-[12px] text-muted">{preferences}</div>}

      {/* the journey */}
      <div className="mt-5 flex flex-col">
        {saved.map((d, i) => {
          const next = saved[i + 1];
          const n = nightsBetween(d.arrive, d.depart);
          return (
            <div key={d.id}>
              <div className="flex gap-3.5 rounded-[18px] border border-line bg-surface overflow-hidden vp-fade-fast">
                <div className="w-[112px] shrink-0 relative bg-tint">
                  <CityImage name={d.name} country={d.country} className="absolute inset-0 w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold text-white" style={{ background: "var(--accent)" }}>{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0 py-3 pr-3">
                  <div className="font-display font-bold text-[16px] truncate">{d.name}</div>
                  <div className="text-[12px] text-muted truncate">{d.country}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11.5px]">
                    {d.arrive && <span className="px-2 py-0.5 rounded-md bg-tint text-ink">{fmtMonthDay(d.arrive)} – {fmtMonthDay(d.depart)}</span>}
                    <span className="px-2 py-0.5 rounded-md bg-tint text-ink">{n ?? "—"} night{n !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>
              {next && (() => {
                const rec = recommend(d, next);
                const tpl = MODE_TEMPLATES[rec.recMode];
                return (
                  <div className="flex items-center gap-2 py-2 pl-[52px] text-[11.5px] text-muted">
                    <span className="w-px h-4" style={{ background: "var(--line)" }} />
                    <span className="capitalize font-semibold text-ink">{rec.recMode}</span>
                    <span>· {tpl.duration} → {next.name}</span>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* living itinerary */}
      <ScheduleView saved={saved} itinerary={itinerary} onRemoveStop={onRemoveStop} />

      {/* actions */}
      <div className="mt-6 flex flex-wrap gap-2.5">
        <ExportControl
          itinerary={itinerary}
          destination={saved[0]?.name ?? ""}
          center={center}
          transportMode="walk"
          units="km"
          label="Export"
          disabled={!itinerary.length}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[12px] border border-line bg-surface text-ink text-[13.5px] font-bold cursor-pointer hover:border-accent disabled:opacity-50"
        />
      </div>
    </div>
  );
}

/* ---------------- the living day-by-day schedule ---------------- */
const totalMinutes = (items: ItineraryItem[]) => items.reduce((s, it) => s + (it.durationMin ?? it.place.estDurationMin), 0);
const fmtHrs = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`; };

function ScheduleView({ saved, itinerary, onRemoveStop }: {
  saved: ReturnType<typeof useTrip>["state"]["destinations"];
  itinerary: ItineraryItem[];
  onRemoveStop: (placeId: string) => void;
}) {
  if (!itinerary.length) {
    return (
      <div className="mt-6 rounded-[16px] border border-dashed border-line px-4 py-5 text-center">
        <div className="font-display font-bold text-[14.5px]">No day-by-day plan yet</div>
        <p className="text-muted text-[12.5px] mt-1 max-w-[420px] mx-auto">Ask the companion to <span className="text-ink font-semibold">“plan my days”</span> — then refine it by chat: move stops between days, reorder, make a day less busy, or swap in alternatives.</p>
      </div>
    );
  }

  const struct = dayStructure(saved);
  const firstKey = struct[0] ? struct[0].city.split(",")[0].trim().toLowerCase() : "";
  const cityKey = (n: string) => n.split(",")[0].trim().toLowerCase();

  return (
    <div className="mt-6">
      <div className="font-display font-bold text-[16px] mb-3 flex items-center gap-2"><Sparkles size={15} className="text-accent" />Your itinerary</div>
      <div className="flex flex-col gap-4">
        {struct.map((ds) => {
          const cityItems = itinerary.filter((it) => (it.destId ? cityKey(it.destId) : firstKey) === cityKey(ds.city));
          return (
            <div key={ds.destId} className="rounded-[16px] border border-line bg-surface overflow-hidden">
              <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
                <div className="font-display font-bold text-[14.5px]">{ds.city}</div>
                <div className="text-[11.5px] text-muted">{cityItems.length} stop{cityItems.length !== 1 ? "s" : ""}</div>
              </div>
              <div className="p-3 flex flex-col gap-3">
                {Array.from({ length: ds.nights }).map((_, d) => {
                  const dayItems = cityItems.filter((it) => it.day === d).sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.position - b.position);
                  const globalDay = ds.globalStart + d + 1;
                  const mins = totalMinutes(dayItems);
                  return (
                    <div key={d}>
                      <div className="flex items-baseline gap-2 mb-1.5">
                        <span className="font-display font-bold text-[13.5px]">Day {globalDay}</span>
                        {dayItems.length > 0 && <span className="text-[11px] text-muted inline-flex items-center gap-1"><Clock size={11} />{fmtHrs(mins)} planned</span>}
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
                              <div key={p.id} className="group flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] border border-line bg-bg">
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[.04em] text-accent w-[54px]">{SLOT_LABELS[it.slot]}</span>
                                {p.photoUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.photoUrl} alt="" loading="lazy" className="w-9 h-9 rounded-[7px] object-cover shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="text-[13px] font-semibold text-ink truncate">{p.name}</div>
                                  {meta && <div className="text-[11px] text-muted truncate">{meta}</div>}
                                </div>
                                <span className="shrink-0 text-[11px] text-muted">{fmtHrs(it.durationMin ?? p.estDurationMin)}</span>
                                <button onClick={() => onRemoveStop(p.id)} title="Remove" className="shrink-0 w-6 h-6 rounded-md border border-line text-muted grid place-items-center cursor-pointer hover:text-[#b3402f] hover:border-[#b3402f] opacity-0 group-hover:opacity-100 transition"><X size={12} strokeWidth={2} /></button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[11.5px] text-muted px-2.5 py-2 rounded-[10px] border border-dashed border-line">Free day — ask to add something or keep it open.</div>
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
