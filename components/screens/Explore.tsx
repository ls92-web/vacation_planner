"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTrip } from "@/lib/store";
import { EX_CATEGORIES, EX_THUMBS, PLACES, SMART_FILTERS } from "@/lib/data";
import type { Place } from "@/lib/types";
import type { TripContext } from "@/lib/ai";
import { fetchInsights, fetchRecommendations } from "@/lib/ai-client";
import {
  destinationCoords,
  isMapsConfigured,
  mapsConfig,
  placeCoords,
  placeLink,
  useGeocode,
} from "@/lib/maps";
import type { MapMarker, PlaceResult } from "@/lib/maps";
import {
  DestinationMarkers,
  GoogleMap,
  HotelMarkers,
  MapInfoCard,
  MapsApiProvider,
  OpenInMapsButton,
  PlaceMarkers,
  PlacesExplorer,
} from "../maps";
import { AppNav, Brand } from "../AppNav";
import {
  Calendar,
  Car,
  Check,
  ChevronDown,
  Clock,
  Footprints,
  GripVertical,
  Heart,
  Info,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkle,
  Star,
  Ticket,
  X,
} from "../icons";

function useDist() {
  const { state } = useTrip();
  const km = state.units === "km";
  return (d: number) => (km ? `${d.toFixed(1)} km` : `${(d * 0.621).toFixed(1)} mi`);
}

/** Build the AI trip context from the current selection. */
function useTripContext(): TripContext {
  const { state } = useTrip();
  return {
    destination: state.dest,
    travelers: `${state.adults} adults · ${state.kids} kids (6 & 9)`,
    numDays: state.days.length,
    selected: state.exSelected
      .map((x) => {
        const p = PLACES.find((pp) => pp.id === x.id);
        return p ? { name: p.name, category: p.cats[0], type: p.type, priority: x.priority } : null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null),
  };
}

/** Local heuristic insights — used until/unless the AI service returns its own. */
function computeLocalInsights(selPlaces: Place[]): string[] {
  const cAttractions = selPlaces.filter((p) => p.type === "attraction" && !p.cats.includes("Hidden Gems")).length;
  const insights: string[] = [];
  if (!selPlaces.length) {
    insights.push("Add the places you love and I will handle the order, timings and travel between them later.");
    insights.push("Tip: tap a category or a smart filter to narrow the list — try Family Friendly.");
    return insights;
  }
  let pair: [Place, Place] | null = null;
  for (let i = 0; i < selPlaces.length && !pair; i++)
    for (let j = i + 1; j < selPlaces.length; j++) {
      if (Math.abs(selPlaces[i].dist - selPlaces[j].dist) < 0.7) { pair = [selPlaces[i], selPlaces[j]]; break; }
    }
  if (pair) insights.push(`${pair[0].name} and ${pair[1].name} are only a few minutes apart — I will plan them together.`);
  const closed = selPlaces.find((p) => p.closedMon);
  if (closed) insights.push(`${closed.name} is closed on Mondays — I will avoid scheduling it then.`);
  const lastR = [...selPlaces].reverse().find((p) => p.type === "restaurant");
  if (lastR) insights.push(`Adding ${lastR.name} fits nicely between your afternoon activities.`);
  if (cAttractions > 4) insights.push("That's a lot of activity for one day — I can rebalance these across your trip when I build the schedule.");
  const last = selPlaces[selPlaces.length - 1];
  if (last && insights.length < 3) insights.push(`Most travelers spend about ${last.duration || "an hour"} at ${last.name}.`);
  return insights;
}

const cardMetaChip =
  "inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink bg-[#f7f3ec] border border-line px-[9px] py-1 rounded-lg";

function PlaceCard({ place, aiScore }: { place: Place; aiScore?: number }) {
  const { state, actions } = useTrip();
  const fmtDist = useDist();
  const isSel = state.exSelected.some((x) => x.id === place.id);
  const isSaved = state.exSaved.includes(place.id);
  const expanded = state.exExpanded === place.id;
  const isRestaurant = place.type === "restaurant";
  const thumb = EX_THUMBS[place.img % EX_THUMBS.length];
  const TravelIcon = place.mode === "walk" ? Footprints : Car;

  return (
    <div
      className="bg-white border rounded-[18px] overflow-hidden flex flex-col vp-fade-fast transition-all hover:-translate-y-0.5"
      style={{
        borderColor: isSel ? "var(--accent)" : "var(--line)",
        boxShadow: "0 4px 18px -10px rgba(0,0,0,.14)",
      }}
    >
      {/* header image */}
      <div className="h-[158px] relative shrink-0" style={{ background: thumb }}>
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-[9px] py-[5px] rounded-[9px] bg-[rgba(20,16,12,.55)] text-white text-[11.5px] font-bold backdrop-blur-sm">
          <Sparkle size={13} strokeWidth={1.7} />AI {aiScore ?? place.ai}
        </div>
        <button
          onClick={() => actions.exToggleSave(place.id)}
          title="Save"
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full border-none bg-white/90 grid place-items-center cursor-pointer backdrop-blur-sm hover:bg-white"
          style={{ color: isSaved ? "var(--accent2)" : "var(--muted)" }}
        >
          <Heart size={16} strokeWidth={2} fill={isSaved ? "currentColor" : "none"} />
        </button>
        <div className="absolute bottom-2.5 left-2.5 px-[9px] py-1 rounded-lg bg-white/90 text-ink text-[11px] font-bold">{place.cats[0]}</div>
        <span className="absolute bottom-2.5 right-2.5 font-mono text-[9.5px] text-white/90 bg-black/30 px-1.5 py-0.5 rounded-[5px]">
          [{(place.cats[0] || "place").toLowerCase()} photo]
        </span>
      </div>

      {/* body */}
      <div className="px-4 py-3.5 flex flex-col flex-1">
        <div className="flex items-start gap-2.5">
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-[17px] tracking-[-.01em] leading-[1.15]">{place.name}</div>
            {isRestaurant && <div className="text-[12.5px] text-muted mt-0.5">{place.cuisine}</div>}
          </div>
          <div className="flex items-center gap-1 shrink-0 font-bold text-[13px]" style={{ color: "#e0a44f" }}>
            <Star size={14} fill="currentColor" stroke="none" />
            <span className="text-ink">{place.rating.toFixed(1)}</span>
          </div>
        </div>
        <p className="text-[13px] text-muted leading-[1.5] mt-[7px]">{place.desc}</p>

        <div className="mt-[11px] flex flex-wrap gap-1.5">
          {!isRestaurant && (
            <span className={cardMetaChip}><span className="text-accent flex"><Clock size={13} strokeWidth={2} /></span>{place.duration}</span>
          )}
          <span className={cardMetaChip}><span className="text-accent flex"><Ticket size={13} strokeWidth={2} /></span>{place.price || place.avgPrice}</span>
          <span className={cardMetaChip}><span className="text-accent flex"><Calendar size={13} strokeWidth={2} /></span>{place.hours}</span>
          <span className={cardMetaChip}><span className="text-accent flex"><MapPin size={13} strokeWidth={2} /></span>{fmtDist(place.dist)} from hotel</span>
          <span className={cardMetaChip}><span className="text-accent flex"><TravelIcon size={13} strokeWidth={2} /></span>{place.travel}</span>
          {isRestaurant && (
            <span className={cardMetaChip}><span className="text-accent flex"><Calendar size={13} strokeWidth={2} /></span>{place.reservation ? "Reservation recommended" : "Walk-ins welcome"}</span>
          )}
          {place.tags.includes("family") && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold px-[9px] py-1 rounded-lg" style={{ color: "#2f7a4d", background: "#e7f4ec" }}>Family friendly</span>
          )}
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-line vp-slide-down">
            <div className="flex items-center gap-1.5 text-[11.5px] font-bold tracking-[.03em] uppercase text-accent">
              <Sparkle size={13} strokeWidth={1.7} />Why AI recommends this
            </div>
            <p className="text-[12.5px] text-ink leading-[1.5] mt-1.5">{place.why}</p>
            <div className="mt-[11px] flex flex-col gap-[7px]">
              {!isRestaurant && (
                <div className="flex gap-2 text-[12px]"><span className="text-muted min-w-[96px]">Family fit</span><span className="font-semibold">{place.family}</span></div>
              )}
              <div className="flex gap-2 text-[12px]"><span className="text-muted min-w-[96px]">Best time</span><span className="font-semibold">{place.best}</span></div>
              <div className="flex gap-2 text-[12px]"><span className="text-muted min-w-[96px]">Nearby</span><span className="font-semibold">{place.nearby.join(" · ")}</span></div>
            </div>
          </div>
        )}

        <div className="mt-[13px] flex items-center gap-2">
          <button onClick={() => actions.exExpand(place.id)}
            className="shrink-0 flex items-center gap-1 px-[11px] py-[9px] border border-line rounded-[10px] bg-white text-muted text-[12.5px] font-semibold cursor-pointer hover:border-accent hover:text-accent">
            <span className="flex transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}><ChevronDown size={14} strokeWidth={2} /></span>
            {expanded ? "Less" : "Details"}
          </button>
          <button onClick={() => actions.exToggleTrip(place.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-[9px] border-[1.5px] border-accent rounded-[10px] text-[13px] font-bold cursor-pointer transition"
            style={{ background: isSel ? "var(--accent)" : "#fff", color: isSel ? "#fff" : "var(--accent)" }}>
            {isSel ? <Check size={15} strokeWidth={2} /> : <Plus size={15} strokeWidth={2} />}
            {isSel ? "Added to trip" : "Add to My Trip"}
          </button>
        </div>
        <OpenInMapsButton
          href={placeLink({ name: place.name, position: placeCoords(place.id) })}
          size="sm"
          className="mt-2 w-full"
        />
      </div>
    </div>
  );
}

function Counters() {
  const { state } = useTrip();
  const selPlaces = state.exSelected.map((x) => PLACES.find((p) => p.id === x.id)).filter(Boolean) as Place[];
  const cAttractions = selPlaces.filter((p) => p.type === "attraction" && !p.cats.includes("Hidden Gems")).length;
  const cRestaurants = selPlaces.filter((p) => p.type === "restaurant").length;
  const cHidden = selPlaces.filter((p) => p.cats.includes("Hidden Gems")).length;
  const counters = [
    { n: cAttractions, label: cAttractions === 1 ? "Attraction" : "Attractions" },
    { n: cRestaurants, label: cRestaurants === 1 ? "Restaurant" : "Restaurants" },
    { n: cHidden, label: cHidden === 1 ? "Hidden Gem" : "Hidden Gems" },
  ];
  return (
    <div className="flex gap-2">
      {counters.map((c, i) => (
        <div key={i} className="flex-1 bg-tint rounded-[11px] px-2 py-3 text-center">
          <div className="font-display font-bold text-[24px] leading-none text-accent">{c.n}</div>
          <div className="text-[11px] text-muted mt-1 font-semibold">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function SelectedList() {
  const { state, actions } = useTrip();
  if (state.exSelected.length === 0) {
    return (
      <div className="px-3.5 py-[22px] text-center border-[1.5px] border-dashed border-line rounded-xl text-muted text-[13px]">
        No places yet. Head to <strong className="text-ink">Explore</strong> and tap <strong className="text-ink">Add to My Trip</strong>.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {state.exSelected.map((x) => {
        const p = PLACES.find((pp) => pp.id === x.id);
        if (!p) return null;
        const isMust = x.priority === "must";
        const dragging = state.exDragId === x.id;
        const drop = state.exDragOver === x.id && state.exDragId != null && state.exDragId !== x.id;
        return (
          <div key={x.id} draggable
            onDragStart={actions.exDragStart(x.id)} onDragOver={actions.exDragOverItem(x.id)}
            onDrop={actions.exDropItem(x.id)} onDragEnd={actions.exDragEndItem}
            className="flex items-center gap-2.5 p-2.5 rounded-xl border transition-opacity"
            style={{ borderColor: drop ? "var(--accent)" : "var(--line)", background: dragging ? "var(--tint)" : "#fcfaf6", opacity: dragging ? 0.5 : 1 }}>
            <div className="flex text-[#c4bbb0] cursor-grab shrink-0"><GripVertical size={16} fill="currentColor" stroke="none" /></div>
            <div className="w-[34px] h-[34px] rounded-lg shrink-0" style={{ background: EX_THUMBS[p.img % EX_THUMBS.length] }} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[13px] whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</div>
              <div className="flex gap-1.5 mt-1">
                <button onClick={() => actions.exSetPriority(x.id, "must")}
                  className="px-2 py-0.5 rounded-md border text-[10.5px] font-bold cursor-pointer"
                  style={{ borderColor: isMust ? "var(--accent)" : "var(--line)", background: isMust ? "var(--accent)" : "#fff", color: isMust ? "#fff" : "var(--muted)" }}>Must visit</button>
                <button onClick={() => actions.exSetPriority(x.id, "optional")}
                  className="px-2 py-0.5 rounded-md border text-[10.5px] font-bold cursor-pointer"
                  style={{ borderColor: !isMust ? "var(--accent)" : "var(--line)", background: !isMust ? "var(--accent)" : "#fff", color: !isMust ? "#fff" : "var(--muted)" }}>Optional</button>
              </div>
            </div>
            <button onClick={() => actions.exRemove(x.id)} title="Remove"
              className="w-[26px] h-[26px] rounded-md border border-line bg-white text-muted grid place-items-center cursor-pointer shrink-0 hover:border-[#d9534f] hover:text-[#d9534f]">
              <X size={13} strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Insights() {
  const { state } = useTrip();
  const ctx = useTripContext();
  const selKey = state.exSelected.map((x) => x.id).join(",");
  const selPlaces = useMemo(
    () => state.exSelected.map((x) => PLACES.find((p) => p.id === x.id)).filter(Boolean) as Place[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selKey]
  );
  const local = useMemo(() => computeLocalInsights(selPlaces), [selPlaces]);
  const [ai, setAi] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAi(null);
    if (!state.exSelected.length) return;
    fetchInsights(ctx).then((r) => {
      if (!cancelled && r) setAi(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  const insights = ai ?? local;
  return (
    <div className="mt-3 flex flex-col gap-[9px]">
      {insights.map((text, i) => (
        <div key={i} className="flex gap-2.5 px-3 py-[11px] rounded-xl bg-tint vp-slide-up">
          <span className="text-accent shrink-0 mt-px flex"><Info size={15} strokeWidth={2} /></span>
          <span className="text-[12.5px] text-ink leading-[1.45]">{text}</span>
        </div>
      ))}
    </div>
  );
}

/** Stylized CSS map used when no Google Maps key is configured. */
function ExploreMapFallback() {
  const { state, actions } = useTrip();
  const selIds = state.exSelected.map((x) => x.id);
  return (
    <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 78% 22%, #cfe4e0 0%, transparent 46%), linear-gradient(180deg,#eef3ec,#e7efe8)" }}>
      <div className="absolute right-0 bottom-0 w-[46%] h-[55%] opacity-85" style={{ background: "linear-gradient(160deg,#a9d2d8,#7fbcc6)", clipPath: "polygon(20% 100%,0 40%,40% 18%,100% 0,100% 100%)" }} />
      <div className="absolute inset-0 opacity-50" style={{ background: "repeating-linear-gradient(58deg, transparent 0 60px, rgba(255,255,255,.7) 60px 62px),repeating-linear-gradient(150deg, transparent 0 78px, rgba(255,255,255,.6) 78px 80px)" }} />
      <div className="absolute top-3 left-3 font-mono text-[10px] text-[#5d7068] bg-white/80 px-2 py-1 rounded-[7px]">live map · your picks</div>
      {PLACES.map((p) => {
        const sel = selIds.includes(p.id);
        const idx = selIds.indexOf(p.id);
        return (
          <button key={p.id} onClick={() => actions.exMapPick(p.id)} className="absolute -translate-x-1/2 -translate-y-1/2 border-none bg-transparent cursor-pointer"
            style={{ left: p.x, top: p.y, zIndex: sel ? 20 : 5 }}>
            {sel ? (
              <div className="w-[26px] h-[26px] grid place-items-center" style={{ borderRadius: "50% 50% 50% 2px", transform: "rotate(45deg)", background: "var(--accent)", boxShadow: "0 4px 10px -2px rgba(0,0,0,.4)", border: state.exMapSel === p.id ? "2px solid #fff" : "2px solid rgba(255,255,255,.85)" }}>
                <span className="text-white font-bold text-[11px]" style={{ transform: "rotate(-45deg)" }}>{idx + 1}</span>
              </div>
            ) : (
              <div className="w-[9px] h-[9px] rounded-full bg-white border-2 border-muted opacity-70" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Geocodes the user's accommodations and lifts hotel markers to the parent. */
function HotelGeocoder({ onMarkers }: { onMarkers: (m: MapMarker[]) => void }) {
  const { state } = useTrip();
  const geocode = useGeocode();
  const accoms = state.destinations.flatMap((d) => d.accoms.map((a) => ({ ...a, destName: d.name })));
  const key = accoms.map((a) => `${a.id}:${a.address}`).join("|");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: MapMarker[] = [];
      for (const a of accoms) {
        if (!a.address) continue;
        const loc = await geocode(a.address);
        if (loc) out.push({ id: `hotel-${a.id}`, name: a.name || "Stay", kind: "hotel", position: loc, category: a.type, subtitle: a.destName });
      }
      if (!cancelled) onMarkers(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

function ExploreRealMap() {
  const { state, actions } = useTrip();
  const [hotelMarkers, setHotelMarkers] = useState<MapMarker[]>([]);
  const selIds = state.exSelected.map((x) => x.id);
  const center = destinationCoords(state.dest.split(",")[0]) ?? mapsConfig.defaultCenter;

  const destMarker: MapMarker = { id: "dest", name: state.dest.split(",")[0], kind: "destination", position: center, category: "Destination" };
  const placeMarkers: MapMarker[] = selIds
    .map((id): MapMarker | null => {
      const p = PLACES.find((pp) => pp.id === id);
      const c = p ? placeCoords(p.id) : null;
      if (!p || !c) return null;
      return { id: p.id, name: p.name, kind: p.type === "restaurant" ? "restaurant" : "attraction", position: c, category: p.cats[0], rating: p.rating };
    })
    .filter((m): m is MapMarker => m !== null);
  const pickMarkers: MapMarker[] = state.mapPicks.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.category === "Restaurants" || p.category === "Cafés" ? ("restaurant" as const) : ("attraction" as const),
    position: p.position,
    category: p.category,
    rating: p.rating,
  }));

  const allMarkers = [destMarker, ...hotelMarkers, ...placeMarkers, ...pickMarkers];
  const selMarker = state.exMapSel ? allMarkers.find((m) => m.id === state.exMapSel) ?? null : null;
  const selIsCatalog = !!selMarker && PLACES.some((p) => p.id === selMarker.id);

  return (
    <GoogleMap center={center} zoom={13} className="absolute inset-0 h-full w-full" fallback={<ExploreMapFallback />}>
      <DestinationMarkers markers={[destMarker]} selectedId={state.exMapSel} onSelect={actions.exMapPick} />
      <HotelGeocoder onMarkers={setHotelMarkers} />
      <HotelMarkers markers={hotelMarkers} selectedId={state.exMapSel} onSelect={actions.exMapPick} />
      <PlaceMarkers markers={[...placeMarkers, ...pickMarkers]} selectedId={state.exMapSel} onSelect={actions.exMapPick} />
      {selMarker && (
        <MapInfoCard
          marker={selMarker}
          onClose={() => actions.exMapPick(null)}
          onAdd={selIsCatalog ? (m) => actions.exToggleTrip(m.id) : undefined}
          added={selIsCatalog ? selIds.includes(selMarker.id) : undefined}
        />
      )}
    </GoogleMap>
  );
}

/** Footer shown under the map for a selected catalog place (fallback parity). */
function MapSelFooter() {
  const { state, actions } = useTrip();
  const selIds = state.exSelected.map((x) => x.id);
  const mapSelPlace = state.exMapSel ? PLACES.find((p) => p.id === state.exMapSel) : null;
  if (!mapSelPlace) return null;
  const isSel = selIds.includes(mapSelPlace.id);
  return (
    <div className="px-3.5 py-3 border-t border-line flex items-center gap-[11px] vp-fade-fast">
      <div className="w-10 h-10 rounded-[9px] shrink-0" style={{ background: EX_THUMBS[mapSelPlace.img % EX_THUMBS.length] }} />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[13.5px] whitespace-nowrap overflow-hidden text-ellipsis">{mapSelPlace.name}</div>
        <div className="text-[11.5px] text-muted">{mapSelPlace.cats[0]} · {mapSelPlace.rating.toFixed(1)}★</div>
      </div>
      <button onClick={() => actions.exToggleTrip(mapSelPlace.id)}
        className="shrink-0 flex items-center gap-1 px-[11px] py-[7px] border-[1.5px] border-accent rounded-[9px] text-[12px] font-bold cursor-pointer"
        style={{ background: isSel ? "var(--accent)" : "#fff", color: isSel ? "#fff" : "var(--accent)" }}>
        {isSel ? <Check size={13} strokeWidth={2} /> : <Plus size={13} strokeWidth={2} />}{isSel ? "Added" : "Add"}
      </button>
    </div>
  );
}

function MapCanvas() {
  return (
    <div className="flex-[1_1_420px] min-w-[300px] bg-white border border-line rounded-[18px] overflow-hidden">
      <div className="relative" style={{ height: "clamp(360px,52vh,560px)" }}>
        <ExploreRealMap />
      </div>
      <MapSelFooter />
    </div>
  );
}

/** Nearby Places browser bound to the current destination. */
function NearbyExplorer() {
  const { state, actions } = useTrip();
  const center = destinationCoords(state.dest.split(",")[0]) ?? mapsConfig.defaultCenter;
  const addedIds = state.mapPicks.map((p) => p.id);
  const handleAdd = (p: PlaceResult) => actions.addMapPick(p);
  return <PlacesExplorer center={center} onAdd={handleAdd} addedIds={addedIds} />;
}

export function Explore() {
  const { state, actions } = useTrip();
  const ctx = useTripContext();

  // Best-effort: ask the AI to score the catalog by family fit (once). Falls back
  // to the curated static scores/order when no key is configured or the call fails.
  const [recoScores, setRecoScores] = useState<Record<string, number>>({});
  const recoRequested = useRef(false);
  useEffect(() => {
    if (recoRequested.current) return;
    recoRequested.current = true;
    fetchRecommendations(ctx, PLACES.map((p) => ({ name: p.name, category: p.cats[0] }))).then((recs) => {
      if (!recs) return;
      const map: Record<string, number> = {};
      for (const r of recs) {
        const p = PLACES.find((pp) => pp.name === r.name);
        if (p) map[p.id] = r.ai;
      }
      if (Object.keys(map).length) setRecoScores(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scoreOf = (p: Place) => recoScores[p.id] ?? p.ai;

  const q = state.exSearch.trim().toLowerCase();
  const matches = (p: Place) => {
    if (q && !(p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || (p.cuisine || "").toLowerCase().includes(q))) return false;
    if (state.exCat !== "All" && !p.cats.includes(state.exCat)) return false;
    if (state.exSmart.length && !state.exSmart.every((k) => p.tags.includes(k))) return false;
    return true;
  };
  let list = PLACES.filter(matches);
  if (Object.keys(recoScores).length) list = [...list].sort((a, b) => scoreOf(b) - scoreOf(a));
  const savedCards = PLACES.filter((p) => state.exSaved.includes(p.id));
  const hasFilters = state.exSmart.length > 0 || state.exCat !== "All" || !!q;
  const createLabel = state.exSelected.length ? `Create My Schedule · ${state.exSelected.length}` : "Create My Schedule";

  return (
    <div className="vp-scroll min-h-screen" style={{ background: "var(--bg)" }}>
      {/* header */}
      <div className="sticky top-0 z-40 border-b border-line" style={{ background: "color-mix(in oklab, var(--bg) 85%, #fff)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-[1240px] mx-auto py-[11px] flex items-center gap-4 flex-wrap" style={{ paddingLeft: "clamp(16px,3vw,28px)", paddingRight: "clamp(16px,3vw,28px)" }}>
          <Brand />
          <div className="flex-1" />
          <AppNav />
          <div className="flex-1" />
          <button onClick={actions.createSchedule}
            className="shrink-0 flex items-center gap-2 px-[18px] py-[11px] border-none rounded-xl bg-accent text-white text-[14px] font-bold cursor-pointer hover:brightness-[1.06]"
            style={{ opacity: state.exSelected.length ? 1 : 0.55, boxShadow: "0 8px 20px -10px var(--accent)" }}>
            {createLabel}<ChevronDown size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="max-w-[1240px] mx-auto pt-5 pb-[60px]" style={{ paddingLeft: "clamp(16px,3vw,28px)", paddingRight: "clamp(16px,3vw,28px)" }}>
        {/* EXPLORE TAB */}
        {state.exTab === "explore" && (
          <div className="vp-fade-fast">
            <div className="flex items-center gap-2 bg-white border border-line rounded-[13px] px-3.5 max-w-[560px] mb-4">
              <span className="text-muted flex"><Search size={18} strokeWidth={2} /></span>
              <input value={state.exSearch} onChange={(e) => actions.exOnSearch(e.target.value)} placeholder="Search places, food, neighborhoods…"
                className="flex-1 min-w-0 border-none outline-none py-[13px] text-[14.5px] bg-transparent text-ink" />
            </div>

            <div className="vp-scroll flex gap-[7px] overflow-x-auto mb-3.5 pb-0.5">
              {EX_CATEGORIES.map((c) => {
                const on = state.exCat === c;
                return (
                  <button key={c} onClick={() => actions.exSetCat(c)}
                    className="shrink-0 px-3.5 py-[7px] rounded-[10px] border text-[13px] font-semibold cursor-pointer transition whitespace-nowrap"
                    style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent)" : "#fff", color: on ? "#fff" : "var(--ink)" }}>{c}</button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-muted mr-0.5">
                <SlidersHorizontal size={15} strokeWidth={2} />Smart filters
              </span>
              {SMART_FILTERS.map((f) => {
                const on = state.exSmart.includes(f.k);
                return (
                  <button key={f.k} onClick={() => actions.exToggleSmart(f.k)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] border text-[12.5px] font-semibold cursor-pointer transition"
                    style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent)" : "#fff", color: on ? "#fff" : "var(--muted)" }}>{f.label}</button>
                );
              })}
              {hasFilters && (
                <button onClick={actions.exClearSmart} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border-none bg-transparent text-accent text-[12.5px] font-bold cursor-pointer">
                  <X size={13} strokeWidth={2} />Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 px-[18px] py-3.5 rounded-[16px] border mb-[18px]" style={{ background: "linear-gradient(135deg, var(--tint), #fff 75%)", borderColor: "color-mix(in oklab, var(--accent) 16%, var(--line))" }}>
              <div className="w-[34px] h-[34px] rounded-[10px] bg-accent text-white grid place-items-center shrink-0"><Sparkle size={18} strokeWidth={1.7} /></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[14px]">Curated for the Ortega family</div>
                <div className="text-[12.5px] text-muted">2 adults · 2 kids (6 &amp; 9) · ranked by AI fit · {list.length} places</div>
              </div>
            </div>

            {list.length > 0 ? (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))" }}>
                {list.map((p) => <PlaceCard key={p.id} place={p} aiScore={recoScores[p.id]} />)}
              </div>
            ) : (
              <div className="py-[60px] px-5 text-center text-muted">
                <div className="w-[46px] h-[46px] mx-auto rounded-full bg-tint text-accent grid place-items-center"><Search size={22} strokeWidth={2} /></div>
                <div className="mt-3.5 font-bold text-ink">No places match those filters</div>
                <div className="text-[13px] mt-1">Try removing a filter or searching something else.</div>
              </div>
            )}
          </div>
        )}

        {/* SAVED TAB */}
        {state.exTab === "saved" && (
          <div className="vp-fade-fast">
            <div className="flex items-baseline gap-2.5 mb-[18px]">
              <div className="font-display font-bold text-[24px] tracking-[-.02em]">Saved places</div>
              <div className="text-[13.5px] text-muted">{state.exSaved.length} saved</div>
            </div>
            {savedCards.length > 0 ? (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))" }}>
                {savedCards.map((p) => <PlaceCard key={p.id} place={p} aiScore={recoScores[p.id]} />)}
              </div>
            ) : (
              <div className="py-[70px] px-5 text-center text-muted">
                <div className="w-[50px] h-[50px] mx-auto rounded-full bg-tint grid place-items-center" style={{ color: "var(--accent2)" }}><Heart size={24} strokeWidth={2} /></div>
                <div className="mt-3.5 font-bold text-ink">Nothing saved yet</div>
                <div className="text-[13px] mt-1">Tap the heart on any place in Explore to keep it here for later.</div>
              </div>
            )}
          </div>
        )}

        {/* MAP TAB */}
        {state.exTab === "map" && (
          <MapsApiProvider>
            <div className="flex gap-5 items-start flex-wrap vp-fade-fast">
              <MapCanvas />
              <div className="flex-[1_1_280px] min-w-[280px] max-w-[400px] flex flex-col gap-4">
                <div className="bg-white border border-line rounded-[18px] p-4">
                  <div className="font-display font-bold text-[16px] mb-3">Selected on the map</div>
                  <Counters />
                  <div className="mt-3.5"><SelectedList /></div>
                </div>
                {isMapsConfigured() && (
                  <div className="bg-white border border-line rounded-[18px] p-4">
                    <div className="font-display font-bold text-[16px] mb-1">Explore nearby</div>
                    <div className="text-[12.5px] text-muted mb-3">Powered by Google Places — add spots straight to your trip.</div>
                    <NearbyExplorer />
                  </div>
                )}
              </div>
            </div>
          </MapsApiProvider>
        )}

        {/* AI PLANNER TAB */}
        {state.exTab === "planner" && (
          <div className="vp-fade-fast">
            <div className="mb-[18px]">
              <div className="font-display font-bold text-[24px] tracking-[-.02em]">Your trip plan</div>
              <div className="text-[13.5px] text-muted mt-1">Pick your priorities and let AI organize the days. Drag to reorder; mark must-visits.</div>
            </div>
            <div className="flex gap-5 items-start flex-wrap">
              <div className="flex-[1_1_380px] min-w-[300px] bg-white border border-line rounded-[18px] p-[18px]">
                <div className="font-display font-bold text-[16px] mb-3">Your trip list</div>
                <Counters />
                <div className="mt-[15px]"><SelectedList /></div>
              </div>
              <div className="flex-[1_1_300px] min-w-[280px] max-w-[400px] bg-white border border-line rounded-[18px] p-[18px]">
                <div className="flex items-center gap-1.5 font-display font-bold text-[15px]">
                  <span className="text-accent flex"><Sparkle size={16} strokeWidth={1.7} /></span>AI assistant
                </div>
                <Insights />
                <button onClick={actions.createSchedule}
                  className="mt-[15px] w-full flex items-center justify-center gap-1.5 py-3.5 border-none rounded-xl bg-accent text-white text-[14.5px] font-bold cursor-pointer hover:brightness-[1.06]"
                  style={{ opacity: state.exSelected.length ? 1 : 0.55, boxShadow: "0 10px 22px -10px var(--accent)" }}>
                  <Sparkle size={16} strokeWidth={1.7} />{createLabel}
                </button>
                <div className="mt-2 text-center text-[11px] text-muted">I&apos;ll order everything by hours, travel time &amp; meal times.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
