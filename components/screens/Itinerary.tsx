"use client";

import { useTrip } from "@/lib/store";
import { PIN_COLORS, THUMBS } from "@/lib/data";
import type { PlanTab, Stop } from "@/lib/types";
import { destinationCoords, mapsConfig, stopCoords } from "@/lib/maps";
import type { LatLng, MapMarker } from "@/lib/maps";
import { GoogleMap, MapsApiProvider, MapInfoCard, PlaceMarkers, RoutePlanner } from "../maps";
import { AppNav, Brand } from "../AppNav";
import { DAY_ICONS, TRAVEL_ICONS } from "../icons";
import {
  Calendar,
  Clock,
  Download,
  Footprints,
  Send,
  Sparkle,
  User,
} from "../icons";

const TABS: { id: PlanTab; name: string }[] = [
  { id: "schedule", name: "Schedule" },
  { id: "map", name: "Map" },
  { id: "chat", name: "Assistant" },
];

function useDist0() {
  const { state } = useTrip();
  const km = state.units === "km";
  return (d: number) => (d === 0 ? "—" : km ? `${d.toFixed(1)} km` : `${(d * 0.621).toFixed(1)} mi`);
}

function Schedule() {
  const { state, actions } = useTrip();
  const fmtDist = useDist0();
  const DAYS = state.days;
  const day = DAYS[state.day] || DAYS[0];
  const km = state.units === "km";
  const totalStops = DAYS.reduce((a, d) => a + d.stops.length, 0);
  const planSummary = `3 days · ${totalStops} stops · tuned for kids 6 & 9 · ${state.pace} pace`;
  const DayIcon = DAY_ICONS[day.emoji] || Footprints;
  const stopChip = "inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink bg-[#f7f3ec] border border-line px-2.5 py-[5px] rounded-lg";

  return (
    <div className="flex-1 max-w-[1080px] w-full mx-auto pb-[70px] vp-fade" style={{ padding: "clamp(20px,3vw,36px) clamp(16px,3vw,24px) 70px" }}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-display font-bold tracking-[-.02em]" style={{ fontSize: "clamp(26px,3.4vw,36px)" }}>Your custom schedule</div>
          <p className="text-muted mt-1.5 text-[14.5px]">{planSummary}</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-line rounded-[11px] p-1">
          <span className="text-[12px] text-muted pl-2">Distance</span>
          <button onClick={() => actions.setUnits("km")} className="px-3 py-1.5 border-none rounded-lg text-[12.5px] font-bold cursor-pointer"
            style={{ background: km ? "var(--accent)" : "transparent", color: km ? "#fff" : "var(--muted)" }}>km</button>
          <button onClick={() => actions.setUnits("mi")} className="px-3 py-1.5 border-none rounded-lg text-[12.5px] font-bold cursor-pointer"
            style={{ background: !km ? "var(--accent)" : "transparent", color: !km ? "#fff" : "var(--muted)" }}>mi</button>
        </div>
      </div>

      {/* Day selector */}
      <div className="mt-[22px] flex gap-2.5 flex-wrap">
        {DAYS.map((d, i) => {
          const on = state.day === i;
          return (
            <button key={i} onClick={() => actions.setDay(i)} className="text-left px-[18px] py-[13px] rounded-[14px] border-[1.5px] cursor-pointer min-w-[150px] transition"
              style={{ background: on ? "var(--accent)" : "#fff", borderColor: on ? "var(--accent)" : "var(--line)" }}>
              <div className="text-[11.5px] font-bold tracking-[.04em] uppercase" style={{ color: on ? "rgba(255,255,255,.8)" : "var(--accent)" }}>{d.day}</div>
              <div className="font-bold text-[15px] mt-0.5" style={{ color: on ? "#fff" : "var(--ink)" }}>{d.date}</div>
              <div className="text-[12px] text-muted mt-0.5">{d.meta}</div>
            </button>
          );
        })}
      </div>

      {/* Day theme banner */}
      <div className="mt-[22px] flex items-center gap-3 px-[18px] py-3.5 rounded-[14px] bg-tint border" style={{ borderColor: "color-mix(in oklab, var(--accent) 18%, transparent)" }}>
        <span className="text-accent flex"><DayIcon size={22} strokeWidth={2} /></span>
        <div>
          <div className="font-bold text-[14.5px]">{day.title}</div>
          <div className="text-[12.5px] text-muted">{day.note}</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-[18px] relative">
        {day.stops.map((s, i) => {
          const last = i === day.stops.length - 1;
          const TravelIcon = TRAVEL_ICONS[s.mode] || Footprints;
          return (
            <div key={i} className="flex gap-4 vp-fade-fast">
              {/* rail */}
              <div className="flex flex-col items-center shrink-0 w-[54px]">
                <div className="text-[12.5px] font-bold text-accent font-mono">{s.time}</div>
                <div className="w-[30px] h-[30px] mt-1.5 rounded-full bg-white border-2 border-accent text-accent grid place-items-center text-[13px] font-bold z-[2]">{i + 1}</div>
                {!last && <div className="flex-1 w-0.5 bg-line my-1" />}
              </div>
              {/* card */}
              <div className="flex-1 mb-3.5 bg-white border border-line rounded-[16px] overflow-hidden" style={{ boxShadow: "0 2px 10px -6px rgba(0,0,0,.1)" }}>
                <div className="flex flex-wrap">
                  <div className="flex-[1_1_260px] px-[18px] py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold tracking-[.03em] uppercase text-accent bg-tint px-[9px] py-[3px] rounded-[7px]">{s.cat}</span>
                      {s.kid && <span className="text-[11px] font-bold px-[9px] py-[3px] rounded-[7px]" style={{ color: "#2f7a4d", background: "#e7f4ec" }}>★ Kid-friendly</span>}
                    </div>
                    <div className="font-display font-bold text-[19px] mt-2.5 tracking-[-.01em]">{s.title}</div>
                    <p className="text-[13.5px] text-muted leading-[1.55] mt-[5px]">{s.blurb}</p>
                    <div className="mt-[13px] flex flex-wrap gap-[7px]">
                      <span className={stopChip}><Clock size={13} strokeWidth={2} className="text-accent" />{s.duration}</span>
                      <span className={stopChip}><Calendar size={13} strokeWidth={2} className="text-accent" />{s.hours}</span>
                      <span className={stopChip}><User size={13} strokeWidth={2} className="text-accent" />{s.age}</span>
                    </div>
                  </div>
                  <div className="flex-[0_0_132px] flex items-end p-[11px] relative" style={{ background: THUMBS[i % THUMBS.length] }}>
                    <span className="font-mono text-[10px] text-white/90 bg-black/30 px-[7px] py-[3px] rounded-md">[{s.cat.toLowerCase()} photo]</span>
                  </div>
                </div>
                {!last && s.mode && (
                  <div className="border-t border-dashed border-line px-[18px] py-[9px] flex items-center gap-2 text-[12.5px] text-muted bg-[#fcfaf6]">
                    <span className="flex"><TravelIcon size={14} strokeWidth={2} /></span> {s.mode} to next · <strong className="text-ink font-bold">{fmtDist(s.dist)}</strong> · {s.travelTime}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Stylized CSS map used when no Google Maps key is configured. */
function DayMapFallback({
  day,
  pin,
  onPick,
  fmtDist,
  dest,
}: {
  day: { stops: Stop[] };
  pin: number | null;
  onPick: (i: number) => void;
  fmtDist: (d: number) => string;
  dest: string;
}) {
  const routePoints = day.stops.map((st) => `${parseFloat(st.x)},${parseFloat(st.y)}`).join(" ");
  const pinFor = pin != null ? day.stops[pin] : null;
  return (
    <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 78% 22%, #cfe4e0 0%, transparent 46%), linear-gradient(180deg,#eef3ec,#e7efe8)" }}>
      <div className="absolute right-0 bottom-0 w-[46%] h-[55%] opacity-85" style={{ background: "linear-gradient(160deg,#a9d2d8,#7fbcc6)", clipPath: "polygon(20% 100%,0 40%,40% 18%,100% 0,100% 100%)" }} />
      <div className="absolute inset-0 opacity-50" style={{ background: "repeating-linear-gradient(58deg, transparent 0 60px, rgba(255,255,255,.7) 60px 63px),repeating-linear-gradient(150deg, transparent 0 78px, rgba(255,255,255,.6) 78px 81px)" }} />
      <div className="absolute top-3.5 left-3.5 font-mono text-[11px] text-[#5d7068] bg-white/80 px-2.5 py-[5px] rounded-lg">interactive map · {dest}</div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
        <polyline points={routePoints} fill="none" stroke="var(--accent)" strokeWidth="0.7" strokeDasharray="2 1.4" strokeLinecap="round" opacity="0.55" />
      </svg>
      {day.stops.map((st, i) => {
        const sel = pin === i;
        return (
          <button key={i} onClick={() => onPick(i)} className="absolute border-none bg-transparent cursor-pointer vp-drop" style={{ left: st.x, top: st.y, transform: "translate(-50%,-100%)", zIndex: sel ? 20 : 10 }}>
            <div className="grid place-items-center" style={{ width: sel ? 34 : 28, height: sel ? 34 : 28, borderRadius: "50% 50% 50% 2px", transform: "rotate(45deg)", background: PIN_COLORS[i % PIN_COLORS.length], boxShadow: "0 5px 12px -3px rgba(0,0,0,.4)" }}>
              <span className="text-white font-bold text-[12px]" style={{ transform: "rotate(-45deg)" }}>{i + 1}</span>
            </div>
          </button>
        );
      })}
      {pinFor && (
        <div className="absolute w-[230px] bg-white rounded-[14px] overflow-hidden z-40 vp-pop" style={{ left: pinFor.x, top: pinFor.y, transform: "translate(-50%,calc(-100% - 22px))", boxShadow: "0 18px 40px -12px rgba(0,0,0,.32)" }}>
          <div className="h-[74px] flex items-end p-2" style={{ background: THUMBS[(pin ?? 0) % THUMBS.length] }}>
            <span className="font-mono text-[9.5px] text-white bg-black/30 px-1.5 py-0.5 rounded-[5px]">[{pinFor.cat.toLowerCase()} photo]</span>
          </div>
          <div className="px-3.5 py-3">
            <div className="font-bold text-[14.5px]">{pinFor.title}</div>
            <div className="text-[12px] text-muted mt-0.5 flex items-center gap-1"><Clock size={12} strokeWidth={2} />{pinFor.time} · {pinFor.duration}</div>
            <div className="mt-2 flex gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold bg-tint text-accent px-2 py-[3px] rounded-md">{pinFor.cat}</span>
              <span className="text-[11px] font-semibold bg-[#f7f3ec] text-ink px-2 py-[3px] rounded-md">{fmtDist(pinFor.dist)} from center</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanMap() {
  const { state, actions } = useTrip();
  const fmtDist = useDist0();
  const DAYS = state.days;
  const day = DAYS[state.day] || DAYS[0];

  // Real-map data: markers + ordered waypoints from the day's stops.
  const markers: MapMarker[] = day.stops
    .map((st, i): MapMarker | null => {
      const pos = stopCoords(st.title);
      if (!pos) return null;
      return {
        id: `stop-${i}`,
        name: st.title,
        kind: st.cat.toLowerCase().includes("restaurant") ? "restaurant" : "attraction",
        position: pos,
        category: st.cat,
        subtitle: `${st.time} · ${st.duration}`,
      };
    })
    .filter((m): m is MapMarker => m !== null);
  const waypoints: LatLng[] = markers.map((m) => m.position);
  const center = waypoints[0] ?? destinationCoords(state.dest.split(",")[0]) ?? mapsConfig.defaultCenter;
  const selectedId = state.pin != null ? `stop-${state.pin}` : null;
  const selectedMarker = markers.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="flex-1 flex flex-wrap vp-fade">
      {/* canvas */}
      <div className="flex-[2_1_480px] relative min-h-[520px]">
        <MapsApiProvider>
          <GoogleMap
            center={center}
            zoom={13}
            className="absolute inset-0 h-full w-full"
            fallback={<DayMapFallback day={day} pin={state.pin} onPick={actions.pickPin} fmtDist={fmtDist} dest={state.dest} />}
          >
            <PlaceMarkers markers={markers} selectedId={selectedId} onSelect={(id) => actions.pickPin(Number((id ?? "").replace("stop-", "")))} />
            {selectedMarker && <MapInfoCard marker={selectedMarker} onClose={() => state.pin != null && actions.pickPin(state.pin)} />}
            {waypoints.length > 1 && <RoutePlanner waypoints={waypoints} units={state.units} />}
          </GoogleMap>
        </MapsApiProvider>
      </div>
      {/* side list */}
      <div className="vp-scroll flex-[1_1_320px] overflow-y-auto border-l border-line bg-white p-[18px]" style={{ maxHeight: "calc(100vh - 62px)" }}>
        <div className="flex gap-2 mb-3.5 flex-wrap">
          {DAYS.map((d, i) => {
            const on = state.day === i;
            return (
              <button key={i} onClick={() => actions.setDay(i)} className="px-[13px] py-[7px] rounded-[9px] border text-[12.5px] font-bold cursor-pointer"
                style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent)" : "#fff", color: on ? "#fff" : "var(--ink)" }}>{d.day}</button>
            );
          })}
        </div>
        {day.stops.map((st, i) => {
          const sel = state.pin === i;
          return (
            <button key={i} onClick={() => actions.pickPin(i)} className="w-full text-left flex gap-3 items-center p-[11px] rounded-xl border cursor-pointer mb-2 transition"
              style={{ borderColor: sel ? "var(--accent)" : "var(--line)", background: sel ? "var(--tint)" : "#fff" }}>
              <div className="w-[26px] h-[26px] rounded-full shrink-0 text-white grid place-items-center text-[12px] font-bold" style={{ background: PIN_COLORS[i % PIN_COLORS.length] }}>{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13.5px] whitespace-nowrap overflow-hidden text-ellipsis">{st.title}</div>
                <div className="text-[11.5px] text-muted">{st.time} · {fmtDist(st.dist)}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Assistant() {
  const { state, actions } = useTrip();
  return (
    <div className="flex-1 max-w-[780px] w-full mx-auto flex flex-col vp-fade" style={{ height: "calc(100vh - 62px)" }}>
      <div className="vp-scroll flex-1 overflow-y-auto" style={{ padding: "24px clamp(16px,3vw,24px)" }}>
        {state.chat.map((m, i) => {
          const user = m.role === "user";
          if (!user && !m.text) return null; // hide the empty placeholder while the reply streams in
          return (
            <div key={i} className="flex gap-[11px] mb-4 vp-fade-fast" style={{ flexDirection: user ? "row-reverse" : "row" }}>
              <div className="w-8 h-8 rounded-[10px] shrink-0 grid place-items-center text-white" style={{ background: user ? "#9a8f84" : "var(--accent)" }}>
                {user ? <User size={16} strokeWidth={2} /> : <Sparkle size={16} strokeWidth={1.8} />}
              </div>
              <div className="max-w-[78%] px-4 py-[13px] rounded-[16px] text-[14.5px] leading-[1.55] whitespace-pre-wrap border"
                style={{ background: user ? "var(--accent)" : "#fff", color: user ? "#fff" : "var(--ink)", borderColor: user ? "transparent" : "var(--line)" }}>{m.text}</div>
            </div>
          );
        })}
        {state.typing && (
          <div className="flex gap-[11px] mb-4">
            <div className="w-8 h-8 rounded-[10px] grid place-items-center bg-accent text-white"><Sparkle size={16} strokeWidth={1.8} /></div>
            <div className="px-[18px] py-[15px] rounded-[16px] bg-white border border-line flex gap-[5px]">
              <span className="w-[7px] h-[7px] rounded-full bg-muted" style={{ animation: "vpDots 1.2s infinite" }} />
              <span className="w-[7px] h-[7px] rounded-full bg-muted" style={{ animation: "vpDots 1.2s infinite .2s" }} />
              <span className="w-[7px] h-[7px] rounded-full bg-muted" style={{ animation: "vpDots 1.2s infinite .4s" }} />
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-line" style={{ padding: "14px clamp(16px,3vw,24px) 22px", background: "color-mix(in oklab, var(--bg) 80%, #fff)" }}>
        <div className="flex gap-2 flex-wrap mb-[11px]">
          {["Add a rainy-day backup", "Make day 2 less busy", "Find a vegetarian dinner", "Is Park Güell stroller-friendly?"].map((t) => (
            <button key={t} onClick={() => actions.send(t)} className="px-[13px] py-2 rounded-[10px] border border-line bg-white text-ink text-[12.5px] font-semibold cursor-pointer hover:border-accent hover:text-accent">{t}</button>
          ))}
        </div>
        <div className="flex gap-2.5 items-end">
          <textarea value={state.chatInput} onChange={(e) => actions.onChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); actions.send(); } }}
            rows={1} placeholder="Ask anything about your trip…"
            className="flex-1 resize-none px-[15px] py-[13px] border border-line rounded-[14px] text-[14.5px] bg-white outline-none max-h-[120px] leading-[1.4] vp-input" />
          <button onClick={() => actions.send()} className="w-[46px] h-[46px] rounded-[13px] border-none bg-accent text-white cursor-pointer shrink-0 grid place-items-center hover:brightness-[1.08]">
            <Send size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Itinerary() {
  const { state, actions } = useTrip();
  const travelersLabel = `${state.adults} adults · ${state.kids} kids`;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-line" style={{ background: "color-mix(in oklab, var(--bg) 86%, #fff)", backdropFilter: "blur(10px)" }}>
        {/* row 1: global nav */}
        <div className="py-[11px] flex items-center gap-4 flex-wrap" style={{ paddingLeft: "clamp(16px,3vw,32px)", paddingRight: "clamp(16px,3vw,32px)", borderBottom: "1px solid color-mix(in oklab, var(--line) 55%, transparent)" }}>
          <Brand />
          <div className="flex-1" />
          <AppNav />
          <div className="flex-1" />
          <button onClick={actions.doExport} className="shrink-0 flex items-center gap-1.5 px-4 py-[9px] border-none rounded-[11px] bg-ink text-white text-[13.5px] font-semibold cursor-pointer hover:brightness-125">
            <Download size={16} strokeWidth={2} />Export
          </button>
        </div>
        {/* row 2: itinerary context */}
        <div className="py-[9px] flex items-center gap-3 flex-wrap" style={{ paddingLeft: "clamp(16px,3vw,32px)", paddingRight: "clamp(16px,3vw,32px)" }}>
          <div className="font-display font-bold text-[14.5px] tracking-[-.01em]">Your itinerary</div>
          <div className="text-[12.5px] text-muted px-2.5 py-1 bg-white border border-line rounded-lg">Jul 14–17 · {travelersLabel}</div>
          <div className="flex-1" />
          <div className="flex bg-white border border-line rounded-xl p-1 gap-0.5">
            {TABS.map((t) => {
              const on = state.planTab === t.id;
              return (
                <button key={t.id} onClick={() => actions.setTab(t.id)} className="px-[15px] py-[7px] border-none rounded-[9px] text-[13px] font-semibold cursor-pointer transition"
                  style={{ background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--muted)" }}>{t.name}</button>
              );
            })}
          </div>
        </div>
      </div>

      {state.planTab === "schedule" && <Schedule />}
      {state.planTab === "map" && <PlanMap />}
      {state.planTab === "chat" && <Assistant />}
    </div>
  );
}
