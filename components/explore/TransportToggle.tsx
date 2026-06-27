"use client";

import { Car, Footprints, TrainFront } from "lucide-react";
import { TRANSPORT_MODES, type TransportMode } from "@/lib/planner/travel";
import { usePlanner } from "@/lib/planner/store";

const ICON: Record<TransportMode, typeof Car> = { walk: Footprints, drive: Car, transit: TrainFront };
const SHORT: Record<TransportMode, string> = { walk: "Walk", drive: "Drive", transit: "Transit" };

export function TransportToggle() {
  const { state, actions } = usePlanner();
  return (
    <div className="flex bg-surface border border-line rounded-[12px] p-1 gap-0.5">
      {TRANSPORT_MODES.map((m) => {
        const Icon = ICON[m];
        const on = state.transportMode === m;
        return (
          <button
            key={m}
            onClick={() => actions.setTransportMode(m)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12.5px] font-bold cursor-pointer transition"
            style={{ background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--muted)" }}
          >
            <Icon size={15} strokeWidth={2} />
            {SHORT[m]}
          </button>
        );
      })}
    </div>
  );
}
