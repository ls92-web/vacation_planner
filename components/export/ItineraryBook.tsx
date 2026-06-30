"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Printer, X } from "lucide-react";
import { EX_THUMBS, fmtMonthDay, MODE_TEMPLATES, nightsBetween, recommend } from "@/lib/data";
import { formatDurationMin, formatKm, type ItineraryItem } from "@/lib/places";
import { computeTimeline, fmtClock, orderedItems as orderItems } from "@/lib/planner/travel";
import { analyzeDay } from "@/lib/planner/dayAnalysis";
import { usePlanner } from "@/lib/planner/store";
import { useTrip } from "@/lib/store";
import { useAuth } from "@/lib/auth/store";
import { computeBudget, convertCostText, formatMoney } from "@/lib/budget/estimate";
import { useCurrency } from "@/lib/budget/useCurrency";
import type { LatLng } from "@/lib/maps";
import type { Destination } from "@/lib/types";
import type { BookTemplate } from "./templates";

const cityKey = (name: string) => name.split(",")[0].trim().toLowerCase();

function dayDate(arrive: string, offset: number): string | null {
  if (!arrive) return null;
  const d = new Date(`${arrive}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function ItineraryBook({ template: t, onClose }: { template: BookTemplate; onClose: () => void }) {
  const { state } = usePlanner();
  const trip = useTrip();
  const auth = useAuth();
  const currency = useCurrency();
  // The "Trip at a glance" recap is opt-out via the planner's summary card.
  const includeOverview = auth.state.preferences?.export_include_overview ?? true;
  const travelers = trip.state.adults + trip.state.kids;
  const [qr, setQr] = useState("");

  useEffect(() => {
    QRCode.toDataURL(typeof window !== "undefined" ? window.location.origin : "https://itinera.app", { margin: 1, width: 200 })
      .then(setQr)
      .catch(() => setQr(""));
  }, []);

  const dests = useMemo(() => trip.state.destinations.filter((d) => d.saved && d.name.trim()), [trip.state.destinations]);

  // Group the itinerary by destination (travel order), with continuous day numbering.
  const { sections, totals, totalDays, totalBudget } = useMemo(() => {
    const firstKey = dests[0] ? cityKey(dests[0].name) : "";
    let offset = 0;
    let budget = 0;
    const tot = { attractions: 0, restaurants: 0, sightseeing: 0, stops: 0 };
    const secs = dests.map((d) => {
      const dcenter: LatLng = typeof d.lat === "number" && typeof d.lng === "number" && !(d.lat === 0 && d.lng === 0) ? { lat: d.lat, lng: d.lng } : state.center;
      const items = state.itinerary.filter((it) => (it.destId ? cityKey(it.destId) : firstKey) === cityKey(d.name));
      // Day count is the destination's nights, but never fewer than the days that
      // actually hold stops — otherwise a stop placed on a day later trimmed off by a
      // shortened date range would be silently dropped from the book (and its counts),
      // so the cover totals would no longer match the stops the user actually planned.
      const maxItemDay = items.reduce((m, it) => Math.max(m, it.day), -1);
      const dayCount = Math.max(1, nightsBetween(d.arrive, d.depart) || 1, maxItemDay + 1);
      const dayList = Array.from({ length: dayCount }, (_, di) => {
        const dayItems: ItineraryItem[] = items.filter((it) => it.day === di);
        const seq = orderItems(dayItems);
        const analysis = analyzeDay(dayItems, dcenter, state.transportMode);
        tot.attractions += analysis.attractions;
        tot.restaurants += analysis.restaurants;
        tot.sightseeing += analysis.visitMin;
        tot.stops += seq.length;
        return { globalDay: offset + di + 1, seq, timeline: computeTimeline(seq, dcenter, state.transportMode), analysis, date: dayDate(d.arrive, di) };
      });
      const b = computeBudget({ travelers, nights: nightsBetween(d.arrive, d.depart) || 0, hotels: d.accoms.length, level: trip.state.budgetLevel });
      const destBudget = typeof d.budgetOverride === "number" ? d.budgetOverride : b.total;
      budget += destBudget;
      const sec = { d, dayList, startDay: offset + 1, endDay: offset + dayCount, nights: nightsBetween(d.arrive, d.depart) || 0, budget: destBudget };
      offset += dayCount;
      return sec;
    });
    return { sections: secs, totals: tot, totalDays: offset, totalBudget: budget };
  }, [dests, state.itinerary, state.center, state.transportMode, travelers, trip.state.budgetLevel]);

  const labelCls = t.uppercaseLabels ? "uppercase tracking-[.12em]" : "tracking-[.02em]";
  const routeLabel = dests.map((d) => d.name.split(",")[0]).join("  →  ");
  const coverTitle = dests.length ? (dests.length === 1 ? dests[0].name.split(",")[0] : `${dests[0].name.split(",")[0]} & beyond`) : trip.state.dest.split(",")[0];
  const hasStops = totals.stops > 0;

  return (
    <div className="fixed inset-0 z-[100] overflow-auto" style={{ background: "rgba(20,16,12,.6)" }}>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 bg-ink text-white">
        <div className="font-display font-bold text-[15px]">{t.name} — preview</div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-accent text-white text-[13px] font-bold cursor-pointer hover:brightness-110">
            <Printer size={15} strokeWidth={2} />Save as PDF / Print
          </button>
          <button onClick={onClose} className="w-9 h-9 rounded-[10px] bg-white/15 text-white grid place-items-center cursor-pointer hover:bg-white/25"><X size={16} strokeWidth={2} /></button>
        </div>
      </div>

      <div id="itinerary-book" className="mx-auto my-6" style={{ width: "min(820px, 94vw)" }}>
        <div style={{ background: t.page, color: t.fg }} className="rounded-[6px] overflow-hidden shadow-2xl">
          {/* cover */}
          <div className="book-page relative px-10 py-16 flex flex-col justify-between min-h-[440px]" style={{ background: t.coverBg, color: t.coverFg }}>
            <div className="absolute inset-0 opacity-[.08]" style={{ background: "repeating-linear-gradient(135deg,#fff 0 2px,transparent 2px 18px)" }} />
            <div className="relative flex items-center justify-between">
              <div className={`text-[12px] font-bold ${labelCls}`}>Itinera</div>
              <div className={`text-[12px] ${labelCls}`} style={{ opacity: 0.8 }}>Curated travel guide</div>
            </div>
            <div className="relative">
              <div className={`text-[12px] ${labelCls}`} style={{ opacity: 0.8 }}>{dests.length} destination{dests.length !== 1 ? "s" : ""} · {totalDays} day{totalDays !== 1 ? "s" : ""}</div>
              <div className={`${t.titleClass} font-bold leading-[1.02] mt-2`} style={{ fontSize: "clamp(40px,8vw,68px)" }}>{coverTitle}</div>
              <div className="mt-3 h-[3px] w-[120px]" style={{ background: t.accent }} />
              {dests.length > 1 && <div className="mt-3 text-[13px] font-semibold" style={{ opacity: 0.9 }}>{routeLabel}</div>}
            </div>
            <div className="relative flex items-end justify-between gap-4">
              <div className="text-[13px]" style={{ opacity: 0.85 }}>A destination-by-destination plan with sights, food, timings and travel.</div>
              {qr && (
                <div className="text-center shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="Open the live itinerary" className="w-[72px] h-[72px] rounded-md bg-white p-1" />
                  <div className="text-[9px] mt-1" style={{ opacity: 0.8 }}>Live itinerary</div>
                </div>
              )}
            </div>
          </div>

          {/* trip overview — opt-out via the planner's summary card */}
          {includeOverview && (
            <div className="px-10 py-8" style={{ borderBottom: `1px solid ${t.line}` }}>
              <div className={`text-[11px] font-bold ${labelCls}`} style={{ color: t.accent }}>Trip at a glance</div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-5">
                {[
                  { v: String(dests.length), l: "Destinations" },
                  { v: String(totalDays), l: "Days" },
                  { v: String(totals.attractions), l: "Attractions" },
                  { v: String(totals.restaurants), l: "Restaurants" },
                  { v: formatMoney(totalBudget, currency), l: "Est. budget" },
                ].map((s, i) => (
                  <div key={i}>
                    <div className="font-display font-bold text-[22px] leading-none">{s.v}</div>
                    <div className="text-[11px] mt-1.5" style={{ color: t.muted }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* destination sections */}
          {sections.map((sec, si) => (
            <div key={si}>
              {/* travel card between destinations */}
              {si > 0 && (() => {
                const rec = recommend(sections[si - 1].d, sec.d);
                const mode = trip.state.transports[rec.key] || rec.recMode;
                const tpl = rec.override && rec.override.mode === mode ? rec.override : MODE_TEMPLATES[mode];
                return (
                  <div className="px-10 py-5 flex items-center gap-3 text-[12.5px]" style={{ background: t.surface, borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}` }}>
                    <span className="font-bold" style={{ color: t.accent }}>Travel day</span>
                    <span className="font-semibold">{sections[si - 1].d.name.split(",")[0]} → {sec.d.name.split(",")[0]}</span>
                    <span style={{ color: t.muted }}>· {mode} · {tpl.duration} · {convertCostText(tpl.cost, currency)}</span>
                  </div>
                );
              })()}

              {/* destination hero */}
              <div className="book-page relative h-[230px] overflow-hidden" style={{ background: t.coverBg }}>
                {sec.d.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sec.d.image} alt={sec.d.name} className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.6))" }} />
                <div className="absolute bottom-6 left-10 right-10 text-white">
                  <div className={`text-[11px] font-bold ${labelCls}`} style={{ opacity: 0.9 }}>Destination {si + 1} · Days {sec.startDay}{sec.endDay !== sec.startDay ? `–${sec.endDay}` : ""}</div>
                  <div className={`${t.titleClass} font-bold leading-[1.02] mt-1`} style={{ fontSize: "clamp(30px,6vw,48px)" }}>{sec.d.name.split(",")[0]}</div>
                  <div className="text-[13px] mt-1" style={{ opacity: 0.92 }}>
                    {sec.d.country}{sec.d.arrive && sec.d.depart ? ` · ${fmtMonthDay(sec.d.arrive)} – ${fmtMonthDay(sec.d.depart)}` : ""} · {sec.nights} night{sec.nights !== 1 ? "s" : ""} · {formatMoney(sec.budget, currency)}
                  </div>
                  {sec.d.accoms.some((a) => a.name) && (
                    <div className="text-[12px] mt-0.5" style={{ opacity: 0.85 }}>Staying at {sec.d.accoms.filter((a) => a.name).map((a) => a.name).join(", ")}</div>
                  )}
                </div>
              </div>

              {/* days for this destination */}
              {sec.dayList.map((x) => (
                <div key={x.globalDay} className="book-page px-10 py-8" style={{ borderTop: `1px solid ${t.line}` }}>
                  <div className="flex items-baseline justify-between">
                    <div className={`${t.titleClass} font-bold text-[24px]`}>Day {x.globalDay}</div>
                    {x.seq.length > 0 && <div className="text-[12px] font-bold" style={{ color: t.accent }}>{x.analysis.pace}</div>}
                  </div>
                  {x.date && <div className="mt-0.5 text-[12px]" style={{ color: t.muted }}>{x.date}</div>}
                  <div className="mt-3 h-[2px] w-full" style={{ background: t.line }} />

                  {x.seq.length === 0 ? (
                    <div className="mt-4 text-[12.5px]" style={{ color: t.muted }}>A free day in {sec.d.name.split(",")[0]} — explore at your own pace.</div>
                  ) : (
                    <div className="mt-4 flex flex-col gap-3">
                      {x.timeline.entries.map((e, i) => {
                        const p = e.item.place;
                        return (
                          <div key={p.id} style={{ breakInside: "avoid" }}>
                            {i > 0 && (
                              <div className="text-[10.5px] my-1.5 pl-[58px]" style={{ color: t.muted }}>↓ {e.travelFromPrev.min} min · {formatKm(e.travelFromPrev.km, state.units)}</div>
                            )}
                            <div className="flex gap-3 items-start">
                              <div className="w-[50px] shrink-0 text-[12px] font-bold pt-1" style={{ color: t.accent }}>{fmtClock(e.arrivalMin)}</div>
                              <div className="w-[64px] h-[48px] rounded-[6px] overflow-hidden shrink-0" style={{ background: EX_THUMBS[i % EX_THUMBS.length] }}>
                                {p.photoUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-[10px] font-bold ${labelCls}`} style={{ color: t.accent }}>{p.category}</div>
                                <div className="font-display font-bold text-[15px] leading-tight">{p.name}</div>
                                <div className="text-[11.5px]" style={{ color: t.muted }}>{formatDurationMin(e.item.durationMin ?? p.estDurationMin)}{p.rating != null ? ` · ${p.rating.toFixed(1)}★` : ""}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* footer */}
          <div className="px-10 py-8 flex items-center justify-between gap-4" style={{ borderTop: `1px solid ${t.line}` }}>
            <div>
              <div className="font-display font-bold text-[15px]">Planned with Itinera</div>
              <div className="text-[11.5px]" style={{ color: t.muted }}>Scan to open and edit the live itinerary.</div>
            </div>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="Live itinerary QR" className="w-[64px] h-[64px] rounded-md" style={{ background: "#fff", padding: 4 }} />
            )}
          </div>
        </div>

        {!hasStops && (
          <div className="no-print text-center text-white/80 py-10">Add stops to your plan, then export your travel guide.</div>
        )}
      </div>
    </div>
  );
}
