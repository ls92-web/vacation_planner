"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Compass, Download, MapPin, Moon, Send, Sparkles, Wallet } from "lucide-react";
import { queryLink } from "@/lib/maps";
import { useTrip } from "@/lib/store";
import { useTrips } from "@/lib/trips/store";
import { useTripLoader } from "@/lib/trips/useTripLoader";
import { refineTrip, type ComposedTrip } from "@/lib/ai-client";
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
import { Logo } from "@/components/Logo";

const sigOf = (t: ComposedTrip) =>
  JSON.stringify({ n: t.name, d: t.destinations.map((x) => `${x.city.toLowerCase()}#${x.nights}`), p: t.preferences });

const QUICK = ["What should we do there?", "Add another city", "Make it more relaxed", "We're travelling with kids"];

export function Workspace() {
  const { state, actions } = useTrip();
  const { activeTrip, actions: tripActions } = useTrips();
  const loadPlan = useTripLoader();
  const currency = useCurrency();

  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
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

  // Load this trip's conversation memory (per-trip).
  const greeted = useRef(false);
  useEffect(() => {
    greeted.current = false;
    if (!activeTrip) return;
    let cancelled = false;
    loadChat(activeTrip.id).then((chat) => {
      if (cancelled) return;
      if (chat.length) { greeted.current = true; setMessages(chat); }
      else setMessages([]);
    });
    return () => { cancelled = true; };
  }, [activeTrip?.id]);

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
      const res = await refineTrip(struct, history, text);
      if (res) {
        if (sigOf(res.trip) !== sigOf(struct)) {
          await applyTrip(activeTrip.id, res.trip, state.destinations, state.budgetLevel);
          if (res.trip.name && res.trip.name !== activeTrip.name) await tripActions.rename(activeTrip.id, res.trip.name);
          await loadPlan(activeTrip.id, res.trip.destinations[0].city);
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

  return (
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
                  {m.suggestions.map((s, si) => (
                    <a
                      key={si}
                      href={queryLink(`${s.name}, ${s.city}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-[14px] border border-line bg-surface px-3.5 py-2.5 transition hover:border-accent vp-fade-fast"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-display font-bold text-[13.5px] leading-tight truncate">{s.name}</div>
                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-accent opacity-0 group-hover:opacity-100 transition"><MapPin size={11} />Map</span>
                      </div>
                      <div className="text-[11px] text-muted">{s.city}</div>
                      {s.why && <div className="text-[12px] text-ink/80 mt-1 leading-snug">{s.why}</div>}
                    </a>
                  ))}
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
        <JourneyPanel saved={saved} travelers={travelers} currency={currency} budgetLevel={state.budgetLevel} preferences={summarizePreferences(state.preferences, state.budgetLevel)} actions={actions} />
      </section>

      <style dangerouslySetInnerHTML={{ __html: `@keyframes vpw_pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.3)}}` }} />
    </div>
  );
}

function JourneyPanel({ saved, travelers, currency, budgetLevel, preferences, actions }: {
  saved: ReturnType<typeof useTrip>["state"]["destinations"];
  travelers: number; currency: ReturnType<typeof useCurrency>; budgetLevel: "budget" | "standard" | "luxury"; preferences: string;
  actions: ReturnType<typeof useTrip>["actions"];
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
          <MapsApiProvider>
            <GoogleMap center={center} zoom={5} className="absolute inset-0 h-full w-full" fallback={<div className="absolute inset-0 grid place-items-center bg-[#eef3ec] text-muted text-[13px]">Map preview</div>}>
              <DestinationMarkers markers={markers} />
            </GoogleMap>
          </MapsApiProvider>
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

      {/* actions */}
      <div className="mt-6 flex flex-wrap gap-2.5">
        <button onClick={actions.goExplore} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[12px] bg-accent text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06]"><Compass size={15} />Browse places to add</button>
        <button onClick={actions.goForm} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[12px] border border-line bg-surface text-ink text-[13.5px] font-bold cursor-pointer hover:border-accent"><MapPin size={15} />Detailed planner</button>
        <button onClick={actions.goExplore} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[12px] border border-line bg-surface text-ink text-[13.5px] font-bold cursor-pointer hover:border-accent"><Download size={15} />Export<ArrowRight size={14} /></button>
      </div>
    </div>
  );
}
