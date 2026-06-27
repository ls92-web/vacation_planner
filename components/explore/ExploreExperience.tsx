"use client";

import { useMemo, useState } from "react";
import { Heart, Search } from "lucide-react";
import { useTrip } from "@/lib/store";
import { PlannerProvider, usePlanner } from "@/lib/planner/store";
import { haversineKm, usePlaces, type ExploreFilters, type ExplorePlace } from "@/lib/places";
import { GoogleMap, MapsApiProvider, PlaceMarkers } from "@/components/maps";
import type { MapMarker } from "@/lib/maps";
import { Brand } from "@/components/AppNav";
import { CategoryRail } from "./CategoryRail";
import { FilterBar } from "./FilterBar";
import { PlaceCard } from "./PlaceCard";
import { ExploreMap } from "./ExploreMap";
import { ScheduleBuilder } from "./ScheduleBuilder";
import { AssistantInsights } from "./AssistantInsights";
import { CompareTray } from "./CompareTray";
import { useDebounced } from "./useDebounced";

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

function PlanDayMap() {
  const { state } = usePlanner();
  const items = state.itinerary
    .filter((it) => it.day === state.day)
    .sort((a, b) => a.position - b.position);
  const markers: MapMarker[] = items.map((it) => ({
    id: it.place.id,
    name: it.place.name,
    kind: ["restaurants", "cafes", "breakfast"].includes(it.place.category) ? "restaurant" : "attraction",
    position: it.place.position,
    category: it.place.category,
  }));
  const center = items[0]?.place.position ?? state.center;
  return (
    <GoogleMap center={center} zoom={13} className="absolute inset-0 h-full w-full" fallback={<div className="absolute inset-0 grid place-items-center bg-[#eef3ec] text-muted text-[13px]">Map unavailable</div>}>
      <PlaceMarkers markers={markers} selectedId={null} onSelect={() => {}} />
    </GoogleMap>
  );
}

function ExploreInner() {
  const { state } = usePlanner();
  const [view, setView] = useState<"explore" | "plan">("explore");
  const debouncedSearch = useDebounced(state.search, 350);
  const { places, loading, source } = usePlaces({ center: state.center, categoryKey: state.categoryKey, search: debouncedSearch });
  const filtered = useMemo(() => applyFilters(places, state.filters, state.center), [places, state.filters, state.center]);
  const pool = useMemo(() => [...places, ...state.favorites, ...state.itinerary.map((i) => i.place)], [places, state.favorites, state.itinerary]);

  return (
    <div className="vp-scroll min-h-screen" style={{ background: "var(--bg)" }}>
      {/* header */}
      <Header view={view} setView={setView} />

      {view === "explore" ? (
        <div className="max-w-[1320px] mx-auto px-[clamp(16px,3vw,28px)] pb-24">
          {/* search + categories */}
          <div className="sticky top-[60px] z-30 -mx-[clamp(16px,3vw,28px)] px-[clamp(16px,3vw,28px)] py-3" style={{ background: "color-mix(in oklab, var(--bg) 88%, #fff)", backdropFilter: "blur(10px)" }}>
            <SearchBox />
            <div className="mt-3"><CategoryRail /></div>
            <div className="mt-3"><FilterBar /></div>
          </div>

          <div className="flex flex-col lg:flex-row gap-5 mt-4">
            {/* grid */}
            <div className="flex-1 min-w-0">
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
              ) : (
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
                  {filtered.map((p, i) => (
                    <PlaceCard key={p.id} place={p} index={i} distanceKm={haversineKm(state.center, p.position)} />
                  ))}
                </div>
              )}
            </div>

            {/* map */}
            <div className="lg:w-[42%] lg:max-w-[560px] shrink-0">
              <div className="relative rounded-[18px] overflow-hidden border border-line h-[320px] lg:h-[calc(100vh-220px)] lg:sticky lg:top-[210px]">
                <ExploreMap places={filtered} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-[1320px] mx-auto px-[clamp(16px,3vw,28px)] py-5 pb-24">
          <div className="flex flex-col lg:flex-row gap-5">
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-[24px] tracking-[-.02em] mb-1">Your schedule</div>
              <p className="text-muted text-[13.5px] mb-4">Build each day across morning, afternoon and evening. Drag to reorder; the assistant keeps it balanced.</p>
              <ScheduleBuilder />
            </div>
            <div className="lg:w-[360px] shrink-0 flex flex-col gap-4">
              <div className="relative rounded-[18px] overflow-hidden border border-line h-[260px]">
                <PlanDayMap />
              </div>
              <PlanDayInsights />
            </div>
          </div>
        </div>
      )}

      <CompareTray pool={pool} />
      <Toast />
    </div>
  );
}

function PlanDayInsights() {
  const { state } = usePlanner();
  const dayItems = state.itinerary.filter((it) => it.day === state.day);
  return <AssistantInsights dayItems={dayItems} />;
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
  const { state } = useTrip();
  return (
    <PlannerProvider destination={state.dest}>
      <MapsApiProvider>
        <ExploreInner />
      </MapsApiProvider>
    </PlannerProvider>
  );
}
