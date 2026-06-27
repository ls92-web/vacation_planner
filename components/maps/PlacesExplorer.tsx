"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Plus, Star } from "lucide-react";
import { PLACE_CATEGORIES, placeLink, usePlacesSearch } from "@/lib/maps";
import type { LatLng, PlaceCategory, PlaceResult } from "@/lib/maps";

/**
 * Browse nearby places (Google Places) by category and add them to the trip.
 * Results are cached/de-duplicated by the search hook.
 */
export function PlacesExplorer({
  center,
  onAdd,
  addedIds = [],
  onHover,
}: {
  center: LatLng;
  onAdd: (place: PlaceResult) => void;
  addedIds?: string[];
  onHover?: (place: PlaceResult | null) => void;
}) {
  const { results, loading, error, search, ready } = usePlacesSearch();
  const [category, setCategory] = useState<PlaceCategory>("Attractions");

  useEffect(() => {
    if (ready) search(category, center);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, category, center.lat, center.lng]);

  return (
    <div className="flex flex-col gap-3">
      <div className="vp-scroll flex gap-1.5 overflow-x-auto pb-0.5">
        {PLACE_CATEGORIES.map((c) => {
          const on = category === c;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="shrink-0 px-3 py-1.5 rounded-[9px] border text-[12.5px] font-semibold cursor-pointer transition whitespace-nowrap"
              style={{
                borderColor: on ? "var(--accent)" : "var(--line)",
                background: on ? "var(--accent)" : "#fff",
                color: on ? "#fff" : "var(--muted)",
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto vp-scroll">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[58px] rounded-xl border border-line vp-shimmer" />
          ))}

        {!loading && error && (
          <div className="text-[12.5px] text-muted px-1 py-3">Couldn&apos;t load nearby places. Try again.</div>
        )}

        {!loading && !error && results.length === 0 && (
          <div className="text-[12.5px] text-muted px-1 py-3">No {category.toLowerCase()} found nearby.</div>
        )}

        {!loading &&
          results.map((p) => {
            const added = addedIds.includes(p.id);
            return (
              <div
                key={p.id}
                onMouseEnter={() => onHover?.(p)}
                onMouseLeave={() => onHover?.(null)}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-line bg-surface"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] text-ink truncate">{p.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-muted">
                    {p.rating != null && (
                      <span className="inline-flex items-center gap-1" style={{ color: "#e0a44f" }}>
                        <Star size={11} fill="currentColor" stroke="none" />
                        <span className="text-ink font-semibold">{p.rating.toFixed(1)}</span>
                      </span>
                    )}
                    {p.address && <span className="truncate">{p.address}</span>}
                  </div>
                </div>
                <a
                  href={placeLink({ name: p.name, position: p.position, placeId: p.id })}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in Google Maps"
                  className="shrink-0 w-[30px] h-[30px] rounded-lg border border-line bg-white text-muted grid place-items-center cursor-pointer transition hover:border-accent hover:text-accent"
                >
                  <ExternalLink size={14} strokeWidth={2} />
                </a>
                <button
                  onClick={() => onAdd(p)}
                  title={added ? "Added" : "Add to trip"}
                  className="shrink-0 w-[30px] h-[30px] rounded-lg border grid place-items-center cursor-pointer transition"
                  style={{
                    borderColor: "var(--accent)",
                    background: added ? "var(--accent)" : "#fff",
                    color: added ? "#fff" : "var(--accent)",
                  }}
                >
                  {added ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
