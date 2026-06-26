"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { BedDouble, Camera, MapPin, Utensils } from "lucide-react";
import { MARKER_STYLES } from "@/lib/maps";
import type { MapMarker, MarkerKind } from "@/lib/maps";

function Glyph({ kind, size = 15 }: { kind: MarkerKind; size?: number }) {
  const common = { size, strokeWidth: 2.2, color: "#fff" as const };
  if (kind === "hotel") return <BedDouble {...common} />;
  if (kind === "restaurant") return <Utensils {...common} />;
  if (kind === "attraction") return <Camera {...common} />;
  return <MapPin {...common} />;
}

/** A single teardrop pin with an elegant hover/active micro-interaction. */
export function MarkerPin({
  marker,
  selected,
  onSelect,
}: {
  marker: MapMarker;
  selected?: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const style = MARKER_STYLES[selected ? "active" : marker.kind];
  return (
    <AdvancedMarker
      position={marker.position}
      onClick={() => onSelect?.(marker.id)}
      zIndex={selected ? 50 : 1}
      title={marker.name}
    >
      <div
        className="vp-marker"
        data-selected={selected ? "true" : "false"}
        style={{ background: style.bg, boxShadow: `0 0 0 2px ${style.ring}, 0 6px 14px -4px rgba(0,0,0,.45)` }}
      >
        <span className="vp-marker-glyph">
          <Glyph kind={marker.kind} />
        </span>
      </div>
    </AdvancedMarker>
  );
}

function pins(markers: MapMarker[], selectedId?: string | null, onSelect?: (id: string | null) => void) {
  return markers.map((m) => <MarkerPin key={m.id} marker={m} selected={selectedId === m.id} onSelect={onSelect} />);
}

export function DestinationMarkers(props: { markers: MapMarker[]; selectedId?: string | null; onSelect?: (id: string | null) => void }) {
  return <>{pins(props.markers, props.selectedId, props.onSelect)}</>;
}

export function HotelMarkers(props: { markers: MapMarker[]; selectedId?: string | null; onSelect?: (id: string | null) => void }) {
  return <>{pins(props.markers, props.selectedId, props.onSelect)}</>;
}

export function PlaceMarkers(props: { markers: MapMarker[]; selectedId?: string | null; onSelect?: (id: string | null) => void }) {
  return <>{pins(props.markers, props.selectedId, props.onSelect)}</>;
}
