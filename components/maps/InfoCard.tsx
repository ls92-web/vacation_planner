"use client";

import { InfoWindow } from "@vis.gl/react-google-maps";
import { Check, ExternalLink, Plus, Star } from "lucide-react";
import { placeLink } from "@/lib/maps";
import type { MapMarker } from "@/lib/maps";

/** Modern info card shown when a marker is selected. */
export function MapInfoCard({
  marker,
  onClose,
  onAdd,
  added,
}: {
  marker: MapMarker;
  onClose: () => void;
  onAdd?: (marker: MapMarker) => void;
  added?: boolean;
}) {
  return (
    <InfoWindow position={marker.position} onCloseClick={onClose} headerDisabled pixelOffset={[0, -38]}>
      <div className="w-[208px] font-body">
        <div className="font-display font-bold text-[14.5px] text-ink leading-tight">{marker.name}</div>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-muted">
          {marker.category && <span>{marker.category}</span>}
          {marker.rating != null && (
            <span className="inline-flex items-center gap-1" style={{ color: "#e0a44f" }}>
              <Star size={12} fill="currentColor" stroke="none" />
              <span className="text-ink font-semibold">{marker.rating.toFixed(1)}</span>
            </span>
          )}
        </div>
        {marker.subtitle && <div className="mt-1 text-[11.5px] text-muted leading-snug">{marker.subtitle}</div>}
        <a
          href={placeLink({ name: marker.name, position: marker.position })}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-accent hover:underline"
        >
          <ExternalLink size={12} strokeWidth={2} />
          Open in Google Maps
        </a>
        {onAdd && (
          <button
            onClick={() => onAdd(marker)}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[12px] font-bold cursor-pointer transition"
            style={{
              borderColor: "var(--accent)",
              background: added ? "var(--accent)" : "#fff",
              color: added ? "#fff" : "var(--accent)",
            }}
          >
            {added ? <Check size={13} strokeWidth={2.5} /> : <Plus size={13} strokeWidth={2.5} />}
            {added ? "Added to trip" : "Add to trip"}
          </button>
        )}
      </div>
    </InfoWindow>
  );
}
