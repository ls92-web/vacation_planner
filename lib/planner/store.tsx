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
import { optimizeOrder, resequence, type TransportMode } from "./travel";

interface PlannerState {
  tripId: string;
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
  transportMode: TransportMode;
  loaded: boolean;
  toast: string | null;
}

const NUM_DAYS = 3;

interface TripRef {
  id: string;
  destination: string;
}

function makeInitial(trip: TripRef): PlannerState {
  const center = destinationCoords(trip.destination.split(",")[0]) ?? mapsConfig.defaultCenter;
  return {
    tripId: trip.id,
    destination: trip.destination,
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
    transportMode: "walk",
    loaded: false,
    toast: null,
  };
}

function useProvidePlanner(trip: TripRef) {
  const [state, setState] = useState<PlannerState>(() => makeInitial(trip));
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
    Promise.all([repo.listFavorites(trip.id), repo.listItinerary(trip.id)]).then(([favorites, itinerary]) => {
      if (!cancelled) setState((s) => ({ ...s, favorites, itinerary, loaded: true }));
    });
    return () => {
      cancelled = true;
    };
  }, [trip.id, repo]);

  const persistItinerary = useCallback(
    (items: ItineraryItem[]) => {
      setState((s) => ({ ...s, itinerary: items }));
      repo.saveItinerary(stateRef.current.tripId, stateRef.current.destination, items);
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
      setCenter: (center: LatLng) => setState((s) => ({ ...s, center })),
      setTransportMode: (m: TransportMode) => setState((s) => ({ ...s, transportMode: m })),
      setDay: (d: number) => setState((s) => ({ ...s, day: d })),
      setHovered: (id: string | null) => setState((s) => (s.hoveredId === id ? s : { ...s, hoveredId: id })),
      setSelected: (id: string | null) => setState((s) => ({ ...s, selectedId: id })),

      toggleFavorite: (place: ExplorePlace) => {
        const on = !stateRef.current.favorites.some((p) => p.id === place.id);
        setState((s) => ({
          ...s,
          favorites: on ? [...s.favorites, place] : s.favorites.filter((p) => p.id !== place.id),
        }));
        repo.setFavorite(stateRef.current.tripId, stateRef.current.destination, place, on);
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

      setItemDuration: (placeId: string, min: number) => {
        persistItinerary(
          stateRef.current.itinerary.map((it) => (it.place.id === placeId ? { ...it, durationMin: Math.max(15, Math.round(min)) } : it))
        );
      },
      moveItemToDay: (placeId: string, toDay?: number) => {
        const s = stateRef.current;
        const item = s.itinerary.find((it) => it.place.id === placeId);
        if (!item) return;
        const target = toDay ?? (item.day + 1) % s.dayCount;
        if (target === item.day) return;
        const pos = s.itinerary.filter((it) => it.day === target && it.slot === item.slot).length;
        persistItinerary(s.itinerary.map((it) => (it.place.id === placeId ? { ...it, day: target, position: pos } : it)));
        flash(`Moved ${item.place.name} to Day ${target + 1}.`);
      },
      optimizeDay: (day: number) => {
        const s = stateRef.current;
        const dayItems = s.itinerary.filter((it) => it.day === day);
        if (dayItems.length < 2) return;
        const optimized = resequence(optimizeOrder(dayItems, s.center), s.center, s.transportMode).map((it) => ({ ...it, day }));
        persistItinerary([...s.itinerary.filter((it) => it.day !== day), ...optimized]);
        flash("Reordered for a shorter route.");
      },
      /** Re-sequence a day from a new visit order (drag-and-drop). */
      reorderDay: (day: number, orderedDay: ItineraryItem[]) => {
        const s = stateRef.current;
        const reseq = resequence(orderedDay, s.center, s.transportMode).map((it) => ({ ...it, day }));
        persistItinerary([...s.itinerary.filter((it) => it.day !== day), ...reseq]);
      },

      flash,
    };
  }, [repo, persistItinerary, flash]);

  return { state, actions };
}

export type PlannerStore = ReturnType<typeof useProvidePlanner>;

const PlannerContext = createContext<PlannerStore | null>(null);

export function PlannerProvider({ trip, children }: { trip: TripRef; children: ReactNode }) {
  const store = useProvidePlanner(trip);
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
