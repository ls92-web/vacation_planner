"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase/client";

export interface Trip {
  id: string;
  name: string;
  destination: string;
  created_at: string;
}

const ACTIVE_KEY = "wf_active_trip";
const LOCAL_TRIP: Trip = { id: "local", name: "My trip", destination: "Barcelona, Spain", created_at: "" };

function useProvideTrips() {
  const sb = getSupabase();
  const [ready, setReady] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);

  const setActive = useCallback((id: string | null) => {
    setActiveIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    }
  }, []);

  const load = useCallback(async () => {
    if (!sb) {
      setTrips([LOCAL_TRIP]);
      setActiveIdState("local");
      setReady(true);
      return;
    }
    const { data } = await sb.from("trips").select("id,name,destination,created_at").order("created_at", { ascending: false });
    const list = (data as Trip[]) ?? [];
    setTrips(list);
    const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_KEY) : null;
    setActiveIdState(stored && list.some((t) => t.id === stored) ? stored : list[0]?.id ?? null);
    setReady(true);
  }, [sb]);

  useEffect(() => {
    load();
  }, [load]);

  const actions = useMemo(
    () => ({
      async createTrip(name: string, destination: string): Promise<Trip | null> {
        if (!sb) return LOCAL_TRIP;
        const { data: sess } = await sb.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return null;
        const { data, error } = await sb
          .from("trips")
          .insert({ user_id: uid, name: name.trim() || "My trip", destination: destination.trim() })
          .select("id,name,destination,created_at")
          .single();
        if (error || !data) return null;
        const trip = data as Trip;
        setTrips((t) => [trip, ...t]);
        setActive(trip.id);
        return trip;
      },
      select(id: string) {
        setActive(id);
      },
      async rename(id: string, name: string) {
        if (!sb) return;
        await sb.from("trips").update({ name: name.trim() || "My trip" }).eq("id", id);
        setTrips((t) => t.map((x) => (x.id === id ? { ...x, name: name.trim() || "My trip" } : x)));
      },
      async remove(id: string) {
        if (sb) await sb.from("trips").delete().eq("id", id);
        setTrips((t) => {
          const next = t.filter((x) => x.id !== id);
          if (activeId === id) setActive(next[0]?.id ?? null);
          return next;
        });
      },
      refresh: load,
    }),
    [sb, activeId, setActive, load]
  );

  const activeTrip = trips.find((t) => t.id === activeId) ?? null;
  return { ready, trips, activeTrip, activeId, actions };
}

export type TripsStore = ReturnType<typeof useProvideTrips>;
const TripsContext = createContext<TripsStore | null>(null);

export function TripsProvider({ children }: { children: ReactNode }) {
  const store = useProvideTrips();
  return <TripsContext.Provider value={store}>{children}</TripsContext.Provider>;
}

export function useTrips(): TripsStore {
  const ctx = useContext(TripsContext);
  if (!ctx) throw new Error("useTrips must be used within TripsProvider");
  return ctx;
}
