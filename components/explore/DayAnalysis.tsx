"use client";

import { useState } from "react";
import {
  Car,
  ChevronDown,
  Clock,
  Footprints,
  Gauge,
  Hourglass,
  Info,
  Layers,
  Route,
  Sparkle,
  TrainFront,
  TriangleAlert,
  Users,
  Wallet,
  CloudSun,
} from "lucide-react";
import { formatDurationMin, formatKm } from "@/lib/places";
import type { DayAnalysis as DayAnalysisData, Grade, RecAction, Recommendation, Warning } from "@/lib/planner/dayAnalysis";

const ACTION_LABEL: Record<RecAction["kind"], string> = {
  optimize: "Reorder route",
  shorten: "Shorten 30 min",
  moveDay: "Move to another day",
  addCafe: "Add nearby café",
  findSimilar: "Find something different",
};

const GRADE_STYLE: Record<Grade, { bg: string; color: string }> = {
  excellent: { bg: "#E4F4F2", color: "#0A7A76" },
  good: { bg: "var(--tint)", color: "var(--accent)" },
  attention: { bg: "#fbf0dd", color: "#8a5a12" },
};

function GradeBadge({ grade, label }: { grade: Grade; label: string }) {
  const s = GRADE_STYLE[grade];
  return (
    <span className="px-2 py-1 rounded-lg text-[11.5px] font-bold whitespace-nowrap" style={{ background: s.bg, color: s.color }}>
      {label}
    </span>
  );
}

function CircularScore({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value / 10));
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: 84, height: 84 }}>
      <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none">
          <span className="font-display font-bold text-[22px]">{value.toFixed(1)}</span>
          <span className="text-[11px] text-muted">/10</span>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-line rounded-[14px] p-3">
      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted">
        <Icon size={13} strokeWidth={2} className="text-accent" />
        {label}
      </div>
      <div className="mt-1.5 text-ink">{children}</div>
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 rounded-full bg-line overflow-hidden mt-1.5">
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(1, value / 10)) * 100}%`, transition: "width .5s ease" }} />
    </div>
  );
}

function RecCard({ rec, onAction }: { rec: Recommendation; onAction?: (a: RecAction) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-line rounded-[12px] px-3 py-2.5 transition hover:border-accent">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left flex items-start gap-2 cursor-pointer">
        <span className="text-accent shrink-0 mt-0.5 flex"><Sparkle size={14} strokeWidth={1.8} /></span>
        <span className="flex-1 text-[12.5px] font-semibold text-ink">{rec.title}</span>
        <span className="text-muted shrink-0 flex transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}>
          <ChevronDown size={15} strokeWidth={2} />
        </span>
      </button>
      {open && <div className="text-[12px] text-muted leading-[1.5] mt-1.5 pl-6 vp-slide-down">{rec.reason}</div>}
      {rec.action && onAction && (
        <div className="mt-2 pl-6">
          <button
            onClick={() => onAction(rec.action!)}
            className="inline-flex items-center px-3 py-1.5 rounded-[9px] bg-accent text-white text-[12px] font-bold cursor-pointer hover:brightness-[1.06] transition"
          >
            {ACTION_LABEL[rec.action.kind]}
          </button>
        </div>
      )}
    </div>
  );
}

const WARN_STYLE = {
  high: { bg: "#f7e4e2", color: "#9e3c37" },
  warn: { bg: "#fbf0dd", color: "#8a5a12" },
  info: { bg: "var(--tint)", color: "var(--accent)" },
} as const;

function WarningCard({ w }: { w: Warning }) {
  const s = WARN_STYLE[w.level];
  return (
    <div className="rounded-[12px] px-3 py-2.5 flex items-start gap-2" style={{ background: s.bg }}>
      <span className="shrink-0 mt-0.5 flex" style={{ color: s.color }}><TriangleAlert size={14} strokeWidth={2} /></span>
      <div>
        <div className="text-[12.5px] font-bold" style={{ color: s.color }}>{w.title}</div>
        <div className="text-[12px] mt-0.5 leading-[1.45]" style={{ color: "var(--ink)" }}>{w.detail}</div>
      </div>
    </div>
  );
}

const PACE_LABEL = { relaxed: "Relaxed", balanced: "Balanced", busy: "Busy", overloaded: "Overloaded" } as const;
const EFF_LABEL = { excellent: "Excellent", good: "Good", attention: "Needs work" } as const;
const FAMILY_LABEL = { excellent: "Excellent", good: "Good", attention: "Busy for kids" } as const;
const DIFF_LABEL = { easy: "Easy", moderate: "Moderate", high: "High" } as const;
const paceGrade = (p: DayAnalysisData["pace"]): Grade => (p === "relaxed" || p === "balanced" ? "good" : p === "busy" ? "good" : "attention");
const diffGrade = (d: DayAnalysisData["walkingDifficulty"]): Grade => (d === "easy" ? "excellent" : d === "moderate" ? "good" : "attention");

export function DayAnalysis({ analysis, units, dayLabel, onAction }: { analysis: DayAnalysisData; units: "km" | "mi"; dayLabel: string; onAction?: (a: RecAction) => void }) {
  if (analysis.stops === 0) {
    return (
      <div className="bg-surface border border-line rounded-[18px] p-5 vp-fade-fast">
        <div className="flex items-center gap-1.5 font-display font-bold text-[15px]">
          <span className="text-accent flex"><Gauge size={16} strokeWidth={2} /></span>
          AI Day Analysis
        </div>
        <p className="text-[13px] text-muted mt-2">Add a few stops to {dayLabel} and I&apos;ll score comfort, efficiency, walking, cost, pace and more — live as you build.</p>
      </div>
    );
  }

  const freeLabel = analysis.freeMin >= 0 ? `${formatDurationMin(analysis.freeMin)} free` : `${formatDurationMin(-analysis.freeMin)} over`;

  return (
    <div className="bg-surface border border-line rounded-[18px] p-4 vp-fade-fast flex flex-col gap-4">
      {/* header + overall */}
      <div className="flex items-center gap-4">
        <CircularScore value={analysis.overall} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-display font-bold text-[15px]">
            <span className="text-accent flex"><Gauge size={16} strokeWidth={2} /></span>
            AI Day Analysis
          </div>
          <div className="text-[12px] text-muted mt-0.5">Overall day score · {dayLabel}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <GradeBadge grade={paceGrade(analysis.pace)} label={PACE_LABEL[analysis.pace]} />
            <GradeBadge grade={analysis.efficiency} label={EFF_LABEL[analysis.efficiency]} />
            <GradeBadge grade={analysis.family} label={`Family: ${FAMILY_LABEL[analysis.family]}`} />
            <GradeBadge grade={diffGrade(analysis.walkingDifficulty)} label={`Walking: ${DIFF_LABEL[analysis.walkingDifficulty]}`} />
          </div>
        </div>
      </div>

      {/* metric grid */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
        <Metric icon={Sparkle} label="Comfort">
          <div className="font-display font-bold text-[18px]">{analysis.comfort.toFixed(1)}<span className="text-[12px] text-muted font-body">/10</span></div>
          <Bar value={analysis.comfort} />
        </Metric>
        <Metric icon={Footprints} label="Walking">
          <div className="font-display font-bold text-[18px]">{formatKm(analysis.walkingKm, units)}</div>
          <div className="text-[12px] text-muted">{formatDurationMin(analysis.walkingMin)}</div>
        </Metric>
        <Metric icon={analysis.mode === "transit" ? TrainFront : Car} label={analysis.mode === "transit" ? "Transit" : "Driving"}>
          <div className="font-display font-bold text-[18px]">{analysis.transportKm > 0 ? formatKm(analysis.transportKm, units) : "—"}</div>
          <div className="text-[12px] text-muted">{analysis.transportMin > 0 ? formatDurationMin(analysis.transportMin) : "All walkable"}</div>
        </Metric>
        <Metric icon={Clock} label="Visit time">
          <div className="font-display font-bold text-[18px]">{formatDurationMin(analysis.visitMin)}</div>
          <div className="text-[12px] text-muted">{analysis.stops} stop{analysis.stops !== 1 ? "s" : ""}</div>
        </Metric>
        <Metric icon={Hourglass} label="Free time">
          <div className="font-display font-bold text-[18px]" style={{ color: analysis.freeMin < 0 ? "#9e3c37" : undefined }}>{freeLabel}</div>
          <div className="text-[12px] text-muted">{analysis.freeMin >= 60 ? "Great for shopping or a rest" : analysis.freeMin >= 0 ? "Tight but doable" : "Trim a stop"}</div>
        </Metric>
        <Metric icon={Wallet} label="Est. daily cost">
          <div className="font-display font-bold text-[18px]">€{analysis.costMin}–{analysis.costMax}</div>
          <div className="text-[12px] text-muted">family of 4 · estimate</div>
        </Metric>
        <Metric icon={Layers} label="Variety">
          <div className="font-display font-bold text-[18px]">{analysis.variety.score}<span className="text-[12px] text-muted font-body">/10</span></div>
          <div className="mt-1 flex flex-wrap gap-1">
            {analysis.variety.themes.map((t) => (
              <span key={t.theme} className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md bg-[#f0ece4] text-muted">{t.theme}</span>
            ))}
          </div>
        </Metric>
        <Metric icon={CloudSun} label="Weather">
          <div className="font-display font-bold text-[15px] text-muted">Not connected</div>
          <div className="text-[12px] text-muted">Weather-aware scoring coming soon</div>
        </Metric>
      </div>

      {/* recommendations */}
      {analysis.recommendations.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[.04em] text-muted mb-2">
            <Route size={13} strokeWidth={2} className="text-accent" />AI recommendations
          </div>
          <div className="flex flex-col gap-2">
            {analysis.recommendations.map((r, i) => <RecCard key={i} rec={r} onAction={onAction} />)}
          </div>
        </div>
      )}

      {/* warnings */}
      {analysis.warnings.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[.04em] text-muted mb-2">
            <Info size={13} strokeWidth={2} className="text-accent" />Smart warnings
          </div>
          <div className="flex flex-col gap-2">
            {analysis.warnings.map((w, i) => <WarningCard key={i} w={w} />)}
          </div>
        </div>
      )}

      {/* family-friendly summary line */}
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <Users size={13} strokeWidth={2} className="text-accent" />
        Tuned for a family with young kids — pace, walking and meal breaks are weighted accordingly.
      </div>
    </div>
  );
}
