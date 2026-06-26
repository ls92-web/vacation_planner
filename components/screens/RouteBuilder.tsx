"use client";

import { useEffect, useState } from "react";
import { useTrip } from "@/lib/store";
import {
  ACCOM_TYPES,
  MODE_ORDER,
  MODE_TEMPLATES,
  fmtMonthDay,
  nightsBetween,
  recommend,
} from "@/lib/data";
import type { Accommodation, Destination } from "@/lib/types";
import {
  destinationCoords,
  fetchRoute,
  formatDistance,
  formatDuration,
  isMapsConfigured,
} from "@/lib/maps";
import type { LatLng, RouteResult } from "@/lib/maps";
import { MapSearch, MapsApiProvider } from "../maps";
import {
  ACCOM_ICONS,
  MODE_ICONS,
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Compass,
  CreditCard,
  GripVertical,
  Map,
  MapPin,
  Moon,
  Plus,
  Route,
  Sparkle,
  Star,
  TriangleAlert,
  Trash2,
  X,
} from "../icons";

const fieldLabel = "text-[12px] font-semibold text-muted";
const fieldInput =
  "w-full mt-1.5 px-[13px] py-3 border border-line rounded-[11px] text-[14.5px] bg-white outline-none vp-input";

type Status = {
  kind: "ok" | "warn" | "none";
  text: string;
  color: string;
  bg: string;
  showVal: boolean;
  valKind?: "ok" | "warn";
  valText?: string;
  valColor?: string;
  valBg?: string;
};

function statusFor(dn: number | null, booked: number): Status {
  if (dn == null) return { kind: "none", text: "Add dates", color: "var(--muted)", bg: "#f0ece4", showVal: false };
  const diff = booked - dn;
  if (diff === 0)
    return {
      kind: "ok", text: "Nights set", color: "#2f7a4d", bg: "#e7f4ec", showVal: true, valKind: "ok",
      valText: `All ${dn} night${dn !== 1 ? "s" : ""} are covered by your stays.`, valColor: "#2f7a4d", valBg: "#e7f4ec",
    };
  if (diff < 0) {
    const miss = dn - booked;
    return {
      kind: "warn", text: `${miss} night${miss !== 1 ? "s" : ""} left`, color: "#9a6512", bg: "#fbf0dd", showVal: true, valKind: "warn",
      valText: `${booked} of ${dn} nights booked — ${miss} night${miss !== 1 ? "s" : ""} without a stay.`, valColor: "#8a5a12", valBg: "#fbf0dd",
    };
  }
  return {
    kind: "warn", text: `Over by ${diff}`, color: "#9e3c37", bg: "#f7e4e2", showVal: true, valKind: "warn",
    valText: `Your stays total ${booked} nights but this leg is only ${dn} — ${diff} night${diff !== 1 ? "s" : ""} over.`, valColor: "#9e3c37", valBg: "#f7e4e2",
  };
}

const metaChip =
  "inline-flex items-center gap-1.5 text-[12px] font-semibold bg-tint text-ink px-2.5 py-[5px] rounded-lg";

function AccommodationCard({ dest, accom }: { dest: Destination; accom: Accommodation }) {
  const { actions } = useTrip();
  const an = nightsBetween(accom.checkin, accom.checkout);
  return (
    <div
      data-scroll={`accom-${accom.id}`}
      className="bg-[#fcfaf6] border border-line rounded-[14px] p-3.5 vp-slide-up"
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        {ACCOM_TYPES.map((ty) => {
          const Icon = ACCOM_ICONS[ty.k];
          const on = accom.type === ty.k;
          return (
            <button
              key={ty.k}
              onClick={() => actions.setAccomType(dest.id, accom.id, ty.k)}
              className="flex items-center gap-1.5 px-[11px] py-1.5 rounded-[9px] border text-[12.5px] font-semibold cursor-pointer transition"
              style={{
                borderColor: on ? "var(--accent)" : "var(--line)",
                background: on ? "var(--accent)" : "#fff",
                color: on ? "#fff" : "var(--muted)",
              }}
            >
              <Icon size={14} strokeWidth={2} />
              {ty.k}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); actions.removeAccom(dest.id, accom.id); }}
          title="Remove stay"
          className="w-7 h-7 rounded-lg border border-line bg-white text-muted grid place-items-center cursor-pointer hover:border-[#d9534f] hover:text-[#d9534f]"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>

      <input
        value={accom.name}
        onChange={(e) => actions.updateAccom(dest.id, accom.id, "name", e.target.value)}
        placeholder="Property name — e.g. Hotel Casa Bonay"
        className="w-full mt-[11px] px-[13px] py-[11px] border border-line rounded-[10px] text-[14px] font-semibold bg-white outline-none vp-input"
      />

      <div className="mt-2.5 flex flex-wrap gap-2.5 items-end">
        <div className="flex-[1_1_135px]">
          <label className="text-[11.5px] font-semibold text-muted">Check-in</label>
          <input type="date" value={accom.checkin} onChange={(e) => actions.updateAccom(dest.id, accom.id, "checkin", e.target.value)}
            className="w-full mt-[5px] px-[11px] py-2.5 border border-line rounded-[10px] text-[13.5px] text-ink bg-white outline-none vp-input" />
        </div>
        <div className="flex-[1_1_135px]">
          <label className="text-[11.5px] font-semibold text-muted">Check-out</label>
          <input type="date" value={accom.checkout} onChange={(e) => actions.updateAccom(dest.id, accom.id, "checkout", e.target.value)}
            className="w-full mt-[5px] px-[11px] py-2.5 border border-line rounded-[10px] text-[13.5px] text-ink bg-white outline-none vp-input" />
        </div>
        <div className="flex-none flex items-center gap-1.5 h-[39px] px-3 bg-white border border-line rounded-[10px] text-[12.5px] font-bold text-ink">
          <span className="text-accent flex"><Moon size={14} strokeWidth={2} /></span>
          {an == null ? "—" : `${an} night${an !== 1 ? "s" : ""}`}
        </div>
      </div>

      <div className="mt-2.5">
        <label className="text-[11.5px] font-semibold text-muted">Location</label>
        <div className="mt-[5px]">
          {isMapsConfigured() ? (
            <MapSearch
              value={accom.address}
              onChange={(t) => actions.updateAccom(dest.id, accom.id, "address", t)}
              onPick={(_loc, label) => {
                actions.updateAccom(dest.id, accom.id, "address", label);
                actions.flash(`${accom.name || "Stay"} pinned on the map`);
              }}
            />
          ) : (
            <div className="flex items-center gap-2 border border-line rounded-[10px] bg-white pl-[11px] pr-1.5">
              <span className="text-accent shrink-0 flex"><MapPin size={15} strokeWidth={2} /></span>
              <input value={accom.address} onChange={(e) => actions.updateAccom(dest.id, accom.id, "address", e.target.value)}
                placeholder="Search address or place"
                className="flex-1 min-w-0 border-none outline-none py-[11px] text-[13.5px] bg-transparent text-ink" />
              <button
                onClick={(e) => { e.stopPropagation(); actions.flash(accom.address ? `${accom.name || "Stay"} pinned on the map` : "Enter an address to locate it"); }}
                title="Preview on map"
                className="shrink-0 flex items-center gap-1.5 px-[11px] py-[7px] border border-line rounded-lg bg-tint text-accent text-[12px] font-bold cursor-pointer hover:border-accent"
              >
                <Map size={14} strokeWidth={2} />Map
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-[5px] pl-0.5">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accom.address ? "var(--accent)" : "var(--line)" }} />
          <span className="text-[11px] text-muted font-mono">
            geocoding · {accom.address ? "pinned · debounced 300ms" : "type to locate on map"}
          </span>
        </div>
      </div>

      <div className="mt-2.5">
        <label className="text-[11.5px] font-semibold text-muted">Confirmation # <span className="font-normal">(optional)</span></label>
        <input value={accom.conf} onChange={(e) => actions.updateAccom(dest.id, accom.id, "conf", e.target.value)}
          placeholder="e.g. BCN-4471QX"
          className="w-full mt-[5px] px-[11px] py-2.5 border border-line rounded-[10px] text-[13.5px] font-mono bg-white outline-none vp-input" />
      </div>
      <div className="mt-2.5">
        <label className="text-[11.5px] font-semibold text-muted">Notes</label>
        <textarea value={accom.notes} onChange={(e) => actions.updateAccom(dest.id, accom.id, "notes", e.target.value)}
          rows={2} placeholder="Family room, cot, late check-in…"
          className="w-full mt-[5px] px-[11px] py-2.5 border border-line rounded-[10px] text-[13.5px] bg-white outline-none resize-y leading-[1.45] vp-input" />
      </div>
    </div>
  );
}

/** Live driving distance/time between two destinations (Routes API), when both geocode. */
function useLiveDrive(from: LatLng | null, to: LatLng | null, enabled: boolean): RouteResult | null {
  const [route, setRoute] = useState<RouteResult | null>(null);
  useEffect(() => {
    if (!enabled || !from || !to) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    fetchRoute(from, to, { travelMode: "DRIVE" }).then((r) => {
      if (!cancelled) setRoute(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, from?.lat, from?.lng, to?.lat, to?.lng]);
  return route;
}

function TransportConnector({ from, to, dragKey }: { from: Destination; to: Destination; dragKey: string }) {
  const { state, actions } = useTrip();
  const rec = recommend(from, to);
  const chosen = state.transports[rec.key] || rec.recMode;
  const tpl = rec.override && rec.override.mode === chosen ? rec.override : MODE_TEMPLATES[chosen];
  const scenicOn = (chosen === "Drive" || chosen === "Ferry") && tpl.scenic;
  const ModeIcon = MODE_ICONS[chosen];

  // When configured and driving, replace the mock duration/distance with a live Routes result.
  const fromC = destinationCoords(from.name);
  const toC = destinationCoords(to.name);
  const live = useLiveDrive(fromC, toC, isMapsConfigured() && chosen === "Drive" && !!fromC && !!toC);
  const durationLabel = live ? formatDuration(live.durationSeconds) : tpl.duration;
  const distanceLabel = live ? formatDistance(live.distanceMeters) : tpl.distance;
  const summaryLabel = `${durationLabel} · ${tpl.cost}${live ? " · live" : ""}`;

  return (
    <div className="flex gap-4" key={dragKey}>
      <div className="flex flex-col items-center shrink-0 w-[38px]">
        <div className="w-0.5 h-2 bg-line" />
        <div className="w-8 h-8 rounded-full bg-white border-[1.5px] border-line grid place-items-center text-accent z-[2]">
          <ModeIcon size={16} strokeWidth={2} />
        </div>
        <div className="flex-1 w-0.5 bg-line min-h-[10px]" />
      </div>
      <div className="flex-1 min-w-0 my-0.5 mb-4 bg-white border border-line rounded-[14px] px-4 py-[15px]">
        {state.routing ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-[15px] h-[15px] border-2 border-line border-t-accent rounded-full vp-spin" />
              <span className="text-[12px] font-semibold text-muted">Finding the best way to travel…</span>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <div className="h-[11px] w-[62%] rounded-md vp-shimmer" />
              <div className="h-[11px] w-[84%] rounded-md vp-shimmer" />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-[11px]">
              <span className="text-accent flex"><Sparkle size={14} strokeWidth={1.8} /></span>
              <span className="text-[11px] font-bold tracking-[.04em] uppercase text-accent">Suggested route</span>
              <div className="flex-1" />
              <span className="text-[11.5px] text-muted whitespace-nowrap overflow-hidden text-ellipsis max-w-[45%]">
                {(from.name || "—")} → {(to.name || "—")}
              </span>
            </div>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <div className="font-display font-bold text-[18px]">{chosen}</div>
              <div className="text-[13.5px] text-muted">{summaryLabel}</div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-[7px] items-center">
              <span className={metaChip}><span className="text-accent flex"><Clock size={14} strokeWidth={2} /></span>{durationLabel}</span>
              <span className={metaChip}><span className="text-accent flex"><CreditCard size={14} strokeWidth={2} /></span>{tpl.cost}</span>
              {distanceLabel && <span className={metaChip}><span className="text-accent flex"><Route size={14} strokeWidth={2} /></span>{distanceLabel}</span>}
              {scenicOn && (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-[5px]">
                  <span className="text-muted text-[11px]">Scenic</span>
                  {[0, 1, 2, 3, 4].map((k) => (
                    <Star key={k} size={12} fill={k < (tpl.scenic || 0) ? "var(--accent)" : "#ddd5c9"} stroke="none" />
                  ))}
                </span>
              )}
            </div>
            <div className="mt-[9px] text-[13px] text-ink leading-[1.5]">{tpl.reason}</div>
            <div className="mt-3 flex gap-1.5 flex-wrap">
              {MODE_ORDER.map((m) => {
                const Icon = MODE_ICONS[m];
                const on = m === chosen;
                return (
                  <button key={m} onClick={() => actions.setTransport(rec.key, m)}
                    className="flex items-center gap-1.5 px-[11px] py-1.5 rounded-[9px] border text-[12px] font-semibold cursor-pointer transition"
                    style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent)" : "#fff", color: on ? "#fff" : "var(--muted)" }}>
                    <Icon size={14} strokeWidth={2} />{m}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DestinationRow({ dest, index, last }: { dest: Destination; index: number; last: boolean }) {
  const { state, actions } = useTrip();
  const n = nightsBetween(dest.arrive, dest.depart);
  const durChip = n == null ? "Add dates" : `${n} night${n !== 1 ? "s" : ""} · ${n + 1} days`;
  const ar = fmtMonthDay(dest.arrive);
  const de = fmtMonthDay(dest.depart);
  const rangeLabel = ar && de ? `${ar} → ${de}` : "Dates not set";
  const accomCountLabel = `${dest.accoms.length} stay${dest.accoms.length !== 1 ? "s" : ""}`;
  const headerMeta = [rangeLabel, n != null ? `${n} night${n !== 1 ? "s" : ""}` : null, accomCountLabel]
    .filter(Boolean)
    .join("  ·  ");
  const booked = dest.accoms.reduce((sum, a) => sum + (nightsBetween(a.checkin, a.checkout) || 0), 0);
  const st = statusFor(n, booked);
  const canSave = !!(dest.name && dest.arrive && dest.depart && n != null);
  const isDrop = state.dragOverId === dest.id && state.dragId != null && state.dragId !== dest.id;
  const draggable = !!(dest.saved && !dest.expanded && state.destinations.length > 1);

  const StatusIcon = st.kind === "ok" ? Check : st.kind === "warn" ? TriangleAlert : Clock;

  return (
    <>
      <div
        data-scroll={`dest-${dest.id}`}
        draggable={draggable}
        onDragStart={actions.onDragStart(dest.id)}
        onDragOver={actions.onDragOver(dest.id)}
        onDrop={actions.onDrop(dest.id)}
        onDragEnd={actions.onDragEnd}
        className="flex gap-4 transition-opacity"
        style={{ opacity: state.dragId === dest.id ? 0.45 : 1 }}
      >
        {/* rail */}
        <div className="flex flex-col items-center shrink-0 w-[38px]">
          <div
            className="w-[38px] h-[38px] rounded-full grid place-items-center font-display font-bold text-[16px] border-2 z-[2] transition-all"
            style={{
              background: dest.saved ? "var(--accent)" : "#fff",
              color: dest.saved ? "#fff" : "var(--accent)",
              borderColor: dest.saved ? "var(--accent)" : "color-mix(in oklab, var(--accent) 55%, transparent)",
              boxShadow: dest.saved ? "0 4px 10px -3px var(--accent)" : "none",
            }}
          >
            {index + 1}
          </div>
          <div className="flex-1 w-0.5 bg-line mt-[5px]" />
        </div>

        {/* card */}
        <div
          className="flex-1 min-w-0 mb-4 bg-white border-[1.5px] rounded-[18px] overflow-hidden transition-all"
          style={{
            borderColor: isDrop
              ? "var(--accent)"
              : dest.saved
                ? "var(--line)"
                : "color-mix(in oklab, var(--accent) 38%, var(--line))",
            boxShadow: "0 6px 22px -12px rgba(0,0,0,.16)",
            transform: isDrop ? "translateY(2px)" : "none",
          }}
        >
          {!dest.saved ? (
            /* EDITING */
            <div className="p-[18px] vp-slide-down">
              <div className="text-[11.5px] font-bold tracking-[.05em] uppercase text-accent">New destination</div>
              <div className="mt-[13px] grid grid-cols-[1.5fr_1fr] gap-3">
                <div>
                  <label className={fieldLabel}>Destination</label>
                  <input value={dest.name} onChange={(e) => actions.updateDest(dest.id, "name", e.target.value)} placeholder="City name" className={fieldInput} />
                </div>
                <div>
                  <label className={fieldLabel}>Country</label>
                  <input value={dest.country} onChange={(e) => actions.updateDest(dest.id, "country", e.target.value)} placeholder="Country" className={fieldInput} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 items-end">
                <div className="flex-[1_1_150px]">
                  <label className={fieldLabel}>Arrival</label>
                  <input type="date" value={dest.arrive} onChange={(e) => actions.updateDest(dest.id, "arrive", e.target.value)}
                    className="w-full mt-1.5 px-3 py-[11px] border border-line rounded-[11px] text-[14px] text-ink bg-white outline-none vp-input" />
                </div>
                <div className="flex-[1_1_150px]">
                  <label className={fieldLabel}>Departure</label>
                  <input type="date" value={dest.depart} onChange={(e) => actions.updateDest(dest.id, "depart", e.target.value)}
                    className="w-full mt-1.5 px-3 py-[11px] border border-line rounded-[11px] text-[14px] text-ink bg-white outline-none vp-input" />
                </div>
                <div className="flex-none flex items-center gap-1.5 h-[42px] px-3.5 bg-tint rounded-[11px] text-[13px] font-bold text-accent">
                  <Clock size={15} strokeWidth={2} />{durChip}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2.5">
                <button onClick={() => canSave && actions.saveDest(dest.id)}
                  className="flex items-center gap-1.5 px-5 py-[11px] border-none rounded-[11px] bg-accent text-white text-[14px] font-bold cursor-pointer hover:brightness-[1.06]"
                  style={{ opacity: canSave ? 1 : 0.5, boxShadow: "0 8px 18px -8px var(--accent)" }}>
                  <Check size={15} strokeWidth={2} />Save destination
                </button>
                <button onClick={() => actions.cancelDest(dest.id)}
                  className="px-4 py-[11px] border border-line rounded-[11px] bg-white text-muted text-[14px] font-semibold cursor-pointer hover:border-ink hover:text-ink">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* SAVED */
            <div>
              <div className="pl-2.5 pr-3 py-[13px] flex items-center gap-2">
                <div title="Drag to reorder" className="w-[26px] h-[34px] grid place-items-center text-[#c4bbb0] cursor-grab hover:text-accent">
                  <GripVertical size={18} fill="currentColor" stroke="none" />
                </div>
                <div onClick={() => actions.toggleDest(dest.id)} className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer select-none">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="font-display font-bold text-[18px] tracking-[-.01em] whitespace-nowrap overflow-hidden text-ellipsis">{dest.name || "New destination"}</span>
                      <span className="text-[13px] text-muted whitespace-nowrap">{dest.country}</span>
                    </div>
                    <div className="text-[12.5px] text-muted mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{headerMeta}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-[5px] rounded-lg text-[11.5px] font-bold" style={{ background: st.bg, color: st.color }}>
                    <StatusIcon size={13} strokeWidth={2} />
                    <span className="whitespace-nowrap">{st.text}</span>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); actions.removeDest(dest.id); }} title="Remove"
                  className="w-[30px] h-[30px] rounded-[9px] border border-line bg-white text-muted grid place-items-center cursor-pointer shrink-0 hover:border-[#d9534f] hover:text-[#d9534f]">
                  <Trash2 size={15} strokeWidth={2} />
                </button>
                <button onClick={() => actions.toggleDest(dest.id)}
                  className="w-[30px] h-[30px] rounded-[9px] border border-line bg-white text-accent grid place-items-center cursor-pointer shrink-0">
                  <span className="flex transition-transform" style={{ transform: dest.expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                    <ChevronDown size={17} strokeWidth={2} />
                  </span>
                </button>
              </div>

              {dest.expanded && (
                <div className="px-[18px] pt-1 pb-[18px] border-t border-line vp-slide-down">
                  <div className="mt-[15px] grid grid-cols-[1.5fr_1fr] gap-3">
                    <div>
                      <label className={fieldLabel}>Destination</label>
                      <input value={dest.name} onChange={(e) => actions.updateDest(dest.id, "name", e.target.value)} placeholder="City name"
                        className="w-full mt-1.5 px-[13px] py-[11px] border border-line rounded-[11px] text-[14.5px] bg-white outline-none vp-input" />
                    </div>
                    <div>
                      <label className={fieldLabel}>Country</label>
                      <input value={dest.country} onChange={(e) => actions.updateDest(dest.id, "country", e.target.value)} placeholder="Country"
                        className="w-full mt-1.5 px-[13px] py-[11px] border border-line rounded-[11px] text-[14.5px] bg-white outline-none vp-input" />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 items-end">
                    <div className="flex-[1_1_150px]">
                      <label className={fieldLabel}>Arrival</label>
                      <input type="date" value={dest.arrive} onChange={(e) => actions.updateDest(dest.id, "arrive", e.target.value)}
                        className="w-full mt-1.5 px-3 py-[11px] border border-line rounded-[11px] text-[14px] text-ink bg-white outline-none vp-input" />
                    </div>
                    <div className="flex-[1_1_150px]">
                      <label className={fieldLabel}>Departure</label>
                      <input type="date" value={dest.depart} onChange={(e) => actions.updateDest(dest.id, "depart", e.target.value)}
                        className="w-full mt-1.5 px-3 py-[11px] border border-line rounded-[11px] text-[14px] text-ink bg-white outline-none vp-input" />
                    </div>
                    <div className="flex-none flex items-center gap-1.5 h-[42px] px-3.5 bg-tint rounded-[11px] text-[13px] font-bold text-accent">
                      <Clock size={15} strokeWidth={2} />{durChip}
                    </div>
                  </div>

                  {st.showVal && (
                    <div className="mt-3.5 flex items-center gap-2 px-3.5 py-[11px] rounded-xl" style={{ background: st.valBg, color: st.valColor }}>
                      <span className="flex shrink-0">{st.valKind === "ok" ? <Check size={16} strokeWidth={2} /> : <TriangleAlert size={16} strokeWidth={2} />}</span>
                      <span className="text-[13px] font-semibold leading-[1.4]">{st.valText}</span>
                    </div>
                  )}

                  <div className="mt-5 flex items-center justify-between">
                    <div className="font-display font-bold text-[15px]">Accommodation</div>
                    <div className="text-[12px] text-muted font-semibold">{accomCountLabel}</div>
                  </div>

                  <div className="mt-[11px] flex flex-col gap-[11px]">
                    {dest.accoms.map((a) => (
                      <AccommodationCard key={a.id} dest={dest} accom={a} />
                    ))}
                  </div>

                  <button onClick={() => actions.addAccom(dest.id)}
                    className="mt-[11px] w-full py-[11px] border-[1.5px] border-dashed border-line rounded-xl bg-transparent text-accent text-[13.5px] font-bold cursor-pointer flex items-center justify-center gap-1.5 hover:border-accent hover:bg-tint">
                    <Plus size={16} strokeWidth={2} />Add accommodation
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!last && dest.saved && (
        <TransportConnectorMaybe from={dest} index={index} />
      )}
    </>
  );
}

function TransportConnectorMaybe({ from, index }: { from: Destination; index: number }) {
  const { state } = useTrip();
  const next = state.destinations[index + 1];
  if (!next || !next.saved) return null;
  return <TransportConnector from={from} to={next} dragKey={`${from.id}-${next.id}`} />;
}

export function RouteBuilder() {
  const { state, actions } = useTrip();
  const dests = state.destinations;
  const lastIdx = dests.length - 1;
  const totalNights = dests.reduce((sum, d) => sum + (nightsBetween(d.arrive, d.depart) || 0), 0);
  const arrives = dests.map((d) => d.arrive).filter(Boolean).sort();
  const departs = dests.map((d) => d.depart).filter(Boolean).sort();
  const spanStart = arrives[0] ? fmtMonthDay(arrives[0]) : null;
  const spanEnd = departs.length ? fmtMonthDay(departs[departs.length - 1]) : null;
  const range = spanStart && spanEnd ? `${spanStart} – ${spanEnd}` : "Set dates";
  const headline = `${dests.length} destination${dests.length !== 1 ? "s" : ""} · ${totalNights} night${totalNights !== 1 ? "s" : ""}`;
  const sub = spanStart && spanEnd ? `${spanStart} – ${spanEnd}` : "Add dates to see your trip span";

  return (
    <MapsApiProvider>
    <div className="vp-scroll min-h-screen relative">
      <div className="max-w-[780px] mx-auto px-[22px] pb-[132px] vp-fade" style={{ paddingTop: "clamp(26px,4vw,46px)" }}>
        {/* brand */}
        <div className="flex items-center gap-2.5 font-semibold tracking-[-.01em]">
          <div className="w-[30px] h-[30px] rounded-[9px] bg-accent text-white grid place-items-center">
            <Compass size={17} strokeWidth={2} />
          </div>
          Wanderfold
        </div>

        {/* steps */}
        <div className="mt-7 flex items-center gap-[9px] text-[12px] font-semibold flex-wrap">
          <span className="flex items-center gap-[7px] text-accent">
            <span className="w-5 h-5 rounded-full bg-accent text-white grid place-items-center text-[11px]">1</span>Route
          </span>
          <span className="w-[22px] h-[1.5px] bg-line" />
          <span className="flex items-center gap-[7px] text-muted">
            <span className="w-5 h-5 rounded-full bg-white border-[1.5px] border-line text-muted grid place-items-center text-[11px]">2</span>Travelers
          </span>
          <span className="w-[22px] h-[1.5px] bg-line" />
          <span className="flex items-center gap-[7px] text-muted">
            <span className="w-5 h-5 rounded-full bg-white border-[1.5px] border-line text-muted grid place-items-center text-[11px]">3</span>Preferences
          </span>
        </div>

        {/* title */}
        <div className="mt-[22px]">
          <div className="font-display font-bold tracking-[-.02em] leading-[1.04]" style={{ fontSize: "clamp(28px,3.8vw,40px)" }}>
            Map out your route.
          </div>
          <p className="text-muted mt-[9px] text-[15px] max-w-[560px] leading-[1.55]">
            Add each place you&apos;ll stay, in order. We&apos;ll suggest how to travel between them — then build your day-by-day plan around the structure you set here.
          </p>
        </div>

        {/* timeline */}
        <div className="mt-7">
          {/* trip overview */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center shrink-0 w-[38px]">
              <div className="w-[38px] h-[38px] rounded-[11px] bg-ink text-white grid place-items-center">
                <Route size={18} strokeWidth={2} />
              </div>
              <div className="flex-1 w-0.5 bg-line mt-[5px]" />
            </div>
            <div className="flex-1 min-w-0 mb-4 border border-line rounded-[18px] px-5 py-[18px]" style={{ background: "linear-gradient(135deg, var(--tint), #fff 70%)" }}>
              <div className="text-[11.5px] font-bold tracking-[.05em] uppercase text-muted">Trip overview</div>
              <div className="mt-3 flex flex-wrap gap-[26px]">
                <div>
                  <div className="font-display font-bold text-[26px] leading-none">{dests.length}</div>
                  <div className="text-[12px] text-muted mt-[3px]">{dests.length === 1 ? "destination" : "destinations"}</div>
                </div>
                <div>
                  <div className="font-display font-bold text-[26px] leading-none">{totalNights}</div>
                  <div className="text-[12px] text-muted mt-[3px]">total nights</div>
                </div>
                <div>
                  <div className="font-bold text-[16px] leading-none mt-[5px]">{range}</div>
                  <div className="text-[12px] text-muted mt-[5px]">trip dates</div>
                </div>
              </div>
              <div className="mt-3.5 flex items-center gap-2 pt-[13px]" style={{ borderTop: "1px solid color-mix(in oklab, var(--accent) 16%, transparent)" }}>
                <span className="text-accent flex"><Sparkle size={16} strokeWidth={1.7} /></span>
                <span className="text-[12.5px] text-ink leading-[1.4]">Once your route is set, our AI builds and optimizes the full day-by-day itinerary.</span>
              </div>
            </div>
          </div>

          {dests.map((d, i) => (
            <DestinationRow key={d.id} dest={d} index={i} last={i === lastIdx} />
          ))}

          {/* add destination */}
          <div className="flex gap-4">
            <div className="w-[38px] shrink-0 flex justify-center">
              <div className="w-[38px] h-[38px] rounded-full grid place-items-center text-accent border-2 border-dashed" style={{ borderColor: "color-mix(in oklab, var(--accent) 45%, transparent)" }}>
                <Plus size={18} strokeWidth={2} />
              </div>
            </div>
            <button onClick={actions.addDest}
              className="flex-1 p-[17px] border-[1.5px] border-dashed rounded-[16px] bg-transparent text-accent text-[15px] font-bold cursor-pointer flex items-center justify-center gap-2 hover:bg-tint hover:border-accent"
              style={{ borderColor: "color-mix(in oklab, var(--accent) 40%, var(--line))" }}>
              <Plus size={16} strokeWidth={2} />Add destination
            </button>
          </div>
        </div>
      </div>

      {/* sticky CTA */}
      <div className="sticky bottom-0 left-0 right-0 border-t border-line px-[22px] py-[13px]" style={{ background: "color-mix(in oklab, var(--bg) 80%, #fff)", backdropFilter: "blur(10px)" }}>
        <div className="max-w-[780px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-bold text-[14px]">{headline}</div>
            <div className="text-[12.5px] text-muted">{sub}</div>
          </div>
          <button onClick={actions.goExplore}
            className="flex items-center gap-2 px-6 py-3.5 border-none rounded-[13px] bg-accent text-white text-[15px] font-bold cursor-pointer hover:brightness-[1.06]"
            style={{ boxShadow: "0 10px 24px -10px var(--accent)" }}>
            Build My Itinerary<ArrowRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
    </MapsApiProvider>
  );
}
