"use client";

import { useEffect, type ReactNode } from "react";
import {
  Map as GMap,
  useMap,
  useApiLoadingStatus,
  APILoadingStatus,
} from "@vis.gl/react-google-maps";
import { isMapsConfigured, mapsConfig } from "@/lib/maps";
import type { LatLng } from "@/lib/maps";
import { MapSkeleton } from "./MapSkeleton";

interface GoogleMapProps {
  center: LatLng;
  zoom?: number;
  children?: ReactNode;
  className?: string;
  /** Rendered instead of the live map when no API key is configured. */
  fallback?: ReactNode;
  /** Background-atmosphere mode: no controls, no gestures, non-interactive. */
  atmospheric?: boolean;
}

/** Smoothly re-centers the map whenever `center` changes. */
function Recenter({ center, zoom }: { center: LatLng; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.panTo(center);
    if (zoom != null) map.setZoom(zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, center.lat, center.lng]);
  return null;
}

function LoadingOverlay() {
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.LOADED) return null;
  if (status === APILoadingStatus.FAILED) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#eef3ec] text-[13px] text-muted text-center px-6">
        Map failed to load. Check the API key and that the required Google APIs are enabled.
      </div>
    );
  }
  return <MapSkeleton />;
}

/**
 * Reusable interactive Google Map. Must be rendered inside <MapsApiProvider>.
 * Falls back to `fallback` when no key is configured. Children (markers, overlays)
 * use the vis.gl map context.
 */
export function GoogleMap({ center, zoom = mapsConfig.defaultZoom, children, className, fallback, atmospheric = false }: GoogleMapProps) {
  if (!isMapsConfigured()) return <>{fallback ?? null}</>;

  return (
    <div className={`relative ${className ?? ""}`}>
      <GMap
        mapId={mapsConfig.mapId}
        defaultCenter={center}
        defaultZoom={zoom}
        gestureHandling={atmospheric ? "none" : "greedy"}
        disableDefaultUI={atmospheric}
        zoomControl={!atmospheric}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        keyboardShortcuts={atmospheric ? false : undefined}
        clickableIcons={atmospheric ? false : undefined}
        className="absolute inset-0 h-full w-full"
        style={{ width: "100%", height: "100%" }}
      >
        <Recenter center={center} zoom={zoom} />
        {children}
      </GMap>
      <LoadingOverlay />
    </div>
  );
}
