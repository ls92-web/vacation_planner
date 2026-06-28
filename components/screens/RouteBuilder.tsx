"use client";

import { useEffect, useState } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import {
  ACCOM_TYPES,
  MODE_ORDER,
  MODE_TEMPLATES,
  fmtMonthDay,
  nightsBetween,
  recommend,
} from "@/lib/data";
import type { Accommodation, Destination } from "@/lib/types";
import { destinationCoords, isMapsConfigured, useGeocode, type LatLng, type MapMarker } from "@/lib/maps";
import { GoogleMap, MapsApiProvider, DestinationMarkers, OpenInMapsButton } from "@/components/maps";
import { CityImage } from "@/components/destinations/CityImage";
import { useTrip } from "@/lib/store";
import { withSave } from "@/lib/ui/saveStatus";
import { Bed, CloudSun, ExternalLink, PenLine } from "lucide-react";
import {
  ACCOM_ICONS,
  MODE_ICONS,
  ArrowRight,
  Building,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  MapPin,
  Moon,
  Plus,
  Sparkle,
  Star,
  Trash2,
  X,
} from "../icons";

/* ============================ helpers ============================ */

type Status = { kind: "ok" | "warn" | "none"; text: string; color: string; bg: string };
function statusFor(dn: number | null, booked: number): Status {
  if (dn == null) return { kind: "none", text: "Add dates", color: "var(--muted)", bg: "var(--line)" };
  const diff = booked - dn;
  if (diff === 0) return { kind: "ok", text: "Nights set", color: "#0A7A76", bg: "#E4F4F2" };
  if (diff < 0) { const miss = dn - booked; return { kind: "warn", text: `${miss} night${miss !== 1 ? "s" : ""} left`, color: "#9A6512", bg: "#FCEFD6" }; }
  return { kind: "warn", text: `Over by ${diff}`, color: "#9A6512", bg: "#FCEFD6" };
}
const STEPS = ["Route", "Travelers", "Preferences", "Explore", "Build Schedule", "Review", "Export"];
const fieldLabel = "text-[12px] font-semibold text-muted";
const fieldInput = "w-full mt-1.5 px-3 py-2.5 border border-line rounded-[11px] text-[14px] bg-surface outline-none vp-input";

function estBudget(nights: number, travelers: number): number {
  return Math.round((nights * 130 + 60) * Math.max(1, travelers / 2) / 10) * 10;
}

/* ============================ stepper ============================ */

function Stepper() {
  return (
    <div className="vp-scroll flex items-center gap-2 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = i < 0; // only "Route" is active in this stage
        const active = i === 0;
        return (
          <div key={s} className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-full transition" style={{ background: active ? "var(--accent)" : done ? "var(--tint)" : "transparent" }}>
              <span className="w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold" style={{ background: active ? "rgba(255,255,255,.25)" : done ? "var(--accent)" : "var(--line)", color: active ? "#fff" : done ? "#fff" : "var(--muted)" }}>
                {done ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className="text-[12.5px] font-bold whitespace-nowrap" style={{ color: active ? "#fff" : "var(--muted)" }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <span className="w-6 h-[2px] rounded shrink-0" style={{ background: "var(--line)" }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ============================ overview + ring ============================ */

function ProgressRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value / 100));
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
      <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display font-bold text-[18px]">{value}<span className="text-[11px] text-muted">%</span></span>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="font-display font-bold text-[22px] leading-none">{value}</div>
      <div className="text-[11.5px] text-muted mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-muted/80">{sub}</div>}
    </div>
  );
}

function TripOverview() {
  const { state } = useTrip();
  const dests = state.destinations;
  const saved = dests.filter((d) => d.saved);
  const totalNights = dests.reduce((s, d) => s + (nightsBetween(d.arrive, d.depart) || 0), 0);
  const hotels = dests.reduce((s, d) => s + d.accoms.length, 0);
  const travelers = state.adults + state.kids;
  const arrives = dests.map((d) => d.arrive).filter(Boolean).sort();
  const departs = dests.map((d) => d.depart).filter(Boolean).sort();
  const span = arrives[0] && departs.length ? `${fmtMonthDay(arrives[0])} – ${fmtMonthDay(departs[departs.length - 1])}` : "Set dates";
  const budget = estBudget(totalNights, travelers);

  // completion: dates + accommodation coverage across saved destinations
  let completion = 0;
  if (dests.length) {
    let pts = 0;
    const max = dests.length * 3;
    for (const d of dests) {
      if (d.saved) pts += 1;
      if (d.arrive && d.depart) pts += 1;
      if (d.accoms.some((a) => a.name)) pts += 1;
    }
    completion = Math.round((pts / max) * 100);
  }

  return (
    <div className="rounded-[20px] border border-line p-5" style={{ background: "var(--tint)" }}>
      <div className="flex items-center gap-5 flex-wrap">
        <ProgressRing value={completion} />
        <div className="min-w-0">
          <div className="text-[11.5px] font-bold uppercase tracking-[.06em] text-muted">Trip overview</div>
          <div className="font-display font-bold text-[20px] tracking-[-.01em] mt-0.5">{state.dest.split(",")[0]}</div>
          <div className="text-[12.5px] text-muted">{span} · {travelers} traveler{travelers !== 1 ? "s" : ""}</div>
        </div>
        <div className="flex-1" />
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-6 gap-y-4">
          <Stat label="Destinations" value={String(dests.length)} />
          <Stat label="Nights" value={String(totalNights)} />
          <Stat label="Hotels" value={String(hotels)} />
          <Stat label="Travelers" value={String(travelers)} />
          <Stat label="Est. budget" value={`€${budget}`} />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t flex items-center gap-2" style={{ borderColor: "color-mix(in oklab, var(--accent) 16%, transparent)" }}>
        <Sparkle size={15} strokeWidth={1.7} className="text-accent shrink-0" />
        <span className="text-[12.5px] text-ink leading-snug">
          {saved.length < dests.length ? "Finish your destinations, then the AI builds an optimized day-by-day plan." : "Route ready — continue to Explore to add places and let the AI build your schedule."}
        </span>
      </div>
    </div>
  );
}

/* ============================ accommodation ============================ */

const metaChip = "inline-flex items-center gap-1.5 text-[12px] font-semibold bg-tint text-ink px-2.5 py-[5px] rounded-lg";

function AccommodationCard({ dest, accom }: { dest: Destination; accom: Accommodation }) {
  const { actions } = useTrip();
  const an = nightsBetween(accom.checkin, accom.checkout);
  const [editingLoc, setEditingLoc] = useState(false);
  const rawLoc = (accom.locationUrl ?? "").trim();
  const locHref = rawLoc && !/^https?:\/\//i.test(rawLoc) ? `https://${rawLoc}` : rawLoc;
  const locLooksValid = /^(https?:\/\/)?[^\s.]+\.[^\s]+/i.test(rawLoc);
  return (
    <div className="bg-[color:color-mix(in_oklab,var(--surface)_94%,var(--bg))] border border-line rounded-[14px] p-3.5 vp-slide-up">
      <div className="flex items-center gap-1.5 flex-wrap">
        {ACCOM_TYPES.map((ty) => {
          const Icon = ACCOM_ICONS[ty.k];
          const on = accom.type === ty.k;
          return (
            <button key={ty.k} onClick={() => actions.setAccomType(dest.id, accom.id, ty.k)} className="flex items-center gap-1.5 px-[11px] py-1.5 rounded-[9px] border text-[12.5px] font-semibold cursor-pointer transition" style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent)" : "var(--surface)", color: on ? "#fff" : "var(--muted)" }}>
              <Icon size={14} strokeWidth={2} />{ty.k}
            </button>
          );
        })}
        <div className="flex-1" />
        <button onClick={(e) => { e.stopPropagation(); actions.removeAccom(dest.id, accom.id); }} title="Remove stay" className="w-7 h-7 rounded-lg border border-line bg-surface text-muted grid place-items-center cursor-pointer hover:border-[#d9534f] hover:text-[#d9534f]"><X size={13} strokeWidth={2} /></button>
      </div>
      <input value={accom.name} onChange={(e) => actions.updateAccom(dest.id, accom.id, "name", e.target.value)} placeholder="Property name — e.g. Hotel Casa Bonay" className="w-full mt-[11px] px-[13px] py-[11px] border border-line rounded-[10px] text-[14px] font-semibold bg-surface outline-none vp-input" />
      <div className="mt-2.5 flex flex-wrap gap-2.5 items-end">
        <div className="flex-[1_1_135px]">
          <label className="text-[11.5px] font-semibold text-muted">Check-in</label>
          <input type="date" value={accom.checkin} onChange={(e) => actions.updateAccom(dest.id, accom.id, "checkin", e.target.value)} className="w-full mt-[5px] px-[11px] py-2.5 border border-line rounded-[10px] text-[13.5px] text-ink bg-surface outline-none vp-input" />
        </div>
        <div className="flex-[1_1_135px]">
          <label className="text-[11.5px] font-semibold text-muted">Check-out</label>
          <input type="date" value={accom.checkout} onChange={(e) => actions.updateAccom(dest.id, accom.id, "checkout", e.target.value)} className="w-full mt-[5px] px-[11px] py-2.5 border border-line rounded-[10px] text-[13.5px] text-ink bg-surface outline-none vp-input" />
        </div>
        <div className="flex-none flex items-center gap-1.5 h-[39px] px-3 bg-surface border border-line rounded-[10px] text-[12.5px] font-bold text-ink">
          <span className="text-accent flex"><Moon size={14} strokeWidth={2} /></span>{an == null ? "—" : `${an} night${an !== 1 ? "s" : ""}`}
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {isMapsConfigured() && accom.address && (
          <OpenInMapsButton href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(accom.address)}`} label="Open in Google Maps" size="sm" />
        )}
        {!editingLoc && rawLoc && (
          <>
            <a href={locHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-line bg-surface text-[12.5px] font-semibold text-accent cursor-pointer hover:border-accent">
              <MapPin size={14} strokeWidth={2} />Open location<ExternalLink size={12} strokeWidth={2} />
            </a>
            <button onClick={() => setEditingLoc(true)} title="Edit location link" className="w-8 h-8 rounded-[10px] border border-line bg-surface text-muted grid place-items-center cursor-pointer hover:text-ink"><PenLine size={13} strokeWidth={2} /></button>
          </>
        )}
        {!editingLoc && !rawLoc && (
          <button onClick={() => setEditingLoc(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-dashed border-line bg-surface text-[12.5px] font-semibold text-muted cursor-pointer hover:border-accent hover:text-accent">
            <MapPin size={14} strokeWidth={2} />Add location
          </button>
        )}
      </div>
      {editingLoc && (
        <div className="mt-2.5 vp-slide-down">
          <label className="text-[11.5px] font-semibold text-muted">Location link <span className="font-normal">(optional)</span></label>
          <div className="flex gap-2 mt-1">
            <input
              value={accom.locationUrl ?? ""}
              onChange={(e) => actions.updateAccom(dest.id, accom.id, "locationUrl", e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditingLoc(false); } }}
              placeholder="Paste a Google Maps or booking link"
              className="flex-1 px-[13px] py-2.5 border border-line rounded-[10px] text-[13.5px] bg-surface outline-none vp-input"
              autoFocus
            />
            <button onClick={() => setEditingLoc(false)} className="px-3.5 py-2.5 rounded-[10px] bg-accent text-white text-[13px] font-bold cursor-pointer hover:brightness-[1.06]">Done</button>
            {rawLoc && <button onClick={() => { actions.updateAccom(dest.id, accom.id, "locationUrl", ""); setEditingLoc(false); }} title="Remove link" className="px-3 py-2.5 rounded-[10px] border border-line text-muted text-[13px] font-semibold cursor-pointer hover:text-[#9A6512] hover:border-[#9A6512]">Remove</button>}
          </div>
          {rawLoc && !locLooksValid && <p className="text-[11.5px] mt-1" style={{ color: "#9A6512" }}>Enter a full link, e.g. https://maps.google.com/…</p>}
          <p className="text-[11.5px] text-muted mt-1">Paste a map pin or booking link you can open later to reach this stay.</p>
        </div>
      )}
    </div>
  );
}

/* ============================ transport connector ============================ */

function TransportConnector({ from, to }: { from: Destination; to: Destination }) {
  const { state, actions } = useTrip();
  const rec = recommend(from, to);
  const chosen = state.transports[rec.key] || rec.recMode;
  const tpl = rec.override && rec.override.mode === chosen ? rec.override : MODE_TEMPLATES[chosen];
  const scenicOn = (chosen === "Drive" || chosen === "Ferry") && tpl.scenic;
  const ModeIcon = MODE_ICONS[chosen];
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0 w-[38px]">
        <div className="w-0.5 h-2 bg-line" />
        <div className="w-8 h-8 rounded-full bg-surface border-[1.5px] border-line grid place-items-center text-accent z-[2]"><ModeIcon size={16} strokeWidth={2} /></div>
        <div className="flex-1 w-0.5 bg-line min-h-[10px]" />
      </div>
      <div className="flex-1 min-w-0 my-0.5 mb-4 bg-surface border border-line rounded-[14px] px-4 py-[13px]">
        {state.routing ? (
          <div className="flex items-center gap-2"><div className="w-[15px] h-[15px] border-2 border-line border-t-accent rounded-full vp-spin" /><span className="text-[12px] font-semibold text-muted">Finding the best way to travel…</span></div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2"><span className="text-accent flex"><Sparkle size={14} strokeWidth={1.8} /></span><span className="text-[11px] font-bold tracking-[.04em] uppercase text-accent">Suggested route</span></div>
            <div className="flex items-baseline gap-2.5 flex-wrap"><div className="font-display font-bold text-[18px]">{chosen}</div><div className="text-[13.5px] text-muted">{tpl.duration} · {tpl.cost}</div></div>
            <div className="mt-2.5 flex flex-wrap gap-[7px] items-center">
              <span className={metaChip}><Clock size={13} strokeWidth={2} className="text-accent" />{tpl.duration}</span>
              <span className={metaChip}><CreditCard size={13} strokeWidth={2} className="text-accent" />{tpl.cost}</span>
              {scenicOn && <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-[5px]"><span className="text-muted text-[11px]">Scenic</span>{[0, 1, 2, 3, 4].map((k) => <Star key={k} size={12} fill={k < (tpl.scenic || 0) ? "var(--accent)" : "#ddd5c9"} stroke="none" />)}</span>}
            </div>
            <div className="mt-3 flex gap-1.5 flex-wrap">
              {MODE_ORDER.map((m) => { const Icon = MODE_ICONS[m]; const on = m === chosen; return (
                <button key={m} onClick={() => actions.setTransport(rec.key, m)} className="flex items-center gap-1.5 px-[11px] py-1.5 rounded-[9px] border text-[12px] font-semibold cursor-pointer transition" style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent)" : "var(--surface)", color: on ? "#fff" : "var(--muted)" }}><Icon size={14} strokeWidth={2} />{m}</button>
              ); })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================ destination card ============================ */

function DestinationCard({ dest, index, last }: { dest: Destination; index: number; last: boolean }) {
  const { state, actions } = useTrip();
  const n = nightsBetween(dest.arrive, dest.depart);
  const durChip = n == null ? "Add dates" : `${n} night${n !== 1 ? "s" : ""} · ${n + 1} days`;
  const ar = fmtMonthDay(dest.arrive);
  const de = fmtMonthDay(dest.depart);
  const booked = dest.accoms.reduce((s, a) => s + (nightsBetween(a.checkin, a.checkout) || 0), 0);
  const st = statusFor(n, booked);
  const canSave = !!(dest.name && dest.arrive && dest.depart && n != null);
  const budget = estBudget(n || 0, state.adults + state.kids);

  return (
    <>
      <div className="flex gap-4">
        {/* rail node */}
        <div className="flex flex-col items-center shrink-0 w-[38px]">
          <div className="w-[38px] h-[38px] rounded-full grid place-items-center font-display font-bold text-[16px] border-2 z-[2] transition-all" style={{ background: dest.saved ? "var(--accent)" : "var(--surface)", color: dest.saved ? "#fff" : "var(--accent)", borderColor: dest.saved ? "var(--accent)" : "color-mix(in oklab, var(--accent) 55%, transparent)", boxShadow: dest.saved ? "0 4px 10px -3px var(--accent)" : "none" }}>{index + 1}</div>
          <div className="flex-1 w-0.5 bg-line mt-[5px]" />
        </div>

        {/* card */}
        <div className="flex-1 min-w-0 mb-4 bg-surface border border-line rounded-[18px] overflow-hidden transition-all hover:shadow-[0_14px_32px_-18px_rgba(0,0,0,.3)]" style={{ boxShadow: "0 6px 22px -14px rgba(0,0,0,.16)" }}>
          {!dest.saved ? (
            /* editing */
            <div className="p-[18px] vp-slide-down">
              <div className="text-[11.5px] font-bold tracking-[.05em] uppercase text-accent">New destination</div>
              <div className="mt-3 grid grid-cols-[1.5fr_1fr] gap-3">
                <div><label className={fieldLabel}>Destination</label><input value={dest.name} onChange={(e) => actions.updateDest(dest.id, "name", e.target.value)} placeholder="City name" className={fieldInput} /></div>
                <div><label className={fieldLabel}>Country</label><input value={dest.country} onChange={(e) => actions.updateDest(dest.id, "country", e.target.value)} placeholder="Country" className={fieldInput} /></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 items-end">
                <div className="flex-[1_1_150px]"><label className={fieldLabel}>Arrival</label><input type="date" value={dest.arrive} onChange={(e) => actions.updateDest(dest.id, "arrive", e.target.value)} className={fieldInput} /></div>
                <div className="flex-[1_1_150px]"><label className={fieldLabel}>Departure</label><input type="date" value={dest.depart} onChange={(e) => actions.updateDest(dest.id, "depart", e.target.value)} className={fieldInput} /></div>
                <div className="flex-none flex items-center gap-1.5 h-[42px] px-3.5 bg-tint rounded-[11px] text-[13px] font-bold text-accent"><Clock size={15} strokeWidth={2} />{durChip}</div>
              </div>
              <div className="mt-4 flex items-center gap-2.5">
                <button onClick={() => canSave && actions.saveDest(dest.id)} className="flex items-center gap-1.5 px-5 py-[11px] border-none rounded-[11px] bg-accent text-white text-[14px] font-bold cursor-pointer hover:brightness-[1.06]" style={{ opacity: canSave ? 1 : 0.5, boxShadow: "0 8px 18px -8px var(--accent)" }}><Check size={15} strokeWidth={2} />Save destination</button>
                <button onClick={() => actions.cancelDest(dest.id)} className="px-4 py-[11px] border border-line rounded-[11px] bg-surface text-muted text-[14px] font-semibold cursor-pointer hover:border-ink hover:text-ink">Cancel</button>
              </div>
            </div>
          ) : (
            /* saved — premium card */
            <div>
              {/* hero header */}
              <button onClick={() => actions.toggleDest(dest.id)} className="w-full text-left relative h-[140px] block cursor-pointer overflow-hidden">
                <CityImage name={dest.name} country={dest.country} image={dest.image ?? undefined} className="absolute inset-0 h-full w-full" />
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-bold" style={{ background: st.bg, color: st.color }}>
                  {st.kind === "ok" ? <Check size={12} strokeWidth={2.5} /> : null}{st.text}
                </div>
                <div className="absolute bottom-3 left-4 right-4 z-10 text-white">
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display font-bold text-[22px] leading-tight truncate" style={{ textShadow: "0 1px 8px rgba(0,0,0,.35)" }}>{dest.name || "New destination"}</div>
                      <div className="flex items-center gap-1.5 text-[12.5px] text-white/90" style={{ textShadow: "0 1px 6px rgba(0,0,0,.4)" }}><MapPin size={12} strokeWidth={2} />{dest.country || "—"}{ar && de ? ` · ${ar} → ${de}` : ""}</div>
                    </div>
                    <span className="flex transition-transform shrink-0" style={{ transform: dest.expanded ? "rotate(180deg)" : "none" }}><ChevronDown size={20} strokeWidth={2} /></span>
                  </div>
                </div>
              </button>

              {/* badges */}
              <div className="px-4 py-3 flex items-center gap-2 flex-wrap border-b border-line">
                <span className={metaChip}><Moon size={13} strokeWidth={2} className="text-accent" />{n ?? 0} night{n !== 1 ? "s" : ""}</span>
                <span className={metaChip}><Building size={13} strokeWidth={2} className="text-accent" />{dest.accoms.length} hotel{dest.accoms.length !== 1 ? "s" : ""}</span>
                <span className={metaChip}><CreditCard size={13} strokeWidth={2} className="text-accent" />~€{budget}</span>
                <span className={metaChip}><CloudSun size={13} strokeWidth={2} className="text-accent" />Weather —</span>
                <span className={metaChip}><Star size={13} strokeWidth={2} className="text-accent" />0 activities</span>
                <div className="flex-1" />
                <button onClick={(e) => { e.stopPropagation(); actions.removeDest(dest.id); }} title="Remove" className="w-[30px] h-[30px] rounded-[9px] border border-line bg-surface text-muted grid place-items-center cursor-pointer hover:border-[#d9534f] hover:text-[#d9534f]"><Trash2 size={15} strokeWidth={2} /></button>
              </div>

              {/* expanded */}
              {dest.expanded && (
                <div className="px-[18px] py-[18px] vp-slide-down">
                  <div className="grid grid-cols-[1.5fr_1fr] gap-3">
                    <div><label className={fieldLabel}>Destination</label><input value={dest.name} onChange={(e) => actions.updateDest(dest.id, "name", e.target.value)} className={fieldInput} /></div>
                    <div><label className={fieldLabel}>Country</label><input value={dest.country} onChange={(e) => actions.updateDest(dest.id, "country", e.target.value)} className={fieldInput} /></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 items-end">
                    <div className="flex-[1_1_150px]"><label className={fieldLabel}>Arrival</label><input type="date" value={dest.arrive} onChange={(e) => actions.updateDest(dest.id, "arrive", e.target.value)} className={fieldInput} /></div>
                    <div className="flex-[1_1_150px]"><label className={fieldLabel}>Departure</label><input type="date" value={dest.depart} onChange={(e) => actions.updateDest(dest.id, "depart", e.target.value)} className={fieldInput} /></div>
                    <div className="flex-none flex items-center gap-1.5 h-[42px] px-3.5 bg-tint rounded-[11px] text-[13px] font-bold text-accent"><Clock size={15} strokeWidth={2} />{durChip}</div>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <div className="font-display font-bold text-[15px]">Accommodation</div>
                    <div className="text-[12px] text-muted font-semibold">{dest.accoms.length} stay{dest.accoms.length !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="mt-[11px] flex flex-col gap-[11px]">
                    {dest.accoms.map((a) => <AccommodationCard key={a.id} dest={dest} accom={a} />)}
                  </div>
                  <button onClick={() => actions.addAccom(dest.id)} className="mt-[11px] w-full py-[11px] border-[1.5px] border-dashed border-line rounded-xl bg-transparent text-accent text-[13.5px] font-bold cursor-pointer flex items-center justify-center gap-1.5 hover:border-accent hover:bg-tint"><Plus size={16} strokeWidth={2} />Add accommodation</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!last && dest.saved && <TransportConnectorMaybe from={dest} index={index} />}
    </>
  );
}

function TransportConnectorMaybe({ from, index }: { from: Destination; index: number }) {
  const { state } = useTrip();
  const next = state.destinations[index + 1];
  if (!next || !next.saved) return null;
  return <TransportConnector from={from} to={next} />;
}

/* ============================ right panel: map + AI ============================ */

function RouteLine({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length < 2 || typeof google === "undefined") return;
    const line = new google.maps.Polyline({ path: points, geodesic: true, strokeColor: "#0EA5A0", strokeOpacity: 0.85, strokeWeight: 3 });
    line.setMap(map);
    const b = new google.maps.LatLngBounds();
    points.forEach((p) => b.extend(p));
    map.fitBounds(b, 60);
    return () => line.setMap(null);
  }, [map, points]);
  return null;
}

function RoutePanel() {
  const { state } = useTrip();
  const geocode = useGeocode();
  const [coords, setCoords] = useState<Record<number, LatLng>>({});

  // resolve coords for each destination (known or geocoded)
  const savedDests = state.destinations.filter((d) => d.saved && d.name);
  const key = savedDests.map((d) => `${d.name}:${d.lat ?? ""},${d.lng ?? ""}`).join("|");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<number, LatLng> = {};
      for (const d of savedDests) {
        // Prefer real coordinates captured when the city was picked.
        if (typeof d.lat === "number" && typeof d.lng === "number" && (d.lat !== 0 || d.lng !== 0)) {
          out[d.id] = { lat: d.lat, lng: d.lng };
          continue;
        }
        const known = destinationCoords(d.name);
        if (known) out[d.id] = known;
        else {
          const loc = await geocode(`${d.name}, ${d.country}`);
          if (loc) out[d.id] = loc;
        }
      }
      if (!cancelled) setCoords(out);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const markers: MapMarker[] = savedDests.filter((d) => coords[d.id]).map((d, i) => ({ id: String(d.id), name: d.name, kind: "destination", position: coords[d.id], subtitle: `Stop ${i + 1}`, category: d.country }));
  const points = markers.map((m) => m.position);
  const center = points[0] ?? destinationCoords(state.dest.split(",")[0]) ?? { lat: 41.3874, lng: 2.1686 };

  // AI suggestions (distance-based heuristics)
  const suggestions: { title: string; detail: string }[] = [];
  if (markers.length >= 2) {
    const haversine = (a: LatLng, b: LatLng) => { const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180, la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180; const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2); return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))); };
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) total += haversine(points[i], points[i + 1]);
    suggestions.push({ title: "Route looks efficient", detail: `About ${Math.round(total)} km across ${markers.length} stops — a sensible loop.` });
    if (total > 600) suggestions.push({ title: "Long total distance", detail: "Consider a flight for the longest leg to save driving hours." });
  }
  suggestions.push({ title: "Add places in Explore", detail: "Once your route is set, browse attractions and the AI builds the daily schedule." });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[18px] border border-line overflow-hidden">
        <div className="relative h-[300px]">
          <MapsApiProvider>
            <GoogleMap center={center} zoom={6} className="absolute inset-0 h-full w-full" fallback={<div className="absolute inset-0 grid place-items-center bg-[#eef3ec] text-muted text-[13px] px-6 text-center">Add a Maps key to preview your route.</div>}>
              <DestinationMarkers markers={markers} />
              <RouteLine points={points} />
            </GoogleMap>
          </MapsApiProvider>
        </div>
      </div>

      <div className="rounded-[18px] border border-line bg-surface p-4">
        <div className="flex items-center gap-1.5 font-display font-bold text-[15px]"><Sparkle size={16} strokeWidth={1.7} className="text-accent" />AI travel suggestions</div>
        <div className="mt-3 flex flex-col gap-2">
          {suggestions.map((s, i) => (
            <div key={i} className="rounded-xl bg-tint px-3 py-2.5 vp-slide-up">
              <div className="flex items-start gap-2">
                <Check size={14} strokeWidth={2.5} className="text-accent shrink-0 mt-0.5" />
                <div>
                  <div className="text-[12.5px] font-semibold text-ink">{s.title}</div>
                  <div className="text-[12px] text-muted leading-snug mt-0.5">{s.detail}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================ empty state ============================ */

function EmptyState() {
  const { actions } = useTrip();
  return (
    <div className="rounded-[22px] border-2 border-dashed border-line py-16 px-6 text-center">
      <div className="w-16 h-16 mx-auto rounded-[20px] bg-tint text-accent grid place-items-center"><MapPin size={28} strokeWidth={1.8} /></div>
      <div className="font-display font-bold text-[22px] tracking-[-.01em] mt-5">Start building your dream journey.</div>
      <p className="text-muted text-[14px] mt-2 max-w-[420px] mx-auto">Add your first destination — city, dates and where you&apos;re staying. We&apos;ll suggest how to travel between stops and build the schedule.</p>
      <button onClick={actions.addDest} className="mt-6 inline-flex items-center gap-2 px-6 py-3.5 rounded-[14px] bg-accent text-white text-[15px] font-bold cursor-pointer hover:brightness-[1.06]" style={{ boxShadow: "0 10px 24px -10px var(--accent)" }}><Plus size={18} strokeWidth={2} />Add your first destination</button>
    </div>
  );
}

/* ============================ floating action bar ============================ */

function FloatingActionBar() {
  const { state, actions } = useTrip();
  const totalNights = state.destinations.reduce((s, d) => s + (nightsBetween(d.arrive, d.depart) || 0), 0);
  return (
    <div className="sticky bottom-4 z-30 mt-4">
      <div className="mx-auto max-w-[1100px] rounded-[16px] border border-line p-2.5 flex items-center gap-2 flex-wrap" style={{ background: "color-mix(in oklab, var(--surface) 80%, var(--bg))", backdropFilter: "blur(12px)", boxShadow: "0 16px 40px -18px rgba(0,0,0,.35)" }}>
        <button onClick={actions.addDest} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[11px] border border-line bg-surface text-ink text-[13.5px] font-bold cursor-pointer hover:border-accent hover:text-accent"><Plus size={16} strokeWidth={2} />Add destination</button>
        <button onClick={() => { const d = state.destinations.find((x) => x.expanded && x.saved); if (d) actions.addAccom(d.id); else actions.flash("Open a destination to add a hotel."); }} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[11px] border border-line bg-surface text-ink text-[13.5px] font-bold cursor-pointer hover:border-accent hover:text-accent"><Bed size={16} strokeWidth={2} />Add hotel</button>
        <div className="flex-1 min-w-0 text-[12.5px] text-muted px-2 hidden sm:block">{state.destinations.length} destination{state.destinations.length !== 1 ? "s" : ""} · {totalNights} night{totalNights !== 1 ? "s" : ""}</div>
        <button onClick={() => withSave(Promise.resolve())} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[11px] border border-line bg-surface text-ink text-[13.5px] font-bold cursor-pointer hover:border-accent hover:text-accent"><Check size={16} strokeWidth={2} />Save</button>
        <button onClick={() => actions.goExplore()} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[11px] bg-accent text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06]" style={{ boxShadow: "0 8px 20px -10px var(--accent)" }}>Continue<ArrowRight size={16} strokeWidth={2} /></button>
      </div>
    </div>
  );
}

/* ============================ page ============================ */

export function RouteBuilder() {
  const { state } = useTrip();
  const [panelOpen, setPanelOpen] = useState(true);
  const dests = state.destinations;
  const lastIdx = dests.length - 1;

  return (
    <div className="vp-scroll min-h-full">
      <div className="max-w-[1320px] mx-auto px-[clamp(16px,3vw,32px)] py-6">
        {/* title + stepper */}
        <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="font-display font-bold text-[clamp(24px,3vw,32px)] tracking-[-.02em]">Plan your route</div>
            <p className="text-muted text-[14px] mt-1">Add each place you&apos;ll stay, in order — we&apos;ll handle travel between them.</p>
          </div>
          <button onClick={() => setPanelOpen((o) => !o)} className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-line bg-surface text-[12.5px] font-bold text-muted cursor-pointer hover:text-ink">
            <MapPin size={14} strokeWidth={2} />{panelOpen ? "Hide map" : "Show map"}
          </button>
        </div>
        <div className="mb-6"><Stepper /></div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* main */}
          <div className="flex-1 min-w-0">
            <TripOverview />
            <div className="mt-6">
              {dests.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  {dests.map((d, i) => <DestinationCard key={d.id} dest={d} index={i} last={i === lastIdx} />)}
                  <div className="flex gap-4">
                    <div className="w-[38px] shrink-0 flex justify-center">
                      <div className="w-[38px] h-[38px] rounded-full grid place-items-center text-accent border-2 border-dashed" style={{ borderColor: "color-mix(in oklab, var(--accent) 45%, transparent)" }}><Plus size={18} strokeWidth={2} /></div>
                    </div>
                    <AddDestinationButton />
                  </div>
                </>
              )}
            </div>
            <FloatingActionBar />
          </div>

          {/* right panel */}
          {panelOpen && (
            <aside className="lg:w-[380px] shrink-0">
              <div className="lg:sticky lg:top-[76px]">
                <RoutePanel />
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function AddDestinationButton() {
  const { actions } = useTrip();
  return (
    <button onClick={actions.addDest} className="flex-1 p-[17px] border-[1.5px] border-dashed rounded-[16px] bg-transparent text-accent text-[15px] font-bold cursor-pointer flex items-center justify-center gap-2 hover:bg-tint hover:border-accent" style={{ borderColor: "color-mix(in oklab, var(--accent) 40%, var(--line))" }}>
      <Plus size={16} strokeWidth={2} />Add destination
    </button>
  );
}
