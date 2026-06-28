"use client";

import { Check } from "lucide-react";
import { THEME_OPTIONS, type ThemeId } from "@/lib/theme/themes";

/** A mini app mock rendered in the option's own theme (via nested data-theme). */
function Preview({ id }: { id: ThemeId }) {
  return (
    <div data-theme={id} className="rounded-[12px] overflow-hidden border border-line" style={{ background: "var(--bg)" }}>
      <div className="p-3 flex flex-col gap-2">
        {/* top bar */}
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md" style={{ background: "var(--brand-deep)" }} />
          <div className="h-2 w-12 rounded-full" style={{ background: "var(--ink)", opacity: 0.8 }} />
          <div className="flex-1" />
          <div className="w-5 h-5 rounded-full" style={{ background: "var(--accent)" }} />
        </div>
        {/* card */}
        <div className="rounded-[9px] p-2.5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="h-2 w-3/4 rounded-full" style={{ background: "var(--ink)", opacity: 0.85 }} />
          <div className="h-1.5 w-1/2 rounded-full mt-1.5" style={{ background: "var(--muted)", opacity: 0.55 }} />
          <div className="flex items-center gap-1.5 mt-2.5">
            <div className="h-5 w-12 rounded-md" style={{ background: "var(--accent)" }} />
            <div className="h-5 w-9 rounded-md" style={{ background: "var(--tint)" }} />
            <div className="w-3.5 h-3.5 rounded-full ml-auto" style={{ background: "var(--accent2)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (id: ThemeId) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {THEME_OPTIONS.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className="relative rounded-[16px] border-2 p-2.5 text-left transition cursor-pointer hover:-translate-y-0.5"
            style={{ borderColor: selected ? "var(--accent)" : "var(--line)", background: "var(--surface)", boxShadow: selected ? "0 10px 26px -16px rgba(0,0,0,.4)" : "none" }}
          >
            {selected && (
              <span className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full grid place-items-center text-white" style={{ background: "var(--accent)" }}>
                <Check size={14} strokeWidth={2.5} />
              </span>
            )}
            <Preview id={t.id} />
            <div className="mt-2.5 px-1 pb-0.5">
              <div className="font-semibold text-[13.5px] text-ink">{t.name}</div>
              <div className="text-[11.5px] text-muted leading-snug">{t.tagline}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
