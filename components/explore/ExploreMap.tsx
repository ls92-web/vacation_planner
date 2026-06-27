"use client";

import { GoogleMap, MapInfoCard, PlaceMarkers } from "@/components/maps";
import type { MapMarker } from "@/lib/maps";
import type { ExplorePlace } from "@/lib/places";
import { usePlanner } from "@/lib/planner/store";

function toMarker(p: ExplorePlace): MapMarker {
  const food = p.category === "restaurants" || p.category === "cafes" || p.category === "breakfast";
  return {
    id: p.id,
    name: p.name,
    kind: food ? "restaurant" : "attraction",
    position: p.position,
    category: p.category,
    rating: p.rating,
  };
}

/** Map synced to the explore grid: hover/select highlights, click opens an info card. */
export function ExploreMap({ places }: { places: ExplorePlace[] }) {
  const { state, actions } = usePlanner();
  const markers = places.map(toMarker);
  const activeId = state.hoveredId ?? state.selectedId;
  const selected = places.find((p) => p.id === state.selectedId);
  const selMarker = selected ? toMarker(selected) : null;

  return (
    <GoogleMap
      center={state.center}
      zoom={13}
      className="absolute inset-0 h-full w-full"
      fallback={
        <div className="absolute inset-0 grid place-items-center bg-[#eef3ec] text-muted text-[13px] px-6 text-center">
          Add a Google Maps key to see places on the map.
        </div>
      }
    >
      <PlaceMarkers markers={markers} selectedId={activeId} onSelect={(id) => actions.setSelected(id)} />
      {selMarker && <MapInfoCard marker={selMarker} onClose={() => actions.setSelected(null)} />}
    </GoogleMap>
  );
}
