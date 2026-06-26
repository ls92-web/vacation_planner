"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import { type ReactNode } from "react";
import { isMapsConfigured, mapsConfig } from "@/lib/maps";

/**
 * Lazily loads the Maps JS API for a region of the UI. Mounting this provider is
 * what triggers the script load, so it should wrap only screens that show maps —
 * keeping the rest of the app free of the Maps payload. When no key is configured
 * it renders children untouched (map components then show their fallbacks).
 */
export function MapsApiProvider({ children }: { children: ReactNode }) {
  if (!isMapsConfigured()) return <>{children}</>;
  return (
    <APIProvider apiKey={mapsConfig.apiKey} libraries={["places", "marker", "geometry", "geocoding"]}>
      {children}
    </APIProvider>
  );
}
