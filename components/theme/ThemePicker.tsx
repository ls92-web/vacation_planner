"use client";

import { Check } from "lucide-react";
import { THEME_OPTIONS, type ThemeId } from "@/lib/theme/themes";

/**
 * A miniature of the actual app rendered in the option's own palette (via a nested
 * data-theme). Shows the real layout — sidebar, header, dashboard cards, buttons,
 * accent + nav highlight — so the swatch reads as "how the app will look".
 */
function Preview({ id }: { id: ThemeId }) {
  return (
    <div data-theme={id} className="rounded-[11px] overflow-hidden border border-line flex h-[136px]" style={{ background: "var(--bg)" }}>
      {/* sidebar */}
      <div className="w-[36%] h-full p-2 flex flex-col gap-1.5 border-r border-line" style={{ background: "color-mix(in oklab, var(--bg) 55%, #fff)" }}>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-[4px]" style={{ background: "var(--brand-deep)" }} />
          <div className="h-1.5 w-7 rounded-full" style={{ background: "var(--ink)", opacity: 0.7 }} />
        </div>
        {/* current-trip chip */}
        <div className="rounded-[6px] h-6" style={{ background: "var(--brand-deep)" }} />
        {/* active nav item */}
        <div className="flex items-center gap-1 rounded-[5px] px-1 py-1" style={{ background: "var(--tint)" }}>
          <div className="w-2 h-2 rounded-[3px]" style={{ background: "var(--accent)" }} />
          <div className="h-1 w-8 rounded-full" style={{ background: "var(--accent)", opacity: 0.85 }} />
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-1 px-1">
            <div className="w-2 h-2 rounded-[3px]" style={{ background: "var(--muted)", opacity: 0.45 }} />
            <div className="h-1 w-7 rounded-full" style={{ background: "var(--muted)", opacity: 0.32 }} />
          </div>
        ))}
      </div>

      {/* main */}
      <div className="flex-1 h-full p-2 flex flex-col gap-1.5 min-w-0">
        {/* header */}
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-10 rounded-full" style={{ background: "var(--ink)", opacity: 0.8 }} />
          <div className="flex-1" />
          <div className="h-3 w-7 rounded-full" style={{ background: "var(--accent)" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: "var(--brand-deep)" }} />
        </div>
        {/* dashboard cards */}
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-[6px] p-1.5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
              <div className="h-1 w-3/4 rounded-full" style={{ background: "var(--ink)", opacity: 0.65 }} />
              <div className="h-1 w-1/2 rounded-full mt-1" style={{ background: "var(--muted)", opacity: 0.4 }} />
              <div className="h-2 w-6 rounded-[3px] mt-1.5" style={{ background: i === 0 ? "var(--accent)" : "var(--tint)" }} />
            </div>
          ))}
        </div>
        {/* wide row card + secondary accent */}
        <div className="rounded-[6px] p-1.5 flex items-center gap-1.5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="w-5 h-5 rounded-[5px] shrink-0" style={{ background: "var(--tint)" }} />
          <div className="flex-1 min-w-0">
            <div className="h-1 w-full rounded-full" style={{ background: "var(--ink)", opacity: 0.55 }} />
            <div className="h-1 w-2/3 rounded-full mt-1" style={{ background: "var(--muted)", opacity: 0.4 }} />
          </div>
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: "var(--accent2)" }} />
        </div>
      </div>
    </div>
  );
}

export function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (id: ThemeId) => void }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {THEME_OPTIONS.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={selected}
            className="relative rounded-[16px] border-2 p-2.5 text-left cursor-pointer transition-all duration-300 ease-out hover:-translate-y-0.5"
            style={{
              borderColor: selected ? "var(--accent)" : "var(--line)",
              background: "var(--surface)",
              transform: selected ? "translateY(-2px) scale(1.03)" : undefined,
              boxShadow: selected ? "0 18px 38px -20px rgba(0,0,0,.45)" : "0 6px 20px -18px rgba(0,0,0,.35)",
            }}
          >
            {selected && (
              <span className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full grid place-items-center text-white vp-pop" style={{ background: "var(--accent)" }}>
                <Check size={14} strokeWidth={2.5} />
              </span>
            )}
            <Preview id={t.id} />
            <div className="mt-2.5 px-1 pb-0.5">
              <div className="font-semibold text-[13.5px] text-ink flex items-center gap-1.5">
                {t.name}
                {t.id === "formal" && <span className="text-[10px] font-bold uppercase tracking-[.05em] px-1.5 py-0.5 rounded-full bg-tint text-accent">Default</span>}
              </div>
              <div className="text-[11.5px] text-muted leading-snug mt-0.5">{t.tagline}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
