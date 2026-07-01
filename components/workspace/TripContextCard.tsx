"use client";

import { useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import type { BudgetLevel } from "@/lib/budget/estimate";
import type { TripPreferences } from "@/lib/types";
import { PREF_INTERESTS, PREF_TRAVEL_STYLES, PREF_TRAVELLER_TYPES } from "@/lib/trips/preferences";

const BUDGETS: { key: BudgetLevel; label: string }[] = [
  { key: "budget", label: "Budget" },
  { key: "standard", label: "Standard" },
  { key: "luxury", label: "Luxury" },
];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full border text-[12.5px] font-semibold cursor-pointer transition"
      style={on ? { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" } : { background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.15)", color: "rgba(255,255,255,.82)" }}
    >
      {children}
    </button>
  );
}

/**
 * The AI's natural "tell me about this trip" moment — chip-driven, tap to answer,
 * remembered only for this trip. Writes to the existing per-trip preferences +
 * budget level. Appears once when a trip is thin on context; skippable.
 */
export function TripContextCard({
  preferences,
  budgetLevel,
  onApply,
  onSkip,
}: {
  preferences: TripPreferences;
  budgetLevel: BudgetLevel;
  onApply: (patch: Partial<TripPreferences>, budget: BudgetLevel) => void;
  onSkip: () => void;
}) {
  const [traveller, setTraveller] = useState(preferences.travellerType);
  const [style, setStyle] = useState(preferences.travelStyle);
  const [budget, setBudget] = useState<BudgetLevel>(budgetLevel);
  const [interests, setInterests] = useState<string[]>(preferences.interests ?? []);

  const toggleInterest = (k: string) => setInterests((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]));
  const save = () => onApply({ travellerType: traveller, travelStyle: style, interests }, budget);

  return (
    <div className="imm-glass rounded-[18px] p-4 sm:p-5 vp-fade-fast">
      <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 rounded-full grid place-items-center shrink-0" style={{ background: "rgba(255,255,255,.08)", color: "var(--accent)" }}><Sparkles size={15} strokeWidth={2} /></span>
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold text-[15px]">A few quick things about this trip</div>
          <div className="text-[12px] text-white/55 mt-0.5">Tap what fits and I&apos;ll tailor every suggestion — remembered only for this trip.</div>
        </div>
        <button onClick={onSkip} aria-label="Skip" className="text-white/40 hover:text-white/70 cursor-pointer transition shrink-0"><X size={16} /></button>
      </div>

      <div className="mt-4 flex flex-col gap-3.5">
        <div>
          <div className="text-[11px] uppercase tracking-[.1em] text-white/45 mb-1.5">Who&apos;s travelling</div>
          <div className="flex flex-wrap gap-1.5">
            {PREF_TRAVELLER_TYPES.map((t) => <Chip key={t.key} on={traveller === t.key} onClick={() => setTraveller(traveller === t.key ? undefined : t.key)}>{t.label}</Chip>)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[.1em] text-white/45 mb-1.5">Pace</div>
          <div className="flex flex-wrap gap-1.5">
            {PREF_TRAVEL_STYLES.map((t) => <Chip key={t.key} on={style === t.key} onClick={() => setStyle(style === t.key ? undefined : t.key)}>{t.label}</Chip>)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[.1em] text-white/45 mb-1.5">Budget</div>
          <div className="flex flex-wrap gap-1.5">
            {BUDGETS.map((b) => <Chip key={b.key} on={budget === b.key} onClick={() => setBudget(b.key)}>{b.label}</Chip>)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[.1em] text-white/45 mb-1.5">Interests</div>
          <div className="flex flex-wrap gap-1.5">
            {PREF_INTERESTS.map((t) => <Chip key={t.key} on={interests.includes(t.key)} onClick={() => toggleInterest(t.key)}>{t.label}</Chip>)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[12px] bg-accent text-white text-[13.5px] font-bold cursor-pointer transition hover:brightness-[1.06]">
          <Check size={15} strokeWidth={2.4} />Save & tailor
        </button>
        <button onClick={onSkip} className="text-[13px] font-semibold text-white/50 hover:text-white/80 cursor-pointer transition">Skip for now</button>
      </div>
    </div>
  );
}
