"use client";

import { useTrip } from "@/lib/store";
import { Check } from "../icons";

export function GeneratingScreen() {
  const { state } = useTrip();
  const city = state.dest.split(",")[0];
  const labels = [
    `Scouting top-rated places in ${city}`,
    "Checking opening hours & ticket info",
    "Mapping routes & travel distances",
    "Matching spots to your kids' ages",
    "Designing your custom plan",
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-[30px]">
      <div className="w-full max-w-[460px] text-center vp-fade">
        <div
          className="w-[74px] h-[74px] mx-auto rounded-[22px] bg-accent grid place-items-center"
          style={{ boxShadow: "0 16px 36px -12px var(--accent)" }}
        >
          <div className="w-[30px] h-[30px] border-[3.5px] border-white/35 border-t-white rounded-full vp-spin" />
        </div>
        <div className="mt-[26px] font-display font-bold text-[25px] tracking-[-.01em]">
          Building your {state.dest} plan
        </div>
        <p className="text-muted mt-[7px] text-[14px]">Sit tight — this usually takes a moment.</p>

        <div className="mt-[26px] text-left flex flex-col gap-[11px]">
          {labels.map((label, i) => {
            const done = i < state.genStep;
            const active = i === state.genStep;
            return (
              <div
                key={i}
                className="flex items-center gap-[13px] px-[15px] py-[13px] rounded-[13px] border transition-all"
                style={{
                  background: active ? "var(--tint)" : "#fff",
                  borderColor: active ? "color-mix(in oklab, var(--accent) 30%, transparent)" : "var(--line)",
                }}
              >
                <div
                  className="w-6 h-6 rounded-full shrink-0 grid place-items-center text-[13px] font-bold"
                  style={{
                    background: done || active ? "var(--accent)" : "#f0ebe3",
                    color: done || active ? "#fff" : "var(--muted)",
                  }}
                >
                  {done ? <Check size={14} strokeWidth={2.5} /> : active ? "" : i + 1}
                </div>
                <span
                  className="text-[14px] font-medium"
                  style={{ color: done || active ? "var(--ink)" : "var(--muted)" }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
