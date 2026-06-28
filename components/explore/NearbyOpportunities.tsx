"use client";

import { useMemo, useState } from "react";
import { Plus, Sparkle, Star } from "lucide-react";
import { isMapsConfigured, type LatLng } from "@/lib/maps";
import { formatKm, haversineKm, useNearby, type ItineraryItem, type Slot } from "@/lib/places";
import { inItinerary, usePlanner } from "@/lib/planner/store";

interface Opp {
  key: string;
  label: string;
  includedTypes: string[];
  categoryKey: string;
  slot: Slot;
}

const OPPORTUNITIES: Opp[] = [
  { key: "coffee", label: "Coffee", includedTypes: ["cafe", "coffee_shop"], categoryKey: "cafes", slot: "afternoon" },
  { key: "dessert", label: "Dessert", includedTypes: ["bakery", "ice_cream_shop", "dessert_shop"], categoryKey: "cafes", slot: "afternoon" },
  { key: "photo", label: "Photo Spot", includedTypes: ["tourist_attraction"], categoryKey: "viewpoints", slot: "evening" },
  { key: "market", label: "Local Market", includedTypes: ["market", "grocery_store"], categoryKey: "shopping", slot: "morning" },
  { key: "playground", label: "Playground", includedTypes: ["playground", "park"], categoryKey: "kids", slot: "afternoon" },
  { key: "gem", label: "Hidden Gem", includedTypes: ["tourist_attraction", "point_of_interest"], categoryKey: "hidden", slot: "afternoon" },
];

/**
 * Real Places suggestions for one destination — never auto-added; the user chooses.
 * Scoped to a destination (its center + items) so it works inside the grouped planner.
 */
export function NearbyOpportunities({
  destId,
  center,
  items,
  day,
  units = "km",
}: {
  destId: string;
  center: LatLng;
  items: ItineraryItem[];
  day: number;
  units?: "km" | "mi";
}) {
  const { state, actions } = usePlanner();
  const [oppKey, setOppKey] = useState("coffee");
  const opp = OPPORTUNITIES.find((o) => o.key === oppKey)!;

  // Bias the search toward the destination's planned stops, falling back to its center.
  const searchCenter = useMemo(() => {
    if (!items.length) return center;
    const lat = items.reduce((s, it) => s + it.place.position.lat, 0) / items.length;
    const lng = items.reduce((s, it) => s + it.place.position.lng, 0) / items.length;
    return { lat, lng };
  }, [items, center]);

  const { places, loading } = useNearby({ center: searchCenter, includedTypes: opp.includedTypes, categoryKey: opp.categoryKey, enabled: isMapsConfigured() });
  const suggestions = places.filter((p) => !inItinerary(state, p.id)).slice(0, 3);

  if (!isMapsConfigured()) return null;

  return (
    <div className="bg-surface border border-line rounded-[18px] p-4">
      <div className="flex items-center gap-1.5 font-display font-bold text-[15px]">
        <span className="text-accent flex"><Sparkle size={16} strokeWidth={1.7} /></span>
        Nearby in {destId}
      </div>
      <div className="text-[12px] text-muted mt-0.5">Real spots near your {destId} stops — add any you like.</div>

      <div className="vp-scroll flex gap-1.5 overflow-x-auto mt-3 pb-1">
        {OPPORTUNITIES.map((o) => {
          const on = o.key === oppKey;
          return (
            <button
              key={o.key}
              onClick={() => setOppKey(o.key)}
              className="shrink-0 px-2.5 py-1.5 rounded-full border text-[12px] font-semibold cursor-pointer transition whitespace-nowrap"
              style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent)" : "#fff", color: on ? "#fff" : "var(--muted)" }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {loading && Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-[52px] rounded-xl border border-line vp-shimmer" />)}
        {!loading && suggestions.length === 0 && <div className="text-[12px] text-muted py-2">No {opp.label.toLowerCase()} found nearby.</div>}
        {!loading &&
          suggestions.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-line bg-white">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13px] truncate">{p.name}</div>
                <div className="text-[11.5px] text-muted flex items-center gap-2 mt-0.5">
                  {p.rating != null && (
                    <span className="inline-flex items-center gap-1" style={{ color: "#e0a44f" }}>
                      <Star size={11} fill="currentColor" stroke="none" />
                      <span className="text-ink font-semibold">{p.rating.toFixed(1)}</span>
                    </span>
                  )}
                  <span>{formatKm(haversineKm(searchCenter, p.position), units)} away</span>
                </div>
              </div>
              <button
                onClick={() => actions.addPlaceTo(p, destId, day, opp.slot)}
                title={`Add to ${destId}`}
                className="shrink-0 w-[30px] h-[30px] rounded-lg border border-accent bg-white text-accent grid place-items-center cursor-pointer hover:bg-tint"
              >
                <Plus size={15} strokeWidth={2.5} />
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
