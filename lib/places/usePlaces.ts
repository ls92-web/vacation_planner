"use client";

import { useEffect, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { cached, TTL } from "@/lib/maps";
import type { LatLng } from "@/lib/maps";
import { categoryByKey } from "./categories";
import { curatedForCategory } from "./curated";
import { fromGooglePlace, refinePlaces } from "./transform";
import type { ExplorePlace } from "./types";

const FIELDS = [
  "id",
  "displayName",
  "location",
  "rating",
  "userRatingCount",
  "priceLevel",
  "regularOpeningHours",
  "photos",
  "formattedAddress",
  "editorialSummary",
  "types",
  "accessibilityOptions",
];

export interface UsePlacesResult {
  places: ExplorePlace[];
  loading: boolean;
  source: "google" | "curated" | null;
}

/**
 * Fetches real places for a destination + category (or text search) from Google
 * Places (New), cached + de-duplicated. Falls back to the curated dataset when the
 * Places library is unavailable or a request fails — so the grid is never empty.
 */
export function usePlaces(opts: { center: LatLng; categoryKey: string; search: string; radius?: number }): UsePlacesResult {
  const placesLib = useMapsLibrary("places");
  const [state, setState] = useState<UsePlacesResult>({ places: [], loading: true, source: null });

  const search = opts.search.trim();
  const radius = opts.radius ?? 4500;
  const cacheKey = `explore:${opts.categoryKey}:${opts.center.lat.toFixed(3)},${opts.center.lng.toFixed(3)}:${radius}:${search.toLowerCase()}`;

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    const cat = categoryByKey(opts.categoryKey);

    const run = async (): Promise<UsePlacesResult> => {
      if (!placesLib) return { places: curatedForCategory(opts.categoryKey), loading: false, source: "curated" };
      try {
        const places = await cached<ExplorePlace[]>(cacheKey, TTL.places, async () => {
          let raw: google.maps.places.Place[] = [];
          if (search) {
            const res = await placesLib.Place.searchByText({
              textQuery: search,
              fields: FIELDS,
              locationBias: { center: opts.center, radius },
              maxResultCount: 18,
            });
            raw = res.places ?? [];
          } else {
            const res = await placesLib.Place.searchNearby({
              fields: FIELDS,
              locationRestriction: { center: opts.center, radius },
              includedTypes: cat.includedTypes,
              maxResultCount: 18,
              rankPreference: placesLib.SearchNearbyRankPreference.POPULARITY,
            });
            raw = res.places ?? [];
          }
          const mapped = raw.map((p) => fromGooglePlace(p, cat)).filter((p): p is ExplorePlace => p !== null);
          return refinePlaces(mapped, cat.refine);
        });
        if (places.length) return { places, loading: false, source: "google" };
        return { places: curatedForCategory(opts.categoryKey), loading: false, source: "curated" };
      } catch {
        return { places: curatedForCategory(opts.categoryKey), loading: false, source: "curated" };
      }
    };

    run().then((r) => {
      if (!cancelled) setState(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, placesLib]);

  return state;
}
