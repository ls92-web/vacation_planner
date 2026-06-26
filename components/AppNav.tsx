"use client";

import { useTrip } from "@/lib/store";
import type { ExploreTab } from "@/lib/types";
import { Compass } from "./icons";

const NAV: { k: ExploreTab; label: string }[] = [
  { k: "explore", label: "Explore" },
  { k: "saved", label: "Saved" },
  { k: "map", label: "Map" },
  { k: "planner", label: "AI Planner" },
];

export function Brand({ label = "Barcelona", size = 28 }: { label?: string; size?: number }) {
  return (
    <div className="flex items-center gap-2.5 font-bold text-[15px] shrink-0">
      <div
        className="rounded-lg bg-accent text-white grid place-items-center"
        style={{ width: size, height: size }}
      >
        <Compass size={size === 28 ? 16 : 17} strokeWidth={2} />
      </div>
      {label}
    </div>
  );
}

/** Shared segmented pill group used on Explore and Itinerary headers. */
export function AppNav() {
  const { state, actions } = useTrip();
  const active = state.screen === "explore" ? state.exTab : state.screen === "plan" ? "planner" : null;

  return (
    <div className="flex bg-[#f0ebe3] border border-line rounded-[13px] p-1 gap-0.5 flex-nowrap">
      {NAV.map((n) => {
        const on = active === n.k;
        const badge = n.k === "saved" ? state.exSaved.length : n.k === "planner" ? state.exSelected.length : 0;
        const hasBadge =
          (n.k === "saved" && state.exSaved.length > 0) || (n.k === "planner" && state.exSelected.length > 0);
        return (
          <button
            key={n.k}
            onClick={() => actions.navPick(n.k)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[13.5px] font-bold cursor-pointer transition-all whitespace-nowrap"
            style={{
              background: on ? "#fff" : "transparent",
              color: on ? "var(--ink)" : "var(--muted)",
              boxShadow: on ? "0 1px 4px rgba(0,0,0,.1)" : "none",
            }}
          >
            {n.label}
            {hasBadge && (
              <span className="min-w-[17px] h-[17px] px-1 rounded-[9px] bg-accent text-white text-[10.5px] font-bold inline-flex items-center justify-center">
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
