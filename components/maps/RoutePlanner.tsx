"use client";

import { useEffect, useRef, useState } from "react";
import { Navigation } from "lucide-react";
import { fetchRoute, formatDistance, formatDuration } from "@/lib/maps";
import type { LatLng, RouteResult, TravelMode } from "@/lib/maps";
import { DirectionsOverlay } from "./DirectionsOverlay";

/**
 * Computes and draws a route through ordered waypoints (Routes API via proxy).
 * Renders the polyline on the map and, optionally, a floating distance/time chip.
 * Recomputes automatically whenever the waypoints change.
 */
export function RoutePlanner({
  waypoints,
  travelMode = "DRIVE",
  units = "km",
  showSummary = true,
  onRoute,
}: {
  waypoints: LatLng[];
  travelMode?: TravelMode;
  units?: "km" | "mi";
  showSummary?: boolean;
  onRoute?: (route: RouteResult | null) => void;
}) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;

  const key = waypoints.map((w) => `${w.lat.toFixed(5)},${w.lng.toFixed(5)}`).join("|");

  useEffect(() => {
    if (waypoints.length < 2) {
      setRoute(null);
      onRouteRef.current?.(null);
      return;
    }
    let cancelled = false;
    const pts = [...waypoints];
    const origin = pts.shift()!;
    const destination = pts.pop()!;
    fetchRoute(origin, destination, { intermediates: pts, travelMode }).then((r) => {
      if (cancelled) return;
      setRoute(r);
      onRouteRef.current?.(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, travelMode]);

  return (
    <>
      {route?.polyline && <DirectionsOverlay polyline={route.polyline} />}
      {showSummary && route && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-surface/95 border border-line rounded-xl px-3 py-2 shadow-sm backdrop-blur">
          <span className="text-accent flex">
            <Navigation size={15} strokeWidth={2} />
          </span>
          <span className="text-[12.5px] font-bold text-ink">{formatDistance(route.distanceMeters, units)}</span>
          <span className="text-[12px] text-muted">·</span>
          <span className="text-[12.5px] font-semibold text-muted">{formatDuration(route.durationSeconds)}</span>
        </div>
      )}
    </>
  );
}
