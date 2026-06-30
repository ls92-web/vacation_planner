"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CATEGORIES } from "@/lib/places";
import { usePlanner } from "@/lib/planner/store";

// Show the most-used categories inline; the rest live behind "More" so the rail
// stays a tidy wrapped row instead of a horizontal scroll strip.
const TOP_COUNT = 7;

export function CategoryRail() {
  const { state, actions } = usePlanner();
  const [expanded, setExpanded] = useState(false);
  const activeKey = state.search ? "" : state.categoryKey;

  // Collapsed view = the top categories, plus the active one if it lives further down.
  const visible = expanded
    ? CATEGORIES
    : CATEGORIES.filter((c, i) => i < TOP_COUNT || c.key === activeKey);
  const hiddenCount = CATEGORIES.length - CATEGORIES.filter((c, i) => i < TOP_COUNT).length;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {visible.map((c) => {
        const on = activeKey === c.key;
        return (
          <button
            key={c.key}
            onClick={() => { actions.setCategory(c.key); setExpanded(false); }}
            className="px-3.5 py-2 rounded-full border text-[13px] font-semibold cursor-pointer transition whitespace-nowrap"
            style={{
              borderColor: on ? "var(--accent)" : "var(--line)",
              background: on ? "var(--accent)" : "var(--surface)",
              color: on ? "#fff" : "var(--ink)",
            }}
          >
            {c.label}
          </button>
        );
      })}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full border border-dashed text-[13px] font-semibold cursor-pointer transition whitespace-nowrap text-accent"
          style={{ borderColor: "color-mix(in oklab, var(--accent) 45%, var(--line))", background: "var(--surface)" }}
        >
          {expanded ? <>Show less <ChevronUp size={14} strokeWidth={2.2} /></> : <>More <span className="text-muted font-bold">+{hiddenCount}</span> <ChevronDown size={14} strokeWidth={2.2} /></>}
        </button>
      )}
    </div>
  );
}
