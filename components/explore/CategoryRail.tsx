"use client";

import { CATEGORIES } from "@/lib/places";
import { usePlanner } from "@/lib/planner/store";

export function CategoryRail() {
  const { state, actions } = usePlanner();
  return (
    <div className="vp-scroll flex gap-2 overflow-x-auto pb-1">
      {CATEGORIES.map((c) => {
        const on = state.categoryKey === c.key && !state.search;
        return (
          <button
            key={c.key}
            onClick={() => actions.setCategory(c.key)}
            className="shrink-0 px-3.5 py-2 rounded-full border text-[13px] font-semibold cursor-pointer transition whitespace-nowrap"
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
    </div>
  );
}
