"use client";

import { useEffect, useRef, useState } from "react";
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
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { CityImage } from "@/components/destinations/CityImage";
import { BudgetPanel } from "@/components/destinations/BudgetPanel";
import { WeatherPanel } from "@/components/destinations/WeatherPanel";
import { useTrip } from "@/lib/store";
import { useTrips } from "@/lib/trips/store";
import { useAuth } from "@/lib/auth/store";
import { saveTrip } from "@/lib/destinations/repository";
import { withSave } from "@/lib/ui/saveStatus";
import { addBreakdowns, computeBudget, convertCostText, formatMoney, EMPTY_BREAKDOWN, BUDGET_LEVELS } from "@/lib/budget/estimate";
import { useCurrency } from "@/lib/budget/useCurrency";
import { useWeather } from "@/lib/weather/client";
import { describeWeather } from "@/lib/weather/codes";
import { Bed, Cloud, ExternalLink, Loader2, PenLine, RefreshCw, TriangleAlert, Wallet } from "lucide-react";
import { useTripLoader } from "@/lib/trips/useTripLoader";
import { generateTripSuggestions, type SuggestionType } from "@/lib/planner/suggestions";
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

const BUDGET_CATS: { key: "hotels" | "activities" | "food" | "transport"; label: string }[] = [
  { key: "hotels", label: "Hotels" },
  { key: "activities", label: "Activities" },
  { key: "food", label: "Food" },
  { key: "transport", label: "Transport" },
];

function TripOverview() {
  const { state, actions } = useTrip();
  const auth = useAuth();
  const currency = useCurrency();
  // Whether this summary is included in the exported PDF (persisted per account).
  const includeInExport = auth.state.preferences?.export_include_overview ?? true;
  const [saving, setSaving] = useState(false);
  const toggleExport = async () => {
    if (saving) return;
    setSaving(true);
    try { await auth.actions.updatePreferences({ export_include_overview: !includeInExport }); }
    finally { setSaving(false); }
  };
  const dests = state.destinations;
  const saved = dests.filter((d) => d.saved);
  const totalNights = dests.reduce((s, d) => s + (nightsBetween(d.arrive, d.depart) || 0), 0);
  const hotels = dests.reduce((s, d) => s + d.accoms.length, 0);
  const travelers = state.adults + state.kids;
  const arrives = dests.map((d) => d.arrive).filter(Boolean).sort();
  const departs = dests.map((d) => d.depart).filter(Boolean).sort();
  const span = arrives[0] && departs.length ? `${fmtMonthDay(arrives[0])} – ${fmtMonthDay(departs[departs.length - 1])}` : "Set dates";

  // aggregate budget breakdown (per-destination overrides respected in the total)
  let agg = EMPTY_BREAKDOWN;
  let budgetTotal = 0;
  for (const d of dests) {
    const b = computeBudget({ travelers, nights: nightsBetween(d.arrive, d.depart) || 0, hotels: d.accoms.length, level: state.budgetLevel });
    agg = addBreakdowns(agg, b);
    budgetTotal += typeof d.budgetOverride === "number" ? d.budgetOverride : b.total;
  }

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
          <Stat label="Est. budget" value={formatMoney(budgetTotal, currency)} />
        </div>
      </div>

      {/* estimated budget breakdown + level */}
      <div className="mt-4 pt-4 border-t" style={{ borderColor: "color-mix(in oklab, var(--accent) 16%, transparent)" }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[11.5px] font-bold uppercase tracking-[.06em] text-muted flex items-center gap-1.5"><Wallet size={13} strokeWidth={2} className="text-accent" />Estimated budget</div>
          <div className="flex items-center gap-1 p-0.5 rounded-[10px] bg-surface border border-line">
            {BUDGET_LEVELS.map((l) => {
              const on = l.key === state.budgetLevel;
              return (
                <button key={l.key} onClick={() => actions.setBudgetLevel(l.key)} title={l.hint} className="px-2.5 py-1 rounded-[8px] text-[11.5px] font-bold cursor-pointer transition" style={{ background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--muted)" }}>{l.label}</button>
              );
            })}
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {BUDGET_CATS.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-surface border border-line text-[12px] text-ink"><span className="text-muted">{c.label}</span><span className="font-bold tabular-nums">{formatMoney(agg[c.key], currency)}</span></span>
          ))}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-accent text-white text-[12px] font-bold tabular-nums">Total {formatMoney(budgetTotal, currency)}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t flex items-center gap-2" style={{ borderColor: "color-mix(in oklab, var(--accent) 16%, transparent)" }}>
        <Sparkle size={15} strokeWidth={1.7} className="text-accent shrink-0" />
        <span className="text-[12.5px] text-ink leading-snug">
          {saved.length < dests.length ? "Finish your destinations, then the AI builds an optimized day-by-day plan." : "Route ready — continue to Explore to add places and let the AI build your schedule."}
        </span>
      </div>

      <div className="mt-4 pt-4 border-t" style={{ borderColor: "color-mix(in oklab, var(--accent) 16%, transparent)" }}>
        <button
          type="button"
          onClick={toggleExport}
          disabled={saving}
          aria-pressed={includeInExport}
          className="flex items-center gap-2.5 text-left cursor-pointer disabled:opacity-60 group"
        >
          <span
            className="w-[20px] h-[20px] rounded-[6px] grid place-items-center shrink-0 border-[1.5px] transition"
            style={{ background: includeInExport ? "var(--accent)" : "var(--surface)", borderColor: includeInExport ? "var(--accent)" : "var(--line)" }}
          >
            {includeInExport && <Check size={13} strokeWidth={3} className="text-white" />}
          </span>
          <span className="text-[12.5px] text-ink leading-snug group-hover:text-accent">
            Include this summary in the exported PDF
          </span>
        </button>
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
  const currency = useCurrency();
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
            <div className="flex items-baseline gap-2.5 flex-wrap"><div className="font-display font-bold text-[18px]">{chosen}</div><div className="text-[13.5px] text-muted">{tpl.duration} · {convertCostText(tpl.cost, currency)}</div></div>
            <div className="mt-2.5 flex flex-wrap gap-[7px] items-center">
              <span className={metaChip}><Clock size={13} strokeWidth={2} className="text-accent" />{tpl.duration}</span>
              <span className={metaChip}><CreditCard size={13} strokeWidth={2} className="text-accent" />{convertCostText(tpl.cost, currency)}</span>
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

  const currency = useCurrency();
  const travelers = state.adults + state.kids;
  const breakdown = computeBudget({ travelers, nights: n || 0, hotels: dest.accoms.length, level: state.budgetLevel });
  const budgetTotal = typeof dest.budgetOverride === "number" ? dest.budgetOverride : breakdown.total;
  const hasCoords = typeof dest.lat === "number" && typeof dest.lng === "number" && !(dest.lat === 0 && dest.lng === 0);
  const [panel, setPanel] = useState<"budget" | "weather" | null>(null);
  const weather = useWeather(hasCoords ? dest.lat : undefined, hasCoords ? dest.lng : undefined, dest.arrive, dest.depart);

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

              {/* badges + interactive chips */}
              <div className="px-4 py-3 flex items-center gap-2 flex-wrap border-b border-line">
                <span className={metaChip}><Moon size={13} strokeWidth={2} className="text-accent" />{n ?? 0} night{n !== 1 ? "s" : ""}</span>
                <span className={metaChip}><Building size={13} strokeWidth={2} className="text-accent" />{dest.accoms.length} hotel{dest.accoms.length !== 1 ? "s" : ""}</span>

                {/* budget chip */}
                <button
                  onClick={(e) => { e.stopPropagation(); setPanel((p) => (p === "budget" ? null : "budget")); }}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-[5px] rounded-lg cursor-pointer transition border"
                  style={{ background: panel === "budget" ? "var(--surface)" : "var(--tint)", borderColor: panel === "budget" ? "var(--accent)" : "transparent", color: "var(--ink)" }}
                >
                  <Wallet size={13} strokeWidth={2} className="text-accent" />{formatMoney(budgetTotal, currency)}
                  {typeof dest.budgetOverride === "number" && <span className="text-accent">*</span>}
                </button>

                {/* weather chip */}
                {hasCoords && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPanel((p) => (p === "weather" ? null : "weather")); }}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-[5px] rounded-lg cursor-pointer transition border"
                    style={{ background: panel === "weather" ? "var(--surface)" : "var(--tint)", borderColor: panel === "weather" ? "var(--accent)" : "transparent", color: "var(--ink)" }}
                  >
                    {weather.state === "ready" && weather.data ? (
                      (() => { const Icon = describeWeather(weather.data.summary.code).icon; const temp = weather.data.current?.temp ?? weather.data.summary.tMax; return <><Icon size={13} strokeWidth={2} className="text-accent" />{temp}°{weather.data.mode === "seasonal" ? " avg" : ""}</>; })()
                    ) : weather.state === "loading" ? (
                      <><Loader2 size={13} className="vp-spin text-accent" />Weather</>
                    ) : (
                      <><Cloud size={13} strokeWidth={2} className="text-muted" />Weather</>
                    )}
                  </button>
                )}

                <div className="flex-1" />
                <button onClick={(e) => { e.stopPropagation(); actions.removeDest(dest.id); }} title="Remove" className="w-[30px] h-[30px] rounded-[9px] border border-line bg-surface text-muted grid place-items-center cursor-pointer hover:border-[#d9534f] hover:text-[#d9534f]"><Trash2 size={15} strokeWidth={2} /></button>
              </div>

              {/* budget / weather detail panel */}
              {panel && (
                <div className="px-4 py-3 border-b border-line">
                  {panel === "budget" && (
                    <BudgetPanel
                      breakdown={breakdown}
                      level={state.budgetLevel}
                      override={dest.budgetOverride}
                      travelers={travelers}
                      nights={n || 0}
                      onLevel={actions.setBudgetLevel}
                      onOverride={(v) => actions.setDestBudget(dest.id, v)}
                    />
                  )}
                  {panel === "weather" && hasCoords && (
                    <WeatherPanel lat={dest.lat} lng={dest.lng} arrive={dest.arrive} depart={dest.depart} />
                  )}
                </div>
              )}

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

                  <div className="mt-4 pt-4 border-t border-line flex items-center justify-end">
                    <button onClick={() => { actions.collapseDest(dest.id); withSave(Promise.resolve()); }} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[11px] bg-accent text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06]" style={{ boxShadow: "0 8px 18px -8px var(--accent)" }}>
                      <Check size={15} strokeWidth={2} />Save
                    </button>
                  </div>
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

const SUGGESTION_META: Record<SuggestionType, { Icon: typeof TriangleAlert; color: string }> = {
  warning: { Icon: TriangleAlert, color: "#B26B00" },
  missing_info: { Icon: PenLine, color: "var(--muted)" },
  route: { Icon: MapPin, color: "var(--accent)" },
  timing: { Icon: Clock, color: "var(--accent)" },
  hotel: { Icon: Bed, color: "var(--accent)" },
  positive: { Icon: Check, color: "var(--accent)" },
};

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

  // Trip-specific suggestions generated from the route the user actually entered.
  const suggestions = generateTripSuggestions({
    stops: savedDests.map((d) => {
      const p: LatLng | undefined =
        typeof d.lat === "number" && typeof d.lng === "number" && !(d.lat === 0 && d.lng === 0)
          ? { lat: d.lat, lng: d.lng }
          : coords[d.id];
      return {
        name: d.name,
        country: d.country,
        lat: p?.lat,
        lng: p?.lng,
        nights: nightsBetween(d.arrive, d.depart) || 0,
        hasDates: !!(d.arrive && d.depart),
        hotels: d.accoms.length,
      };
    }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[18px] border border-line overflow-hidden">
        <div className="relative h-[300px]">
          {/* Local boundary: a Google Maps load/runtime failure degrades to a notice
              here instead of crashing the whole Route Planner screen. */}
          <ErrorBoundary fallback={() => <div className="absolute inset-0 grid place-items-center bg-[#eef3ec] text-muted text-[13px] px-6 text-center">Map preview unavailable right now — your route and plan are unaffected.</div>}>
            <MapsApiProvider>
              <GoogleMap center={center} zoom={6} className="absolute inset-0 h-full w-full" fallback={<div className="absolute inset-0 grid place-items-center bg-[#eef3ec] text-muted text-[13px] px-6 text-center">Add a Maps key to preview your route.</div>}>
                <DestinationMarkers markers={markers} />
                <RouteLine points={points} />
              </GoogleMap>
            </MapsApiProvider>
          </ErrorBoundary>
        </div>
      </div>

      <div className="rounded-[18px] border border-line bg-surface p-4">
        <div className="flex items-center gap-1.5 font-display font-bold text-[15px]"><Sparkle size={16} strokeWidth={1.7} className="text-accent" />AI travel suggestions</div>
        <div className="mt-3 flex flex-col gap-2">
          {suggestions.length === 0 ? (
            <div className="rounded-xl bg-tint px-3 py-2.5 text-[12px] text-muted leading-snug">
              Add your destinations, dates and hotels — tailored tips for this trip will appear here.
            </div>
          ) : (
            suggestions.map((s, i) => {
              const meta = SUGGESTION_META[s.type];
              const Icon = meta.Icon;
              return (
                <div key={i} className="rounded-xl bg-tint px-3 py-2.5 vp-slide-up">
                  <div className="flex items-start gap-2">
                    <Icon size={14} strokeWidth={2.2} className="shrink-0 mt-0.5" style={{ color: meta.color }} />
                    <div>
                      <div className="text-[12.5px] font-semibold text-ink">{s.title}</div>
                      <div className="text-[12px] text-muted leading-snug mt-0.5">{s.description}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
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
  const { activeTrip } = useTrips();
  const totalNights = state.destinations.reduce((s, d) => s + (nightsBetween(d.arrive, d.depart) || 0), 0);
  const persist = () => {
    if (activeTrip?.id) withSave(saveTrip(activeTrip.id, state.destinations, state.budgetLevel, state.transports));
    else withSave(Promise.resolve());
  };
  return (
    <div className="sticky bottom-4 z-30 mt-4">
      <div className="mx-auto max-w-[1100px] rounded-[16px] border border-line p-2.5 flex items-center gap-2 flex-wrap" style={{ background: "color-mix(in oklab, var(--surface) 80%, var(--bg))", backdropFilter: "blur(12px)", boxShadow: "0 16px 40px -18px rgba(0,0,0,.35)" }}>
        <button onClick={actions.addDest} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[11px] border border-line bg-surface text-ink text-[13.5px] font-bold cursor-pointer hover:border-accent hover:text-accent"><Plus size={16} strokeWidth={2} />Add destination</button>
        <button onClick={() => { const d = state.destinations.find((x) => x.expanded && x.saved); if (d) actions.addAccom(d.id); else actions.flash("Open a destination to add a hotel."); }} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[11px] border border-line bg-surface text-ink text-[13.5px] font-bold cursor-pointer hover:border-accent hover:text-accent"><Bed size={16} strokeWidth={2} />Add hotel</button>
        <div className="flex-1 min-w-0 text-[12.5px] text-muted px-2 hidden sm:block">{state.destinations.length} destination{state.destinations.length !== 1 ? "s" : ""} · {totalNights} night{totalNights !== 1 ? "s" : ""}</div>
        <button onClick={() => { actions.collapseAllDests(); persist(); }} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[11px] border border-line bg-surface text-ink text-[13.5px] font-bold cursor-pointer hover:border-accent hover:text-accent"><Check size={16} strokeWidth={2} />Save</button>
        <button onClick={() => { persist(); actions.goExplore(); }} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[11px] bg-accent text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06]" style={{ boxShadow: "0 8px 20px -10px var(--accent)" }}>Continue<ArrowRight size={16} strokeWidth={2} /></button>
      </div>
    </div>
  );
}

/* ============================ persistence ============================ */

// Auto-save the route (destinations + dates) to the active trip whenever it
// changes. Skips the first run so loading a trip never re-writes/overwrites it.
function useAutoSaveRoute() {
  const { state } = useTrip();
  const { activeTrip } = useTrips();
  const tripId = activeTrip?.id;
  const first = useRef(true);
  const sig =
    state.budgetLevel +
    "::" +
    JSON.stringify(state.transports) +
    "::" +
    state.destinations
      .map(
        (d) =>
          `${d.saved ? 1 : 0}|${d.name}|${d.country}|${d.countryCode ?? ""}|${d.lat ?? ""}|${d.lng ?? ""}|${d.arrive}|${d.depart}|${d.image ?? ""}|${d.budgetOverride ?? ""}|` +
          d.accoms.map((a) => `${a.type},${a.name},${a.checkin},${a.checkout},${a.conf},${a.address},${a.notes},${a.locationUrl ?? ""}`).join(";")
      )
      .join("~");
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!tripId) return;
    // Never persist while a trip is loading or failed to load: in those states the
    // plan is intentionally empty (skeleton/retry), and saving it would wipe the
    // user's saved destinations. Only auto-save real, loaded/edited plans.
    if (state.tripLoading || state.tripLoadError) return;
    const t = setTimeout(() => withSave(saveTrip(tripId, state.destinations, state.budgetLevel, state.transports)), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, tripId, state.tripLoading, state.tripLoadError]);
}

/* ============================ page ============================ */

/** Skeleton shown while a trip's saved plan is loading — never sample/demo content. */
function RouteSkeleton() {
  return (
    <div className="vp-fade-fast" aria-busy="true" aria-label="Loading your trip">
      <div className="h-[150px] rounded-[18px] border border-line vp-shimmer" />
      <div className="mt-6 flex flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-[110px] rounded-[16px] border border-line vp-shimmer" />
        ))}
      </div>
    </div>
  );
}

/** Shown when a trip's plan couldn't be loaded (transient auth/network). Offers a retry — never an empty plan. */
function RouteLoadError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-8 text-center vp-fade-fast">
      <div className="w-12 h-12 rounded-full grid place-items-center mx-auto" style={{ background: "#f7e7e3", color: "#b3402f" }}>
        <TriangleAlert size={22} strokeWidth={2} />
      </div>
      <div className="font-display font-bold text-[17px] mt-3.5">Couldn&apos;t load this trip</div>
      <p className="text-[13.5px] text-muted mt-1.5 max-w-[380px] mx-auto leading-relaxed">
        We had trouble reaching your saved plan. Your data is safe — this is usually a brief connection or sign-in hiccup.
      </p>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-[11px] bg-accent text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06] transition disabled:opacity-70 disabled:cursor-default"
      >
        <RefreshCw size={15} strokeWidth={2.4} className={retrying ? "animate-spin" : ""} />
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

export function RouteBuilder() {
  const { state } = useTrip();
  const { activeTrip } = useTrips();
  const loadPlan = useTripLoader();
  const [panelOpen, setPanelOpen] = useState(true);
  const [retrying, setRetrying] = useState(false);
  useAutoSaveRoute();
  const dests = state.destinations;
  const lastIdx = dests.length - 1;
  const loading = state.tripLoading;
  const loadError = state.tripLoadError;
  const retry = async () => {
    if (!activeTrip || retrying) return;
    setRetrying(true);
    try {
      await loadPlan(activeTrip.id, activeTrip.destination);
    } finally {
      setRetrying(false);
    }
  };

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
            {loading ? (
              <RouteSkeleton />
            ) : loadError ? (
              <RouteLoadError onRetry={retry} retrying={retrying} />
            ) : (
              <>
                <div>
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
                {/* Trip summary now lives at the end of the page — a recap once the route is built. */}
                {dests.length > 0 && <div className="mt-8"><TripOverview /></div>}
                <FloatingActionBar />
              </>
            )}
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
