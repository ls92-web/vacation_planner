"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Heart, ListChecks, MapPin, Search, Sparkles, Trash2 } from "lucide-react";
import { useTrip } from "@/lib/store";
import { useTrips } from "@/lib/trips/store";
import { PlannerProvider, usePlanner } from "@/lib/planner/store";
import { formatDurationMin, haversineKm, SLOT_LABELS, usePlaces, type ExploreFilters, type ExplorePlace, type ItineraryItem } from "@/lib/places";
import { scorePlace } from "@/lib/places/personalize";
import { hasPreferences } from "@/lib/trips/preferences";
import { MapsApiProvider } from "@/components/maps";
import { destinationCoords, useGeocode } from "@/lib/maps";
import { nightsBetween } from "@/lib/data";
import { Brand } from "@/components/AppNav";
import { CategoryRail } from "./CategoryRail";
import { FilterBar } from "./FilterBar";
import { PlaceCard } from "./PlaceCard";
import { ExploreMap } from "./ExploreMap";
import { DestinationItinerary } from "./DestinationItinerary";
import { CompareTray } from "./CompareTray";
import { useDebounced } from "./useDebounced";
import type { Destination } from "@/lib/types";
import { ExportButton } from "@/components/export/ExportButton";

const cityKey = (name: string) => name.split(",")[0].trim().toLowerCase();

function applyFilters(places: ExplorePlace[], f: ExploreFilters, center: { lat: number; lng: number }): ExplorePlace[] {
  return places.filter((p) => {
    if (f.minRating > 0 && (p.rating ?? 0) < f.minRating) return false;
    if (f.maxPrice < 4 && p.priceLevel != null && p.priceLevel > f.maxPrice) return false;
    if (f.openNow && p.openNow !== true) return false;
    if (f.family && !p.tags.includes("Family Friendly")) return false;
    if (f.wheelchair && p.wheelchair !== true) return false;
    if (f.free === "free" && !(p.free === true || p.priceLevel === 0)) return false;
    if (f.free === "paid" && !((p.priceLevel ?? 0) > 0)) return false;
    if (f.env === "indoor" && p.indoor !== true) return false;
    if (f.env === "outdoor" && p.indoor === true) return false;
    if (f.duration !== "any") {
      const m = p.estDurationMin;
      if (f.duration === "short" && m > 60) return false;
      if (f.duration === "half" && m > 180) return false;
      if (f.duration === "full" && m <= 180) return false;
    }
    if (f.maxDistanceKm > 0 && haversineKm(center, p.position) > f.maxDistanceKm) return false;
    return true;
  });
}

function CardGridSkeleton() {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-surface border border-line rounded-[18px] overflow-hidden">
          <div className="h-[170px] vp-shimmer" />
          <div className="p-4 flex flex-col gap-2">
            <div className="h-4 w-2/3 rounded vp-shimmer" />
            <div className="h-3 w-1/2 rounded vp-shimmer" />
            <div className="h-3 w-full rounded vp-shimmer" />
            <div className="h-8 w-full rounded-lg vp-shimmer mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ExploreInner() {
  const { state, actions } = usePlanner();
  const trip = useTrip();
  const [view, setView] = useState<"explore" | "plan">("explore");
  const debouncedSearch = useDebounced(state.search, 350);
  const geocode = useGeocode();

  // The destinations the user chose for this trip (in travel order).
  const savedDests = useMemo(() => trip.state.destinations.filter((d) => d.saved && d.name.trim()), [trip.state.destinations]);
  const multi = savedDests.length > 1;
  const [destIdx, setDestIdx] = useState(0);
  const activeDest = savedDests[Math.min(destIdx, Math.max(0, savedDests.length - 1))];

  // Focus exploration on the active destination so attractions are scoped to it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (activeDest) {
        const hasCoords = typeof activeDest.lat === "number" && typeof activeDest.lng === "number" && !(activeDest.lat === 0 && activeDest.lng === 0);
        const center = hasCoords
          ? { lat: activeDest.lat as number, lng: activeDest.lng as number }
          : destinationCoords(activeDest.name.split(",")[0]) ?? (await geocode(`${activeDest.name}${activeDest.country ? `, ${activeDest.country}` : ""}`));
        const days = Math.max(1, nightsBetween(activeDest.arrive, activeDest.depart) || 1);
        if (!cancelled && center) actions.focusDestination(activeDest.name, center, days);
      } else {
        if (destinationCoords(state.destination.split(",")[0])) return;
        const loc = await geocode(state.destination);
        if (!cancelled && loc) actions.setCenter(loc);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destIdx, savedDests.length, activeDest?.name]);

  const { places, loading, source } = usePlaces({ center: state.center, categoryKey: state.categoryKey, search: debouncedSearch });
  const filtered = useMemo(() => applyFilters(places, state.filters, state.center), [places, state.filters, state.center]);
  const pool = useMemo(() => [...places, ...state.favorites, ...state.itinerary.map((i) => i.place)], [places, state.favorites, state.itinerary]);

  // Places shown on the map: the visible results plus any already-chosen places for
  // this destination (so chosen stops always have a marker, even if filtered out).
  const dk = cityKey(activeDest?.name ?? state.destination);
  const chosenPlaces = useMemo(() => state.itinerary.filter((it) => cityKey(it.destId) === dk).map((it) => it.place), [state.itinerary, dk]);
  const mapPlaces = useMemo(() => {
    const seen = new Set(filtered.map((p) => p.id));
    return [...filtered, ...chosenPlaces.filter((p) => !seen.has(p.id))];
  }, [filtered, chosenPlaces]);

  // Personalize results when this trip has preferences set.
  const prefs = trip.state.preferences;
  const personalize = hasPreferences(prefs);

  return (
    <div className="vp-scroll min-h-screen" style={{ background: "var(--bg)" }}>
      {/* header */}
      <Header view={view} setView={setView} />

      {multi && view === "explore" && (
        <DestinationSwitcher
          dests={savedDests}
          index={destIdx}
          onPick={setDestIdx}
          onContinue={() => {
            if (destIdx < savedDests.length - 1) {
              const next = savedDests[destIdx + 1];
              setDestIdx(destIdx + 1);
              actions.flash(`Now exploring attractions in ${next.name.split(",")[0]}.`);
            } else {
              setView("plan");
            }
          }}
        />
      )}

      {view === "explore" ? (
        <div className="max-w-[1320px] mx-auto px-[clamp(16px,3vw,28px)] pb-24">
          {/* search + categories */}
          <div className="sticky top-[60px] z-30 -mx-[clamp(16px,3vw,28px)] px-[clamp(16px,3vw,28px)] py-3" style={{ background: "color-mix(in oklab, var(--bg) 88%, #fff)", backdropFilter: "blur(10px)" }}>
            <SearchBox />
            <div className="mt-3"><CategoryRail /></div>
            <div className="mt-3"><FilterBar /></div>
          </div>

          <div className="flex flex-col lg:flex-row gap-5 mt-4 items-start">
            {/* grid */}
            <div className="flex-1 min-w-0 w-full">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[13px] text-muted">
                  {loading ? "Finding places…" : `${filtered.length} place${filtered.length !== 1 ? "s" : ""}`}
                  {source === "curated" && !loading && <span className="ml-2 text-[11.5px]">· curated fallback</span>}
                </div>
              </div>
              {loading ? (
                <CardGridSkeleton />
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-muted">
                  <div className="font-bold text-ink">No places match those filters</div>
                  <div className="text-[13px] mt-1">Try a different category or relax a filter.</div>
                </div>
              ) : !personalize ? (
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(258px,1fr))" }}>
                  {filtered.map((p, i) => (
                    <PlaceCard key={p.id} place={p} index={i} distanceKm={haversineKm(state.center, p.position)} />
                  ))}
                </div>
              ) : (
                (() => {
                  const scored = filtered.map((p) => ({ p, m: scorePlace(p, prefs, trip.state.budgetLevel) }));
                  const rec = scored.filter((x) => x.m.recommended).sort((a, b) => b.m.score - a.m.score);
                  const others = scored.filter((x) => !x.m.recommended);
                  const card = (x: (typeof scored)[number], i: number) => (
                    <PlaceCard key={x.p.id} place={x.p} index={i} distanceKm={haversineKm(state.center, x.p.position)} match={x.m} />
                  );
                  return (
                    <div className="flex flex-col gap-6">
                      {rec.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink mb-3">
                            <Sparkles size={15} strokeWidth={2} className="text-accent" />Recommended for this trip
                            <span className="text-muted font-semibold ml-1">· {rec.length}</span>
                          </div>
                          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(258px,1fr))" }}>
                            {rec.map((x, i) => card(x, i))}
                          </div>
                        </div>
                      )}
                      {others.length > 0 && (
                        <div>
                          <div className="text-[13.5px] font-bold text-muted mb-3">{rec.length ? "Other options" : "All places"}</div>
                          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(258px,1fr))" }}>
                            {others.map((x, i) => card(x, rec.length + i))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>

            {/* right: your plan summary (sticky on desktop; above the map on mobile) */}
            <aside className="w-full lg:w-[340px] shrink-0 lg:sticky lg:top-[228px] self-start">
              <PlanSummaryPanel activeDest={activeDest} onContinue={() => setView("plan")} />
            </aside>
          </div>

          {/* map — below the main explore section so it no longer dominates the side */}
          <div className="mt-5">
            <div className="text-[12px] font-bold uppercase tracking-[.04em] text-muted mb-2 flex items-center gap-1.5"><MapPin size={13} strokeWidth={2} className="text-accent" />Map · results &amp; your chosen places</div>
            <div className="relative rounded-[18px] overflow-hidden border border-line h-[380px]">
              <ExploreMap places={mapPlaces} />
            </div>
          </div>
        </div>
      ) : (
        <PlanView />
      )}

      <CompareTray pool={pool} />
      <Toast />
    </div>
  );
}

function PlanView() {
  const { state } = usePlanner();
  return (
    <div className="max-w-[1100px] mx-auto px-[clamp(16px,3vw,28px)] py-5 pb-24">
      <div className="font-display font-bold text-[24px] tracking-[-.02em] mb-1">Your itinerary</div>
      <p className="text-muted text-[13.5px] mb-4">Grouped by destination in your travel order. Open each city in Explore to fill its days — stops stay with the city you added them in.</p>
      <DestinationItinerary />

      {/* Export lives here, at the end of the finalized plan. */}
      <div className="mt-10 rounded-[18px] border border-line bg-surface p-6 text-center">
        <div className="font-display font-bold text-[18px]">Happy with your plan?</div>
        <p className="text-muted text-[13.5px] mt-1 max-w-[460px] mx-auto">Export it as a luxury PDF guide with your places, timings, hotels and budget.</p>
        <div className="mt-4 flex justify-center">
          <ExportButton
            label="Export itinerary"
            disabled={state.itinerary.length === 0}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[12px] bg-accent text-white text-[14px] font-bold cursor-pointer hover:brightness-[1.06] transition"
          />
        </div>
        {state.itinerary.length === 0 && <p className="text-[12px] text-muted mt-2">Add places in Explore first.</p>}
      </div>
    </div>
  );
}

const SLOT_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 };

/** Sticky right-side summary of the places chosen for the active destination, grouped by day. */
function PlanSummaryPanel({ activeDest, onContinue }: { activeDest?: Destination; onContinue: () => void }) {
  const { state } = usePlanner();
  const cityName = (activeDest?.name ?? state.destination).split(",")[0];
  const dk = cityKey(activeDest?.name ?? state.destination);
  const items = state.itinerary.filter((it) => cityKey(it.destId) === dk);
  const days = Math.max(1, state.focusDays);
  const totalAll = state.itinerary.length;

  return (
    <div className="rounded-[18px] border border-line bg-surface overflow-hidden flex flex-col lg:max-h-[calc(100vh-320px)]">
      <div className="px-4 py-3.5 border-b border-line flex items-center gap-2" style={{ background: "var(--tint)" }}>
        <ListChecks size={16} strokeWidth={2} className="text-accent shrink-0" />
        <div className="min-w-0">
          <div className="font-display font-bold text-[15px] leading-tight truncate">Your plan · {cityName}</div>
          <div className="text-[11.5px] text-muted">{items.length} place{items.length !== 1 ? "s" : ""} here · {totalAll} in trip</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto vp-scroll p-3 flex flex-col gap-3">
        {Array.from({ length: days }).map((_, d) => {
          const dayItems = items
            .filter((it) => it.day === d)
            .sort((a, b) => (SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]) || (a.position - b.position));
          return (
            <div key={d}>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <div className="text-[12px] font-bold text-ink">Day {d + 1}</div>
                {dayItems.length > 0 && <div className="text-[11px] text-muted">{dayItems.length} stop{dayItems.length !== 1 ? "s" : ""}</div>}
              </div>
              {dayItems.length === 0 ? (
                <div className="rounded-[12px] border border-dashed border-line px-3 py-3 text-[12px] text-muted">No places added yet</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {dayItems.map((it) => <PlanRow key={it.place.id} it={it} days={days} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-line">
        <button
          onClick={onContinue}
          disabled={totalAll === 0}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-[12px] bg-accent text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue <ArrowRight size={15} strokeWidth={2} />
        </button>
        {totalAll === 0 && <p className="text-[11px] text-muted text-center mt-1.5">Add at least one place to continue.</p>}
      </div>
    </div>
  );
}

function PlanRow({ it, days }: { it: ItineraryItem; days: number }) {
  const { actions } = usePlanner();
  const p = it.place;
  return (
    <div className="rounded-[12px] border border-line px-2.5 py-2 flex items-center gap-2" style={{ background: "color-mix(in oklab, var(--surface) 94%, var(--bg))" }}>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-ink truncate">{p.name}</div>
        <div className="text-[11px] text-muted truncate capitalize">{p.category} · {SLOT_LABELS[it.slot]} · {formatDurationMin(it.durationMin ?? p.estDurationMin)}</div>
      </div>
      {days > 1 && (
        <select
          value={it.day}
          onChange={(e) => actions.moveItemToDay(p.id, Number(e.target.value))}
          title="Move to another day"
          className="shrink-0 text-[11px] font-semibold text-muted bg-surface border border-line rounded-lg px-1.5 py-1 cursor-pointer outline-none"
        >
          {Array.from({ length: days }).map((_, d) => <option key={d} value={d}>Day {d + 1}</option>)}
        </select>
      )}
      <button
        onClick={() => actions.removeFromItinerary(p.id)}
        title="Remove from plan"
        className="shrink-0 w-7 h-7 rounded-lg border border-line bg-surface grid place-items-center text-muted cursor-pointer hover:text-[#b3492f] hover:border-[#b3492f]"
      >
        <Trash2 size={13} strokeWidth={2} />
      </button>
    </div>
  );
}

function DestinationSwitcher({ dests, index, onPick, onContinue }: { dests: Destination[]; index: number; onPick: (i: number) => void; onContinue: () => void }) {
  const last = index >= dests.length - 1;
  const nextCity = !last ? dests[index + 1].name.split(",")[0] : null;
  return (
    <div className="border-b border-line" style={{ background: "color-mix(in oklab, var(--bg) 70%, #fff)" }}>
      <div className="max-w-[1320px] mx-auto px-[clamp(16px,3vw,28px)] py-2.5 flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted shrink-0"><MapPin size={14} strokeWidth={2} className="text-accent" />Attractions in</span>
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {dests.map((d, i) => {
            const on = i === index;
            const done = i < index;
            return (
              <button
                key={d.id}
                onClick={() => onPick(i)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold cursor-pointer transition border"
                style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent)" : "var(--surface)", color: on ? "#fff" : "var(--muted)" }}
              >
                <span className="grid place-items-center w-4 h-4 rounded-full text-[10px] font-bold" style={{ background: on ? "rgba(255,255,255,.25)" : done ? "var(--accent)" : "var(--tint)", color: on ? "#fff" : done ? "#fff" : "var(--accent)" }}>
                  {done ? <Check size={10} strokeWidth={3} /> : i + 1}
                </span>
                {d.name.split(",")[0]}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <span className="text-[12px] text-muted hidden sm:inline">{index + 1} of {dests.length}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onPick(Math.max(0, index - 1))} disabled={index === 0} title="Previous destination" className="w-8 h-8 rounded-[9px] border border-line bg-surface grid place-items-center text-muted cursor-pointer hover:text-ink disabled:opacity-40 disabled:cursor-default"><ChevronLeft size={16} strokeWidth={2} /></button>
          <button onClick={onContinue} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-accent text-white text-[12.5px] font-bold cursor-pointer hover:brightness-[1.06]">
            {last ? "Review plan" : `Next: ${nextCity}`}{last ? <ArrowRight size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchBox() {
  const { state, actions } = usePlanner();
  return (
    <div className="flex items-center gap-2 bg-surface border border-line rounded-[13px] px-3.5 max-w-[600px]">
      <span className="text-muted flex"><Search size={18} strokeWidth={2} /></span>
      <input
        value={state.search}
        onChange={(e) => actions.setSearch(e.target.value)}
        placeholder={`Search places in ${state.destination.split(",")[0]}…`}
        className="flex-1 min-w-0 border-none outline-none py-3 text-[14.5px] bg-transparent text-ink"
      />
    </div>
  );
}

function Header({ view, setView }: { view: "explore" | "plan"; setView: (v: "explore" | "plan") => void }) {
  const { state, actions } = usePlanner();
  return (
    <div className="sticky top-0 z-40 border-b border-line" style={{ background: "color-mix(in oklab, var(--bg) 85%, #fff)", backdropFilter: "blur(12px)" }}>
      <div className="max-w-[1320px] mx-auto px-[clamp(16px,3vw,28px)] py-2.5 flex items-center gap-4">
        <Brand label={state.destination.split(",")[0]} />
        <div className="flex-1" />
        <div className="flex bg-[#f0ebe3] border border-line rounded-[13px] p-1 gap-0.5">
          {(["explore", "plan"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-4 py-2 rounded-[10px] text-[13.5px] font-bold cursor-pointer transition-all capitalize"
              style={{ background: view === v ? "#fff" : "transparent", color: view === v ? "var(--ink)" : "var(--muted)", boxShadow: view === v ? "0 1px 4px rgba(0,0,0,.1)" : "none" }}
            >
              {v === "plan" ? `Plan${state.itinerary.length ? ` · ${state.itinerary.length}` : ""}` : "Explore"}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
            <Heart size={16} strokeWidth={2} style={{ color: "var(--accent2)" }} fill="var(--accent2)" />
            {state.favorites.length}
          </div>
          <div className="flex bg-surface border border-line rounded-[10px] p-0.5">
            {(["km", "mi"] as const).map((u) => (
              <button
                key={u}
                onClick={() => actions.setUnits(u)}
                className="px-2.5 py-1 rounded-md text-[12px] font-bold cursor-pointer"
                style={{ background: state.units === u ? "var(--accent)" : "transparent", color: state.units === u ? "#fff" : "var(--muted)" }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toast() {
  const { state } = usePlanner();
  if (!state.toast) return null;
  return (
    <div className="fixed bottom-[26px] left-1/2 -translate-x-1/2 z-[80] bg-ink text-white px-5 py-3 rounded-[14px] flex items-center gap-2 text-[14px] font-medium vp-pop" style={{ boxShadow: "0 16px 40px -10px rgba(0,0,0,.5)" }}>
      <span className="w-2 h-2 rounded-full bg-accent" />
      {state.toast}
    </div>
  );
}

export function ExploreExperience() {
  const { activeTrip } = useTrips();
  const { actions } = useTrip();
  if (!activeTrip) {
    return (
      <div className="min-h-screen grid place-items-center px-4 text-center">
        <div>
          <div className="font-display font-bold text-[20px]">No trip selected</div>
          <button onClick={actions.goTrips} className="mt-3 px-4 py-2.5 rounded-xl bg-accent text-white text-[14px] font-bold cursor-pointer">Choose a trip</button>
        </div>
      </div>
    );
  }
  return (
    <PlannerProvider key={activeTrip.id} trip={{ id: activeTrip.id, destination: activeTrip.destination }}>
      <MapsApiProvider>
        <ExploreInner />
      </MapsApiProvider>
    </PlannerProvider>
  );
}
