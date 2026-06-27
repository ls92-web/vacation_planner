"use client";

import { useEffect, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { cached, TTL, type LatLng } from "@/lib/maps";
import { categoryByKey } from "./categories";
import { fromGooglePlace } from "./transform";
import type { ExplorePlace } from "./types";

const FIELDS = ["id", "displayName", "location", "rating", "userRatingCount", "priceLevel", "photos", "formattedAddress", "types"];

/**
 * Lightweight nearby search by arbitrary place types — used for "Nearby Opportunities"
 * suggestions. Real Google Places only; returns [] when unavailable (it's a bonus panel).
 */
export function useNearby(opts: { center: LatLng; includedTypes: string[]; categoryKey: string; enabled: boolean; radius?: number }): {
  places: ExplorePlace[];
  loading: boolean;
} {
  const placesLib = useMapsLibrary("places");
  const [state, setState] = useState<{ places: ExplorePlace[]; loading: boolean }>({ places: [], loading: false });
  const radius = opts.radius ?? 1500;
  const key = `nearby-opp:${opts.includedTypes.join("+")}:${opts.center.lat.toFixed(3)},${opts.center.lng.toFixed(3)}:${radius}`;

  useEffect(() => {
    if (!opts.enabled || !placesLib) {
      setState({ places: [], loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    cached<ExplorePlace[]>(key, TTL.places, async () => {
      const res = await placesLib.Place.searchNearby({
        fields: FIELDS,
        locationRestriction: { center: opts.center, radius },
        includedTypes: opts.includedTypes,
        maxResultCount: 8,
        rankPreference: placesLib.SearchNearbyRankPreference.POPULARITY,
      });
      const cat = categoryByKey(opts.categoryKey);
      return (res.places ?? []).map((p) => fromGooglePlace(p, cat)).filter((p): p is ExplorePlace => p !== null);
    })
      .then((places) => {
        if (!cancelled) setState({ places, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ places: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, placesLib, opts.enabled]);

  return state;
}
