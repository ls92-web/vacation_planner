"use client";

import { useState } from "react";
import { Building2, Car, Check, PenLine, RotateCcw, Ticket, UtensilsCrossed, Wallet } from "lucide-react";
import { BUDGET_LEVELS, formatMoney, toBaseEur, toDisplay, type BudgetBreakdown, type BudgetLevel } from "@/lib/budget/estimate";
import { useCurrency } from "@/lib/budget/useCurrency";

const ROWS: { key: keyof Omit<BudgetBreakdown, "total">; label: string; icon: typeof Building2 }[] = [
  { key: "hotels", label: "Hotels", icon: Building2 },
  { key: "activities", label: "Activities", icon: Ticket },
  { key: "food", label: "Food", icon: UtensilsCrossed },
  { key: "transport", label: "Transport", icon: Car },
];

export function BudgetPanel({
  breakdown,
  level,
  override,
  travelers,
  nights,
  onLevel,
  onOverride,
}: {
  breakdown: BudgetBreakdown;
  level: BudgetLevel;
  override?: number | null;
  travelers: number;
  nights: number;
  onLevel: (l: BudgetLevel) => void;
  onOverride: (v: number | null) => void;
}) {
  const currency = useCurrency();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const total = typeof override === "number" ? override : breakdown.total;
  const max = Math.max(breakdown.hotels, breakdown.activities, breakdown.food, breakdown.transport, 1);

  function saveDraft() {
    // The user types in the display currency; store the override in the base unit.
    const typed = Number(draft.replace(/[^0-9.]/g, ""));
    onOverride(Number.isFinite(typed) && typed > 0 ? toBaseEur(typed, currency) : null);
    setEditing(false);
  }

  return (
    <div className="rounded-[14px] border border-line bg-surface p-3.5 vp-slide-down">
      {/* level selector */}
      <div className="flex items-center gap-1 p-0.5 rounded-[11px] bg-tint">
        {BUDGET_LEVELS.map((l) => {
          const on = l.key === level;
          return (
            <button
              key={l.key}
              onClick={() => onLevel(l.key)}
              title={l.hint}
              className="flex-1 py-1.5 rounded-[9px] text-[12.5px] font-bold cursor-pointer transition"
              style={{ background: on ? "var(--surface)" : "transparent", color: on ? "var(--accent)" : "var(--muted)", boxShadow: on ? "0 1px 4px rgba(0,0,0,.12)" : "none" }}
            >
              {l.label}
            </button>
          );
        })}
      </div>

      {/* breakdown */}
      <div className="mt-3 flex flex-col gap-2.5">
        {ROWS.map((row) => {
          const amount = breakdown[row.key];
          const Icon = row.icon;
          return (
            <div key={row.key} className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg grid place-items-center shrink-0" style={{ background: "var(--tint)", color: "var(--accent)" }}><Icon size={14} strokeWidth={2} /></span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-ink">{row.label}</span>
                  <span className="text-[12.5px] text-muted tabular-nums">{formatMoney(amount, currency)}</span>
                </div>
                <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--line)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(amount / max) * 100}%`, background: "var(--accent)" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* total + manual edit */}
      <div className="mt-3 pt-3 border-t border-line">
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-ink flex items-center gap-1.5"><Wallet size={15} strokeWidth={2} className="text-accent" />Total <span className="text-muted font-semibold">({currency.code})</span></span>
            <div className="flex-1" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveDraft(); }}
              inputMode="numeric"
              placeholder={String(Math.round(toDisplay(breakdown.total, currency)))}
              className="w-[120px] px-2.5 py-1.5 border border-line rounded-lg text-[13.5px] bg-surface outline-none vp-input text-right"
              autoFocus
            />
            <button onClick={saveDraft} className="w-8 h-8 rounded-lg bg-accent text-white grid place-items-center cursor-pointer"><Check size={15} strokeWidth={2.5} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-ink flex items-center gap-1.5"><Wallet size={15} strokeWidth={2} className="text-accent" />Total estimate</span>
            {typeof override === "number" && <span className="text-[10.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "var(--tint)", color: "var(--accent)" }}>Edited</span>}
            <div className="flex-1" />
            <span className="font-display font-bold text-[18px] text-ink tabular-nums">{formatMoney(total, currency)}</span>
            <button onClick={() => { setDraft(String(Math.round(toDisplay(total, currency)))); setEditing(true); }} title="Edit total" className="w-7 h-7 rounded-lg border border-line bg-surface text-muted grid place-items-center cursor-pointer hover:text-ink"><PenLine size={13} strokeWidth={2} /></button>
            {typeof override === "number" && <button onClick={() => onOverride(null)} title="Reset to estimate" className="w-7 h-7 rounded-lg border border-line bg-surface text-muted grid place-items-center cursor-pointer hover:text-ink"><RotateCcw size={13} strokeWidth={2} /></button>}
          </div>
        )}
        <p className="text-[11px] text-muted mt-1.5">Estimate for {travelers} traveler{travelers !== 1 ? "s" : ""} · {nights} night{nights !== 1 ? "s" : ""}. Adjust the level or edit the total.</p>
      </div>
    </div>
  );
}
