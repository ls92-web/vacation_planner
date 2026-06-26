"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { cached, TTL } from "./cache";
import { CATEGORY_TYPES } from "./categories";
import type { LatLng, PlaceCategory, PlaceResult } from "./types";

// ===== Reusable hooks over the Google Maps JS libraries (loaded lazily by APIProvider). =====

/** Nearby Places search by category, cached + de-duplicated. */
export function usePlacesSearch() {
  const placesLib = useMapsLibrary("places");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (category: PlaceCategory, center: LatLng, radius = 2500) => {
      if (!placesLib) return;
      setLoading(true);
      setError(null);
      const key = `nearby:${category}:${center.lat.toFixed(3)},${center.lng.toFixed(3)}:${radius}`;
      try {
        const res = await cached<PlaceResult[]>(key, TTL.places, async () => {
          const { places } = await placesLib.Place.searchNearby({
            fields: ["id", "displayName", "location", "rating", "formattedAddress", "types"],
            locationRestriction: { center, radius },
            includedTypes: CATEGORY_TYPES[category],
            maxResultCount: 14,
            rankPreference: placesLib.SearchNearbyRankPreference.POPULARITY,
          });
          return (places ?? []).map((p) => ({
            id: p.id,
            name: p.displayName ?? "Place",
            position: { lat: p.location?.lat() ?? center.lat, lng: p.location?.lng() ?? center.lng },
            category,
            rating: p.rating ?? undefined,
            address: p.formattedAddress ?? undefined,
          }));
        });
        setResults(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Places search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [placesLib]
  );

  return { results, loading, error, search, ready: !!placesLib };
}

/** Geocode an address string → LatLng (cached). */
export function useGeocode() {
  const geocodingLib = useMapsLibrary("geocoding");
  return useCallback(
    async (address: string): Promise<LatLng | null> => {
      if (!geocodingLib || !address.trim()) return null;
      const key = `geocode:${address.trim().toLowerCase()}`;
      try {
        return await cached<LatLng | null>(key, TTL.geocode, async () => {
          const geocoder = new geocodingLib.Geocoder();
          const { results } = await geocoder.geocode({ address });
          const loc = results[0]?.geometry?.location;
          return loc ? { lat: loc.lat(), lng: loc.lng() } : null;
        });
      } catch {
        return null;
      }
    },
    [geocodingLib]
  );
}

export interface AutocompleteSuggestion {
  id: string;
  text: string;
  placeId: string;
}

/** Debounced Places Autocomplete suggestions for a controlled input value. */
export function useAutocomplete(input: string, debounceMs = 300): AutocompleteSuggestion[] {
  const placesLib = useMapsLibrary("places");
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (!placesLib || input.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        if (!tokenRef.current) tokenRef.current = new placesLib.AutocompleteSessionToken();
        const { suggestions: sug } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: tokenRef.current,
        });
        if (cancelled) return;
        setSuggestions(
          sug
            .map((s, i) => {
              const pred = s.placePrediction;
              return { id: pred?.placeId ?? String(i), text: pred?.text?.text ?? "", placeId: pred?.placeId ?? "" };
            })
            .filter((s) => s.text)
        );
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [input, placesLib, debounceMs]);

  return suggestions;
}
