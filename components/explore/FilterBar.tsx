"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { DEFAULT_FILTERS } from "@/lib/places";
import { usePlanner } from "@/lib/planner/store";

/** A compact pill that cycles through a set of values. */
function CyclePill<T>({
  label,
  value,
  options,
  format,
  onChange,
  isDefault,
}: {
  label: string;
  value: T;
  options: T[];
  format: (v: T) => string;
  onChange: (v: T) => void;
  isDefault: boolean;
}) {
  const next = () => {
    const i = options.indexOf(value);
    onChange(options[(i + 1) % options.length]);
  };
  return (
    <button
      onClick={next}
      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border text-[12.5px] font-semibold cursor-pointer transition whitespace-nowrap"
      style={{
        borderColor: isDefault ? "var(--line)" : "var(--accent)",
        background: isDefault ? "var(--surface)" : "var(--tint)",
        color: isDefault ? "var(--muted)" : "var(--accent)",
      }}
    >
      <span className="text-muted font-medium">{label}</span>
      {format(value)}
    </button>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 px-3 py-1.5 rounded-[10px] border text-[12.5px] font-semibold cursor-pointer transition whitespace-nowrap"
      style={{
        borderColor: on ? "var(--accent)" : "var(--line)",
        background: on ? "var(--accent)" : "var(--surface)",
        color: on ? "#fff" : "var(--muted)",
      }}
    >
      {label}
    </button>
  );
}

export function FilterBar() {
  const { state, actions } = usePlanner();
  const f = state.filters;
  const dirty = JSON.stringify(f) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="vp-scroll flex items-center gap-2 overflow-x-auto">
      <span className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-bold text-muted pr-1">
        <SlidersHorizontal size={15} strokeWidth={2} />
        Filters
      </span>

      <CyclePill
        label="Rating"
        value={f.minRating}
        options={[0, 4, 4.5]}
        format={(v) => (v === 0 ? "Any" : `${v}+`)}
        onChange={(v) => actions.setFilter({ minRating: v })}
        isDefault={f.minRating === 0}
      />
      <CyclePill
        label="Price"
        value={f.maxPrice}
        options={[4, 1, 2, 3]}
        format={(v) => (v === 4 ? "Any" : "€".repeat(v) + " or less")}
        onChange={(v) => actions.setFilter({ maxPrice: v })}
        isDefault={f.maxPrice === 4}
      />
      <CyclePill
        label="Cost"
        value={f.free}
        options={["any", "free", "paid"] as const}
        format={(v) => (v === "any" ? "Any" : v === "free" ? "Free" : "Paid")}
        onChange={(v) => actions.setFilter({ free: v })}
        isDefault={f.free === "any"}
      />
      <CyclePill
        label="Setting"
        value={f.env}
        options={["any", "indoor", "outdoor"] as const}
        format={(v) => (v === "any" ? "Any" : v === "indoor" ? "Indoor" : "Outdoor")}
        onChange={(v) => actions.setFilter({ env: v })}
        isDefault={f.env === "any"}
      />
      <CyclePill
        label="Visit"
        value={f.duration}
        options={["any", "short", "half", "full"] as const}
        format={(v) => (v === "any" ? "Any" : v === "short" ? "< 1 hr" : v === "half" ? "Half-day" : "Full-day")}
        onChange={(v) => actions.setFilter({ duration: v })}
        isDefault={f.duration === "any"}
      />
      <CyclePill
        label="Distance"
        value={f.maxDistanceKm}
        options={[0, 2, 5]}
        format={(v) => (v === 0 ? "Any" : `< ${v} km`)}
        onChange={(v) => actions.setFilter({ maxDistanceKm: v })}
        isDefault={f.maxDistanceKm === 0}
      />
      <Toggle label="Open now" on={f.openNow} onClick={() => actions.setFilter({ openNow: !f.openNow })} />
      <Toggle label="Family friendly" on={f.family} onClick={() => actions.setFilter({ family: !f.family })} />
      <Toggle label="Wheelchair" on={f.wheelchair} onClick={() => actions.setFilter({ wheelchair: !f.wheelchair })} />

      {dirty && (
        <button
          onClick={actions.resetFilters}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 border-none bg-transparent text-accent text-[12.5px] font-bold cursor-pointer"
        >
          <X size={13} strokeWidth={2} />
          Clear
        </button>
      )}
    </div>
  );
}
