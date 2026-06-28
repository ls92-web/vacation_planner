"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const acctInput =
  "w-full px-3.5 py-2.5 border border-line rounded-[11px] text-[14px] bg-surface text-ink outline-none vp-input";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-[12.5px] font-semibold text-ink">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="text-[11.5px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

export function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${acctInput} appearance-none cursor-pointer pr-9`}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={15} strokeWidth={2} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>
  );
}

export function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="px-3.5 py-2 rounded-[10px] border text-[13px] font-semibold cursor-pointer transition"
            style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent)" : "var(--surface)", color: on ? "#fff" : "var(--muted)" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13.5px] text-ink">{label}</span>
      <button type="button" onClick={() => onChange(!on)} className="w-[44px] h-[26px] rounded-full transition relative cursor-pointer shrink-0" style={{ background: on ? "var(--accent)" : "var(--line)" }} aria-pressed={on} aria-label={label}>
        <span className="absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white transition-all" style={{ left: on ? 21 : 3, boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
      </button>
    </div>
  );
}

/** A rounded settings card that saves independently with a success animation. */
export function SettingCard({
  icon: Icon,
  title,
  description,
  dirty,
  onSave,
  saveLabel = "Save changes",
  children,
  danger,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  dirty?: boolean;
  onSave?: () => Promise<boolean>;
  saveLabel?: string;
  children: ReactNode;
  danger?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    const ok = await onSave();
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    }
  }

  return (
    <section
      className="rounded-[18px] border bg-surface p-5 sm:p-6"
      style={{ borderColor: danger ? "color-mix(in oklab, #b3402f 45%, var(--line))" : "var(--line)", boxShadow: "0 6px 24px -18px rgba(0,0,0,.3)" }}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="w-9 h-9 rounded-[11px] grid place-items-center shrink-0" style={{ background: danger ? "#f7e7e3" : "var(--tint)", color: danger ? "#b3402f" : "var(--accent)" }}>
            <Icon size={17} strokeWidth={2} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-bold text-[16px] tracking-[-.01em]" style={{ color: danger ? "#b3402f" : "var(--ink)" }}>{title}</h3>
          {description && <p className="text-[13px] text-muted mt-0.5 leading-snug">{description}</p>}
        </div>
      </div>

      <div className="mt-4">{children}</div>

      {onSave && (
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[11px] bg-accent text-white text-[13.5px] font-bold cursor-pointer transition hover:brightness-[1.06] disabled:opacity-50 disabled:cursor-default"
          >
            {saving ? <Loader2 size={15} className="vp-spin" /> : null}{saveLabel}
          </button>
          {saved ? (
            <span className="vp-pop inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--color-ok)" }}><Check size={14} strokeWidth={2.5} />Saved successfully</span>
          ) : dirty ? (
            <span className="text-[12px] text-muted">Unsaved changes</span>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display font-bold text-[clamp(24px,3vw,32px)] tracking-[-.02em]">{title}</h1>
      <p className="text-muted text-[14.5px] mt-1.5">{subtitle}</p>
    </div>
  );
}
