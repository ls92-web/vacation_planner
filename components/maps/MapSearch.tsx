"use client";

import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import { useAutocomplete, useGeocode } from "@/lib/maps";
import type { LatLng } from "@/lib/maps";

/**
 * Address/place search with debounced autocomplete. On select it geocodes the
 * chosen suggestion and calls onPick with coordinates.
 */
export function MapSearch({
  value,
  onChange,
  onPick,
  placeholder = "Search address or place",
}: {
  value: string;
  onChange: (text: string) => void;
  onPick: (location: LatLng, label: string) => void;
  placeholder?: string;
}) {
  const suggestions = useAutocomplete(value);
  const geocode = useGeocode();
  const [open, setOpen] = useState(false);

  const choose = async (text: string) => {
    setOpen(false);
    onChange(text);
    const loc = await geocode(text);
    if (loc) onPick(loc, text);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border border-line rounded-[10px] bg-white pl-[11px] pr-1.5">
        <span className="text-accent shrink-0 flex">
          <MapPin size={15} strokeWidth={2} />
        </span>
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="flex-1 min-w-0 border-none outline-none py-[11px] text-[13.5px] bg-transparent text-ink"
        />
        <span className="text-muted shrink-0 flex pr-1.5">
          <Search size={14} strokeWidth={2} />
        </span>
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-surface border border-line rounded-xl shadow-lg overflow-hidden vp-pop">
          {suggestions.slice(0, 6).map((s) => (
            <button
              key={s.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s.text)}
              className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-[13px] text-ink hover:bg-tint cursor-pointer"
            >
              <span className="text-muted shrink-0 flex">
                <MapPin size={13} strokeWidth={2} />
              </span>
              <span className="truncate">{s.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
