"use client";

import { useState } from "react";
import {
  Check,
  Clock,
  GitCompare,
  Heart,
  MapPin,
  Plus,
  Star,
  Sun,
  CloudSun,
  Moon,
} from "lucide-react";
import { EX_THUMBS } from "@/lib/data";
import { placeLink } from "@/lib/maps";
import { OpenInMapsButton } from "@/components/maps";
import { formatDurationMin, formatKm, recommendedTimeLabel, SLOTS, SLOT_LABELS, type ExplorePlace, type Slot } from "@/lib/places";
import { inItinerary, isFavorite, usePlanner } from "@/lib/planner/store";

const SLOT_ICON: Record<Slot, typeof Sun> = { morning: Sun, afternoon: CloudSun, evening: Moon };

function priceLabel(level?: number): string | null {
  if (level == null) return null;
  if (level === 0) return "Free";
  return "€".repeat(level);
}

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  "Must Visit": { bg: "var(--accent)", color: "#fff" },
  "Hidden Gem": { bg: "#7a5a9e", color: "#fff" },
  "Local Favorite": { bg: "#3f7a5a", color: "#fff" },
  "Family Friendly": { bg: "#E4F4F2", color: "#0A7A76" },
  "Great for Sunset": { bg: "#f8ead9", color: "#9a6512" },
  "Rainy Day": { bg: "#e6eef5", color: "#3f5e8a" },
  Foodie: { bg: "#fbe9e2", color: "#b8542f" },
  Shopping: { bg: "#f0ece4", color: "#6b5e4f" },
  Historic: { bg: "#efe7dd", color: "#7a6a4f" },
  "Photo Spot": { bg: "#e9f3f1", color: "#16767e" },
  Free: { bg: "#E4F4F2", color: "#0A7A76" },
};

function chip(tag: string) {
  return TAG_STYLES[tag] ?? { bg: "#f0ece4", color: "var(--muted)" };
}

export function PlaceCard({
  place,
  distanceKm,
  index,
}: {
  place: ExplorePlace;
  distanceKm?: number | null;
  index: number;
}) {
  const { state, actions } = usePlanner();
  const [menuOpen, setMenuOpen] = useState(false);
  const fav = isFavorite(state, place.id);
  const added = inItinerary(state, place.id);
  const comparing = state.compare.includes(place.id);
  const price = priceLabel(place.priceLevel);
  const thumb = EX_THUMBS[index % EX_THUMBS.length];

  return (
    <div
      onMouseEnter={() => actions.setHovered(place.id)}
      onMouseLeave={() => actions.setHovered(null)}
      onClick={() => actions.setSelected(place.id)}
      className="group bg-surface border rounded-[18px] overflow-hidden flex flex-col vp-fade-fast transition-all duration-200 hover:-translate-y-1 cursor-pointer"
      style={{
        borderColor: state.selectedId === place.id ? "var(--accent)" : "var(--line)",
        boxShadow: "0 4px 18px -10px rgba(0,0,0,.14)",
      }}
    >
      {/* image */}
      <div className="h-[170px] relative shrink-0 overflow-hidden" style={{ background: thumb }}>
        {place.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.photoUrl}
            alt={place.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        )}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent" />
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 max-w-[78%]">
          {place.tags.slice(0, 2).map((t) => {
            const s = chip(t);
            return (
              <span key={t} className="px-2 py-1 rounded-lg text-[11px] font-bold backdrop-blur-sm" style={{ background: s.bg, color: s.color }}>
                {t}
              </span>
            );
          })}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); actions.toggleFavorite(place); }}
          title={fav ? "Remove favorite" : "Save to favorites"}
          className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full border-none bg-white/90 grid place-items-center cursor-pointer backdrop-blur-sm transition hover:bg-white hover:scale-105"
          style={{ color: fav ? "var(--accent2)" : "var(--muted)" }}
        >
          <Heart size={17} strokeWidth={2} fill={fav ? "currentColor" : "none"} />
        </button>
        {place.openNow != null && (
          <span
            className="absolute bottom-2.5 left-2.5 px-2 py-1 rounded-lg text-[11px] font-bold backdrop-blur-sm"
            style={{ background: place.openNow ? "#E4F4F2" : "#f7e4e2", color: place.openNow ? "#0A7A76" : "#9e3c37" }}
          >
            {place.openNow ? "Open now" : "Closed"}
          </span>
        )}
      </div>

      {/* body */}
      <div className="px-4 py-3.5 flex flex-col flex-1">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-[17px] leading-[1.15] tracking-[-.01em] truncate">{place.name}</div>
            <div className="text-[12px] text-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
              {place.rating != null && (
                <span className="inline-flex items-center gap-1" style={{ color: "#e0a44f" }}>
                  <Star size={12} fill="currentColor" stroke="none" />
                  <span className="text-ink font-semibold">{place.rating.toFixed(1)}</span>
                </span>
              )}
              {place.reviews != null && <span>({place.reviews.toLocaleString()})</span>}
              {price && <span>· {price}</span>}
            </div>
          </div>
        </div>

        {place.description && <p className="text-[12.5px] text-muted leading-[1.5] mt-2 line-clamp-2">{place.description}</p>}

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink bg-[#f7f3ec] border border-line px-2 py-1 rounded-lg">
            <Clock size={12} strokeWidth={2} className="text-accent" />{formatDurationMin(place.estDurationMin)}
          </span>
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink bg-[#f7f3ec] border border-line px-2 py-1 rounded-lg">
            {recommendedTimeLabel(place.recommendedSlot)}
          </span>
          {distanceKm != null && (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink bg-[#f7f3ec] border border-line px-2 py-1 rounded-lg">
              <MapPin size={12} strokeWidth={2} className="text-accent" />{formatKm(distanceKm, state.units)} from hotel
            </span>
          )}
        </div>

        {place.address && <div className="mt-2 text-[11.5px] text-muted truncate">{place.address}</div>}

        {/* actions */}
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-[9px] border-[1.5px] border-accent rounded-[10px] text-[13px] font-bold cursor-pointer transition"
              style={{ background: added ? "var(--accent)" : "#fff", color: added ? "#fff" : "var(--accent)" }}
            >
              {added ? <Check size={15} strokeWidth={2} /> : <Plus size={15} strokeWidth={2} />}
              {added ? "In your plan" : "Add to plan"}
            </button>
            {menuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute z-30 left-0 right-0 bottom-[calc(100%+6px)] bg-surface border border-line rounded-xl shadow-lg p-2.5 vp-pop"
              >
                <div className="text-[11px] font-bold uppercase tracking-[.04em] text-muted px-1 mb-1.5">Add to day</div>
                <div className="flex gap-1.5 mb-2">
                  {Array.from({ length: state.dayCount }).map((_, d) => (
                    <button
                      key={d}
                      onClick={() => actions.setDay(d)}
                      className="flex-1 py-1 rounded-md border text-[11.5px] font-bold cursor-pointer"
                      style={{ borderColor: state.day === d ? "var(--accent)" : "var(--line)", background: state.day === d ? "var(--accent)" : "#fff", color: state.day === d ? "#fff" : "var(--muted)" }}
                    >
                      Day {d + 1}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  {SLOTS.map((slot) => {
                    const Icon = SLOT_ICON[slot];
                    const suggested = place.recommendedSlot === slot;
                    return (
                      <button
                        key={slot}
                        onClick={() => { actions.addToItinerary(place, state.day, slot); setMenuOpen(false); }}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-line bg-white text-[12.5px] font-semibold cursor-pointer hover:border-accent hover:bg-tint text-left"
                      >
                        <Icon size={14} strokeWidth={2} className="text-accent" />
                        {SLOT_LABELS[slot]}
                        {suggested && <span className="ml-auto text-[10.5px] font-bold text-accent">Suggested</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); actions.toggleCompare(place.id); }}
            title="Compare"
            className="shrink-0 w-[38px] h-[38px] rounded-[10px] border grid place-items-center cursor-pointer transition"
            style={{ borderColor: comparing ? "var(--accent)" : "var(--line)", background: comparing ? "var(--tint)" : "#fff", color: comparing ? "var(--accent)" : "var(--muted)" }}
          >
            <GitCompare size={16} strokeWidth={2} />
          </button>
        </div>
        <OpenInMapsButton
          href={placeLink({ name: place.name, position: place.position, placeId: place.source === "google" ? place.id : null })}
          label="View on Google Maps"
          size="sm"
          className="mt-2 w-full"
        />
      </div>
    </div>
  );
}
