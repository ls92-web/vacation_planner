"use client";

import { AlertTriangle, CalendarClock, Droplets, Loader2 } from "lucide-react";
import { useWeather } from "@/lib/weather/client";
import { describeWeather } from "@/lib/weather/codes";

function fmtDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

export function WeatherPanel({ lat, lng, arrive, depart }: { lat?: number; lng?: number; arrive?: string; depart?: string }) {
  const { state, data } = useWeather(lat, lng, arrive || "", depart || "");

  if (state === "loading" || state === "idle") {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-4 flex items-center gap-2 text-[13px] text-muted vp-slide-down">
        <Loader2 size={15} className="vp-spin" /> Loading the forecast…
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-4 flex items-center gap-2 text-[13px] text-muted vp-slide-down">
        <AlertTriangle size={15} style={{ color: "#9A6512" }} /> Weather is unavailable right now.
      </div>
    );
  }

  const sum = describeWeather(data.summary.code);
  const SumIcon = sum.icon;

  return (
    <div className="rounded-[14px] border border-line bg-surface p-3.5 vp-slide-down">
      {/* headline */}
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: "var(--tint)", color: "var(--accent)" }}><SumIcon size={22} strokeWidth={2} /></span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-bold text-[20px] text-ink">{data.current ? data.current.temp : data.summary.tMax}°</span>
            <span className="text-[12.5px] text-muted">/ {data.summary.tMin}°</span>
          </div>
          <div className="text-[12.5px] text-muted truncate">{sum.label}{data.summary.precip ? ` · ${data.summary.precip}% rain` : ""}</div>
        </div>
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-muted">
          <Droplets size={13} strokeWidth={2} /> {data.summary.precip}%
        </span>
      </div>

      {/* seasonal note */}
      {data.mode === "seasonal" && (
        <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px]" style={{ background: "var(--tint)", color: "var(--ink)" }}>
          <CalendarClock size={14} className="mt-px shrink-0" style={{ color: "var(--accent)" }} />
          <span>{data.note}</span>
        </div>
      )}

      {/* daily forecast */}
      {data.mode === "forecast" && data.days.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto vp-scroll pb-1">
          {data.days.map((d) => {
            const desc = describeWeather(d.code);
            const Icon = desc.icon;
            return (
              <div key={d.date} className="shrink-0 w-[64px] rounded-xl border border-line px-2 py-2.5 text-center">
                <div className="text-[11px] font-semibold text-muted">{fmtDay(d.date)}</div>
                <Icon size={20} strokeWidth={2} className="mx-auto my-1.5 text-accent" />
                <div className="text-[12.5px] font-bold text-ink tabular-nums">{d.tMax}°</div>
                <div className="text-[11px] text-muted tabular-nums">{d.tMin}°</div>
                {d.precip > 0 && <div className="text-[10px] mt-0.5 inline-flex items-center gap-0.5" style={{ color: "var(--accent)" }}><Droplets size={9} />{d.precip}%</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
