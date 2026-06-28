"use client";

import { useRef, useState } from "react";
import { Building2, Check, ChevronDown, Clock, CreditCard, MapPin, Moon, Sparkles, Trash2, Wallet, X } from "lucide-react";
import { useTrip } from "@/lib/store";
import { usePlanner } from "@/lib/planner/store";
import { fmtMonthDay, MODE_TEMPLATES, nightsBetween, recommend } from "@/lib/data";
import { MODE_ICONS } from "@/components/icons";
import { SLOT_LABELS, SLOTS, type ItineraryItem } from "@/lib/places";
import { computeBudget, convertCostText, formatMoney } from "@/lib/budget/estimate";
import { useCurrency } from "@/lib/budget/useCurrency";
import { useWeather } from "@/lib/weather/client";
import { describeWeather } from "@/lib/weather/codes";
import { CityImage } from "@/components/destinations/CityImage";
import type { Destination } from "@/lib/types";

const cityKey = (name: string) => name.split(",")[0].trim().toLowerCase();
const destDays = (d: Destination) => Math.max(1, nightsBetween(d.arrive, d.depart) || 1);

function dayDate(arrive: string, offset: number): string | null {
  if (!arrive) return null;
  const d = new Date(`${arrive}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/* ---------------- travel card between two destinations ---------------- */
function TravelCard({ from, to }: { from: Destination; to: Destination }) {
  const { state } = useTrip();
  const currency = useCurrency();
  const rec = recommend(from, to);
  const chosen = state.transports[rec.key] || rec.recMode;
  const tpl = rec.override && rec.override.mode === chosen ? rec.override : MODE_TEMPLATES[chosen];
  const ModeIcon = MODE_ICONS[chosen];
  return (
    <div className="flex items-center gap-3 my-3 pl-1">
      <div className="w-10 h-10 rounded-full grid place-items-center shrink-0 text-white" style={{ background: "var(--brand-deep)" }}>
        <ModeIcon size={18} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0 rounded-[14px] border border-dashed px-4 py-2.5" style={{ borderColor: "color-mix(in oklab, var(--accent) 40%, var(--line))", background: "color-mix(in oklab, var(--accent) 6%, var(--surface))" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-[.05em] text-accent">Travel day</span>
          <span className="text-[13.5px] font-semibold text-ink">{from.name.split(",")[0]} → {to.name.split(",")[0]}</span>
          <span className="text-[12.5px] font-bold text-ink">· {chosen}</span>
          <span className="flex-1" />
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted"><Clock size={13} strokeWidth={2} />{tpl.duration}</span>
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted"><CreditCard size={13} strokeWidth={2} />{convertCostText(tpl.cost, currency)}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- one stop ---------------- */
function StopRow({ item }: { item: ItineraryItem }) {
  const { actions } = usePlanner();
  const p = item.place;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] border border-line bg-surface group">
      <div className="w-[46px] h-[46px] rounded-[10px] overflow-hidden shrink-0" style={{ background: "var(--tint)" }}>
        {p.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photoUrl} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full grid place-items-center text-accent"><MapPin size={16} /></span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-ink truncate">{p.name}</div>
        <div className="text-[12px] text-muted truncate">{SLOT_LABELS[item.slot]}{p.rating != null ? ` · ★ ${p.rating.toFixed(1)}` : ""}</div>
      </div>
      <button onClick={() => actions.removeFromItinerary(p.id)} title="Remove" className="w-7 h-7 rounded-lg border border-line bg-surface text-muted grid place-items-center cursor-pointer hover:text-[#b3402f] hover:border-[#b3402f] opacity-0 group-hover:opacity-100 transition"><Trash2 size={13} strokeWidth={2} /></button>
    </div>
  );
}

/* ---------------- one destination section ---------------- */
function DestinationSection({
  dest,
  dayOffset,
  days,
  items,
  collapsed,
  onToggle,
  setRef,
}: {
  dest: Destination;
  dayOffset: number;
  days: number;
  items: ItineraryItem[];
  collapsed: boolean;
  onToggle: () => void;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  const trip = useTrip();
  const currency = useCurrency();
  const travelers = trip.state.adults + trip.state.kids;
  const nights = nightsBetween(dest.arrive, dest.depart) || 0;
  const breakdown = computeBudget({ travelers, nights, hotels: dest.accoms.length, level: trip.state.budgetLevel });
  const total = typeof dest.budgetOverride === "number" ? dest.budgetOverride : breakdown.total;
  const hasCoords = typeof dest.lat === "number" && typeof dest.lng === "number" && !(dest.lat === 0 && dest.lng === 0);
  const weather = useWeather(hasCoords ? dest.lat : undefined, hasCoords ? dest.lng : undefined, dest.arrive, dest.depart);
  const WIcon = weather.data ? describeWeather(weather.data.summary.code).icon : null;
  const ar = fmtMonthDay(dest.arrive);
  const de = fmtMonthDay(dest.depart);

  return (
    <div ref={setRef} className="rounded-[18px] border border-line bg-surface overflow-hidden scroll-mt-[72px]" style={{ boxShadow: "0 6px 24px -18px rgba(0,0,0,.3)" }}>
      {/* hero header */}
      <button onClick={onToggle} className="w-full text-left relative h-[150px] block cursor-pointer overflow-hidden">
        <CityImage name={dest.name} country={dest.country} image={dest.image ?? undefined} className="absolute inset-0 h-full w-full" />
        <div className="absolute bottom-3 left-4 right-4 z-10 text-white flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display font-bold text-[22px] leading-tight truncate" style={{ textShadow: "0 1px 8px rgba(0,0,0,.4)" }}>{dest.name.split(",")[0]}</div>
            <div className="flex items-center gap-1.5 text-[12.5px] text-white/90" style={{ textShadow: "0 1px 6px rgba(0,0,0,.45)" }}>
              <MapPin size={12} strokeWidth={2} />{dest.country || "—"}{ar && de ? ` · ${ar} → ${de}` : ""}
            </div>
          </div>
          <span className="z-10 transition-transform shrink-0" style={{ transform: collapsed ? "none" : "rotate(180deg)" }}><ChevronDown size={20} strokeWidth={2} /></span>
        </div>
      </button>

      {/* meta chips */}
      <div className="px-4 py-3 flex items-center gap-2 flex-wrap border-b border-line">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold bg-tint text-ink px-2.5 py-[5px] rounded-lg"><Moon size={13} strokeWidth={2} className="text-accent" />{nights} night{nights !== 1 ? "s" : ""}</span>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold bg-tint text-ink px-2.5 py-[5px] rounded-lg"><Building2 size={13} strokeWidth={2} className="text-accent" />{dest.accoms.length} hotel{dest.accoms.length !== 1 ? "s" : ""}</span>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold bg-tint text-ink px-2.5 py-[5px] rounded-lg"><Wallet size={13} strokeWidth={2} className="text-accent" />{formatMoney(total, currency)}</span>
        {weather.state === "ready" && weather.data && WIcon && (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold bg-tint text-ink px-2.5 py-[5px] rounded-lg"><WIcon size={13} strokeWidth={2} className="text-accent" />{weather.data.current?.temp ?? weather.data.summary.tMax}°{weather.data.mode === "seasonal" ? " avg" : ""}</span>
        )}
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold bg-tint text-ink px-2.5 py-[5px] rounded-lg"><Sparkles size={13} strokeWidth={2} className="text-accent" />{items.length} stop{items.length !== 1 ? "s" : ""}</span>
      </div>

      {/* days */}
      {!collapsed && (
        <div className="p-4 flex flex-col gap-4 vp-slide-down">
          {dest.accoms.some((a) => a.name) && (
            <div className="text-[12.5px] text-muted">Staying at <span className="font-semibold text-ink">{dest.accoms.filter((a) => a.name).map((a) => a.name).join(", ")}</span></div>
          )}
          {Array.from({ length: days }).map((_, d) => {
            const dayItems = items.filter((it) => it.day === d).sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.position - b.position);
            const date = dayDate(dest.arrive, d);
            return (
              <div key={d}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-display font-bold text-[15px]">Day {dayOffset + d + 1}</span>
                  {date && <span className="text-[12px] text-muted">{date}</span>}
                </div>
                {dayItems.length ? (
                  <div className="flex flex-col gap-2">
                    {dayItems.map((it) => <StopRow key={it.place.id} item={it} />)}
                  </div>
                ) : (
                  <div className="text-[12.5px] text-muted px-3 py-3 rounded-[12px] border border-dashed border-line">No stops yet — browse {dest.name.split(",")[0]} in Explore to add attractions.</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- the grouped itinerary ---------------- */
export function DestinationItinerary() {
  const { state } = useTrip();
  const planner = usePlanner();
  const dests = state.destinations.filter((d) => d.saved && d.name.trim());
  const refs = useRef<Record<number, HTMLDivElement | null>>({});
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  if (!dests.length) {
    return <div className="py-16 text-center text-muted"><div className="font-bold text-ink">No destinations yet</div><div className="text-[13px] mt-1">Add destinations in the Planner first.</div></div>;
  }

  // global day offsets in travel order
  let offset = 0;
  const sections = dests.map((d) => {
    const days = destDays(d);
    const entry = { d, dayOffset: offset, days };
    offset += days;
    return entry;
  });

  const firstKey = cityKey(dests[0].name);
  const itemsFor = (d: Destination) =>
    planner.state.itinerary.filter((it) => (it.destId ? cityKey(it.destId) : firstKey) === cityKey(d.name));

  const jump = (i: number) => {
    setCollapsed((s) => { const n = new Set(s); n.delete(i); return n; });
    requestAnimationFrame(() => refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div>
      {/* destination navigator */}
      <div className="sticky top-[56px] z-20 -mx-[clamp(16px,3vw,28px)] px-[clamp(16px,3vw,28px)] py-2.5 mb-4 flex items-center gap-2 overflow-x-auto vp-scroll" style={{ background: "color-mix(in oklab, var(--bg) 85%, #fff)", backdropFilter: "blur(8px)" }}>
        {sections.map((sec, i) => {
          const count = itemsFor(sec.d).length;
          return (
            <button key={i} onClick={() => jump(i)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12.5px] font-semibold cursor-pointer shrink-0 transition" style={{ borderColor: count > 0 ? "var(--accent)" : "var(--line)", background: count > 0 ? "var(--tint)" : "var(--surface)", color: count > 0 ? "var(--accent)" : "var(--muted)" }}>
              <span className="grid place-items-center w-4 h-4 rounded-full text-[10px] font-bold" style={{ background: count > 0 ? "var(--accent)" : "var(--line)", color: count > 0 ? "#fff" : "var(--muted)" }}>
                {count > 0 ? <Check size={10} strokeWidth={3} /> : i + 1}
              </span>
              {sec.d.name.split(",")[0]}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col">
        {sections.map((sec, i) => (
          <div key={i}>
            {i > 0 && <TravelCard from={sections[i - 1].d} to={sec.d} />}
            <DestinationSection
              dest={sec.d}
              dayOffset={sec.dayOffset}
              days={sec.days}
              items={itemsFor(sec.d)}
              collapsed={collapsed.has(i)}
              onToggle={() => setCollapsed((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}
              setRef={(el) => { refs.current[i] = el; }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
