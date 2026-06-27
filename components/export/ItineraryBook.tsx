"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Printer, X } from "lucide-react";
import { EX_THUMBS } from "@/lib/data";
import { formatDurationMin, formatKm } from "@/lib/places";
import { computeTimeline, fmtClock, orderedItems as orderItems } from "@/lib/planner/travel";
import { analyzeDay } from "@/lib/planner/dayAnalysis";
import { usePlanner } from "@/lib/planner/store";
import type { BookTemplate } from "./templates";

export function ItineraryBook({ template: t, onClose }: { template: BookTemplate; onClose: () => void }) {
  const { state } = usePlanner();
  const [qr, setQr] = useState("");

  useEffect(() => {
    QRCode.toDataURL(typeof window !== "undefined" ? window.location.origin : "https://wanderfold.app", { margin: 1, width: 200 })
      .then(setQr)
      .catch(() => setQr(""));
  }, []);

  const days = useMemo(() => {
    return Array.from({ length: state.dayCount }, (_, d) => {
      const items = state.itinerary.filter((it) => it.day === d);
      const seq = orderItems(items);
      return { d, seq, timeline: computeTimeline(seq, state.center, state.transportMode), analysis: analyzeDay(items, state.center, state.transportMode) };
    }).filter((x) => x.seq.length > 0);
  }, [state.itinerary, state.center, state.transportMode, state.dayCount]);

  const totals = days.reduce(
    (acc, x) => ({
      attractions: acc.attractions + x.analysis.attractions,
      restaurants: acc.restaurants + x.analysis.restaurants,
      budgetMin: acc.budgetMin + x.analysis.costMin,
      budgetMax: acc.budgetMax + x.analysis.costMax,
      sightseeing: acc.sightseeing + x.analysis.visitMin,
    }),
    { attractions: 0, restaurants: 0, budgetMin: 0, budgetMax: 0, sightseeing: 0 }
  );

  const city = state.destination.split(",")[0];
  const labelCls = t.uppercaseLabels ? "uppercase tracking-[.12em]" : "tracking-[.02em]";

  return (
    <div className="fixed inset-0 z-[100] overflow-auto" style={{ background: "rgba(20,16,12,.6)" }}>
      {/* toolbar (not printed) */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 bg-ink text-white">
        <div className="font-display font-bold text-[15px]">{t.name} — preview</div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-accent text-white text-[13px] font-bold cursor-pointer hover:brightness-110">
            <Printer size={15} strokeWidth={2} />Save as PDF / Print
          </button>
          <button onClick={onClose} className="w-9 h-9 rounded-[10px] bg-white/15 text-white grid place-items-center cursor-pointer hover:bg-white/25"><X size={16} strokeWidth={2} /></button>
        </div>
      </div>

      {/* the book */}
      <div id="itinerary-book" className="mx-auto my-6" style={{ width: "min(820px, 94vw)" }}>
        <div style={{ background: t.page, color: t.fg }} className="rounded-[6px] overflow-hidden shadow-2xl">
          {/* cover */}
          <div className="book-page relative px-10 py-16 flex flex-col justify-between min-h-[420px]" style={{ background: t.coverBg, color: t.coverFg }}>
            <div className="absolute inset-0 opacity-[.08]" style={{ background: "repeating-linear-gradient(135deg,#fff 0 2px,transparent 2px 18px)" }} />
            <div className="relative flex items-center justify-between">
              <div className={`text-[12px] font-bold ${labelCls}`}>Itinera</div>
              <div className={`text-[12px] ${labelCls}`} style={{ opacity: 0.8 }}>Curated travel itinerary</div>
            </div>
            <div className="relative">
              <div className={`text-[12px] ${labelCls}`} style={{ opacity: 0.8 }}>{days.length} day{days.length !== 1 ? "s" : ""} · family trip</div>
              <div className={`${t.titleClass} font-bold leading-[1.02] mt-2`} style={{ fontSize: "clamp(40px,8vw,72px)" }}>{city}</div>
              <div className="mt-3 h-[3px] w-[120px]" style={{ background: t.accent }} />
            </div>
            <div className="relative flex items-end justify-between gap-4">
              <div className="text-[13px]" style={{ opacity: 0.85 }}>A day-by-day plan with sights, food, timings and travel.</div>
              {qr && (
                <div className="text-center shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="Open the live itinerary" className="w-[72px] h-[72px] rounded-md bg-white p-1" />
                  <div className="text-[9px] mt-1" style={{ opacity: 0.8 }}>Live itinerary</div>
                </div>
              )}
            </div>
          </div>

          {/* trip overview */}
          <div className="px-10 py-8" style={{ borderBottom: `1px solid ${t.line}` }}>
            <div className={`text-[11px] font-bold ${labelCls}`} style={{ color: t.accent }}>Trip at a glance</div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-5">
              {[
                { v: String(days.length), l: "Days" },
                { v: String(totals.attractions), l: "Attractions" },
                { v: String(totals.restaurants), l: "Restaurants" },
                { v: formatDurationMin(totals.sightseeing), l: "Sightseeing" },
                { v: `€${totals.budgetMin}–${totals.budgetMax}`, l: "Estimated budget" },
              ].map((s, i) => (
                <div key={i}>
                  <div className="font-display font-bold text-[24px] leading-none">{s.v}</div>
                  <div className="text-[11px] mt-1.5" style={{ color: t.muted }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* days */}
          {days.map((x, di) => (
            <div key={x.d} className="book-page px-10 py-8" style={{ borderTop: di === 0 ? "none" : `1px solid ${t.line}` }}>
              <div className="flex items-baseline justify-between">
                <div className={`${t.titleClass} font-bold text-[26px]`}>Day {x.d + 1}</div>
                <div className="text-[12px] font-bold" style={{ color: t.accent }}>Score {x.analysis.overall.toFixed(1)}/10 · {x.analysis.pace}</div>
              </div>
              <div className="mt-1 text-[12px]" style={{ color: t.muted }}>
                {formatDurationMin(x.analysis.visitMin)} of visits · {formatKm(x.analysis.walkingKm, state.units)} walking · est. €{x.analysis.costMin}–{x.analysis.costMax}
              </div>
              <div className="mt-3 h-[2px] w-full" style={{ background: t.line }} />

              <div className="mt-4 flex flex-col gap-3">
                {x.timeline.entries.map((e, i) => {
                  const p = e.item.place;
                  return (
                    <div key={p.id} style={{ breakInside: "avoid" }}>
                      {i > 0 && (
                        <div className="text-[10.5px] my-1.5 pl-[58px]" style={{ color: t.muted }}>
                          ↓ {e.travelFromPrev.min} min · {formatKm(e.travelFromPrev.km, state.units)}
                        </div>
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
                          <div className="text-[11.5px]" style={{ color: t.muted }}>
                            {formatDurationMin(e.item.durationMin ?? p.estDurationMin)}
                            {p.rating != null ? ` · ${p.rating.toFixed(1)}★` : ""}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {x.analysis.recommendations[0] && (
                <div className="mt-4 rounded-[8px] p-3 text-[12px]" style={{ background: t.surface, border: `1px solid ${t.line}` }}>
                  <span className="font-bold" style={{ color: t.accent }}>AI tip · </span>
                  <span style={{ color: t.fg }}>{x.analysis.recommendations[0].title}.</span>{" "}
                  <span style={{ color: t.muted }}>{x.analysis.recommendations[0].reason}</span>
                </div>
              )}
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

        {days.length === 0 && (
          <div className="no-print text-center text-white/80 py-10">Add stops to your plan, then export your itinerary book.</div>
        )}
      </div>
    </div>
  );
}
