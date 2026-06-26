"use client";

import { useEffect } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

function resolveColor(color: string): string {
  if (typeof window === "undefined" || !color.startsWith("var(")) return color;
  const name = color.slice(4, -1).trim();
  const el = document.querySelector("[data-theme]") || document.documentElement;
  return getComputedStyle(el).getPropertyValue(name).trim() || "#16767e";
}

/** Decodes an encoded polyline and draws it on the map (optionally fitting bounds). */
export function DirectionsOverlay({
  polyline,
  color = "var(--accent)",
  fit = true,
}: {
  polyline: string;
  color?: string;
  fit?: boolean;
}) {
  const map = useMap();
  const geometry = useMapsLibrary("geometry");

  useEffect(() => {
    if (!map || !geometry || !polyline) return;
    let path: google.maps.LatLng[];
    try {
      path = geometry.encoding.decodePath(polyline);
    } catch {
      return;
    }
    if (!path.length) return;

    const line = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: resolveColor(color),
      strokeOpacity: 0.9,
      strokeWeight: 4,
    });
    line.setMap(map);

    if (fit) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 56);
    }

    return () => line.setMap(null);
  }, [map, geometry, polyline, color, fit]);

  return null;
}
