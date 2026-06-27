"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { destinationCoords, mapsConfig, type LatLng } from "@/lib/maps";
import {
  DEFAULT_CATEGORY,
  DEFAULT_FILTERS,
  type ExploreFilters,
  type ExplorePlace,
  type ItineraryItem,
  type Slot,
} from "@/lib/places";
import { getRepository } from "@/lib/itinerary/repository";

interface PlannerState {
  destination: string;
  center: LatLng;
  categoryKey: string;
  search: string;
  filters: ExploreFilters;
  favorites: ExplorePlace[];
  itinerary: ItineraryItem[];
  compare: string[];
  hoveredId: string | null;
  selectedId: string | null;
  day: number;
  dayCount: number;
  units: "km" | "mi";
  loaded: boolean;
  toast: string | null;
}

const NUM_DAYS = 3;

function makeInitial(destination: string): PlannerState {
  const center = destinationCoords(destination.split(",")[0]) ?? mapsConfig.defaultCenter;
  return {
    destination,
    center,
    categoryKey: DEFAULT_CATEGORY,
    search: "",
    filters: { ...DEFAULT_FILTERS },
    favorites: [],
    itinerary: [],
    compare: [],
    hoveredId: null,
    selectedId: null,
    day: 0,
    dayCount: NUM_DAYS,
    units: "km",
    loaded: false,
    toast: null,
  };
}

function useProvidePlanner(destination: string) {
  const [state, setState] = useState<PlannerState>(() => makeInitial(destination));
  const stateRef = useRef(state);
  stateRef.current = state;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repo = getRepository();

  const flash = useCallback((msg: string) => {
    setState((s) => ({ ...s, toast: msg }));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setState((s) => ({ ...s, toast: null })), 2400);
  }, []);

  // Load persisted favorites + itinerary for the destination.
  useEffect(() => {
    let cancelled = false;
    Promise.all([repo.listFavorites(destination), repo.listItinerary(destination)]).then(([favorites, itinerary]) => {
      if (!cancelled) setState((s) => ({ ...s, favorites, itinerary, loaded: true }));
    });
    return () => {
      cancelled = true;
    };
  }, [destination, repo]);

  const persistItinerary = useCallback(
    (items: ItineraryItem[]) => {
      setState((s) => ({ ...s, itinerary: items }));
      repo.saveItinerary(stateRef.current.destination, items);
    },
    [repo]
  );

  const actions = useMemo(() => {
    return {
      setCategory: (key: string) => setState((s) => ({ ...s, categoryKey: key, search: "" })),
      setSearch: (v: string) => setState((s) => ({ ...s, search: v })),
      setFilter: (patch: Partial<ExploreFilters>) => setState((s) => ({ ...s, filters: { ...s.filters, ...patch } })),
      resetFilters: () => setState((s) => ({ ...s, filters: { ...DEFAULT_FILTERS } })),
      setUnits: (u: "km" | "mi") => setState((s) => ({ ...s, units: u })),
      setDay: (d: number) => setState((s) => ({ ...s, day: d })),
      setHovered: (id: string | null) => setState((s) => (s.hoveredId === id ? s : { ...s, hoveredId: id })),
      setSelected: (id: string | null) => setState((s) => ({ ...s, selectedId: id })),

      toggleFavorite: (place: ExplorePlace) => {
        const on = !stateRef.current.favorites.some((p) => p.id === place.id);
        setState((s) => ({
          ...s,
          favorites: on ? [...s.favorites, place] : s.favorites.filter((p) => p.id !== place.id),
        }));
        repo.setFavorite(stateRef.current.destination, place, on);
      },

      toggleCompare: (id: string) =>
        setState((s) => ({
          ...s,
          compare: s.compare.includes(id) ? s.compare.filter((x) => x !== id) : s.compare.length >= 3 ? s.compare : [...s.compare, id],
        })),
      clearCompare: () => setState((s) => ({ ...s, compare: [] })),

      addToItinerary: (place: ExplorePlace, day: number, slot: Slot) => {
        const s = stateRef.current;
        if (s.itinerary.some((it) => it.place.id === place.id)) {
          flash(`${place.name} is already in your plan.`);
          return;
        }
        const position = s.itinerary.filter((it) => it.day === day && it.slot === slot).length;
        persistItinerary([...s.itinerary, { place, day, slot, position }]);
        flash(`Added ${place.name} to ${["Morning", "Afternoon", "Evening"][["morning", "afternoon", "evening"].indexOf(slot)]}.`);
      },
      removeFromItinerary: (placeId: string) => {
        persistItinerary(stateRef.current.itinerary.filter((it) => it.place.id !== placeId));
      },
      /** Replace the whole itinerary (used after drag-and-drop reordering). */
      replaceItinerary: (items: ItineraryItem[]) => persistItinerary(items),

      flash,
    };
  }, [repo, persistItinerary, flash]);

  return { state, actions };
}

export type PlannerStore = ReturnType<typeof useProvidePlanner>;

const PlannerContext = createContext<PlannerStore | null>(null);

export function PlannerProvider({ destination, children }: { destination: string; children: ReactNode }) {
  const store = useProvidePlanner(destination);
  return <PlannerContext.Provider value={store}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerStore {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used within PlannerProvider");
  return ctx;
}

export function isFavorite(state: PlannerState, id: string): boolean {
  return state.favorites.some((p) => p.id === id);
}
export function inItinerary(state: PlannerState, id: string): boolean {
  return state.itinerary.some((it) => it.place.id === id);
}
