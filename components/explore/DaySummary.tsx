"use client";

import { Camera, Clock, Footprints, Route, Utensils, Wallet } from "lucide-react";
import { formatDurationMin, formatKm } from "@/lib/places";
import type { DayAnalysis } from "@/lib/planner/dayAnalysis";

const PACE_LABEL = { relaxed: "Relaxed", balanced: "Balanced", busy: "Busy", overloaded: "Overloaded" } as const;

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-[10px] bg-tint text-accent grid place-items-center shrink-0">
        <Icon size={16} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="font-display font-bold text-[15px] leading-none truncate">{value}</div>
        <div className="text-[11px] text-muted mt-1">{label}</div>
      </div>
    </div>
  );
}

export function DaySummary({ analysis, units, dayLabel }: { analysis: DayAnalysis; units: "km" | "mi"; dayLabel: string }) {
  if (analysis.stops === 0) return null;
  return (
    <div className="rounded-[18px] border border-line p-5 text-white relative overflow-hidden" style={{ background: "var(--brand-deep)" }}>
      <div className="relative flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="font-display font-bold text-[40px] leading-none">{analysis.overall.toFixed(1)}<span className="text-[16px] opacity-70">/10</span></div>
          <div>
            <div className="text-[12px] uppercase tracking-[.06em] opacity-80">{dayLabel} score</div>
            <div className="text-[13.5px] font-bold mt-0.5">{PACE_LABEL[analysis.pace]} pace</div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="grid gap-x-6 gap-y-3.5 grid-cols-2 sm:grid-cols-3 bg-white/10 rounded-[14px] p-4 backdrop-blur-sm">
          <Stat icon={Clock} label="Sightseeing" value={formatDurationMin(analysis.visitMin)} />
          <Stat icon={Footprints} label="Walking" value={formatKm(analysis.walkingKm, units)} />
          <Stat icon={Route} label="Travel time" value={formatDurationMin(analysis.walkingMin + analysis.transportMin)} />
          <Stat icon={Wallet} label="Est. budget" value={`€${analysis.costMin}–${analysis.costMax}`} />
          <Stat icon={Camera} label={analysis.attractions === 1 ? "Attraction" : "Attractions"} value={String(analysis.attractions)} />
          <Stat icon={Utensils} label={analysis.restaurants === 1 ? "Restaurant" : "Restaurants"} value={String(analysis.restaurants)} />
        </div>
      </div>
    </div>
  );
}
