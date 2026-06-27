"use client";

import { Star, X } from "lucide-react";
import { formatDurationMin, formatKm, haversineKm, type ExplorePlace } from "@/lib/places";
import { usePlanner } from "@/lib/planner/store";

function price(level?: number) {
  if (level == null) return "—";
  return level === 0 ? "Free" : "€".repeat(level);
}

/** Side-by-side comparison of up to 3 places (resolved from the provided pool). */
export function CompareTray({ pool }: { pool: ExplorePlace[] }) {
  const { state, actions } = usePlanner();
  if (state.compare.length < 1) return null;
  const places = state.compare.map((id) => pool.find((p) => p.id === id)).filter((p): p is ExplorePlace => !!p);
  if (!places.length) return null;

  const rows: { label: string; get: (p: ExplorePlace) => string }[] = [
    { label: "Rating", get: (p) => (p.rating != null ? `${p.rating.toFixed(1)}${p.reviews ? ` (${p.reviews.toLocaleString()})` : ""}` : "—") },
    { label: "Price", get: (p) => price(p.priceLevel) },
    { label: "Visit", get: (p) => formatDurationMin(p.estDurationMin) },
    { label: "From hotel", get: (p) => formatKm(haversineKm(state.center, p.position), state.units) },
    { label: "Open now", get: (p) => (p.openNow == null ? "—" : p.openNow ? "Open" : "Closed") },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] px-3 pb-3 pointer-events-none">
      <div className="pointer-events-auto max-w-[920px] mx-auto bg-surface border border-line rounded-[18px] shadow-[0_18px_50px_-16px_rgba(0,0,0,.4)] overflow-hidden vp-slide-up">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
          <div className="font-display font-bold text-[14px]">Compare ({places.length})</div>
          <button onClick={actions.clearCompare} className="text-[12.5px] font-bold text-accent cursor-pointer border-none bg-transparent">Clear all</button>
        </div>
        <div className="overflow-x-auto vp-scroll">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className="text-left p-3 font-semibold text-muted w-[110px]"></th>
                {places.map((p) => (
                  <th key={p.id} className="text-left p-3 min-w-[150px]">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display font-bold text-[13.5px] text-ink leading-tight">{p.name}</span>
                      <button onClick={() => actions.toggleCompare(p.id)} className="text-muted hover:text-ink cursor-pointer border-none bg-transparent shrink-0">
                        <X size={14} strokeWidth={2} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-line">
                  <td className="p-3 text-muted font-semibold">{r.label}</td>
                  {places.map((p) => (
                    <td key={p.id} className="p-3 text-ink">
                      {r.label === "Rating" && p.rating != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Star size={11} fill="#e0a44f" stroke="none" />
                          {r.get(p)}
                        </span>
                      ) : (
                        r.get(p)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
