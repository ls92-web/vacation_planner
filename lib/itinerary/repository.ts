"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ExplorePlace, ItineraryItem, Slot } from "@/lib/places";

// ===== Favorites + itinerary persistence, scoped per TRIP. =====
// Signed in → per-user tables (saved_places / schedule_items) with owner-only RLS,
// scoped by trip_id, so each named trip's saved places and schedule are private to
// the account and reload on any device. No auth → localStorage fallback.

export interface ItineraryRepository {
  listFavorites(tripId: string): Promise<ExplorePlace[]>;
  setFavorite(tripId: string, destination: string, place: ExplorePlace, on: boolean): Promise<void>;
  listItinerary(tripId: string): Promise<ItineraryItem[]>;
  saveItinerary(tripId: string, destination: string, items: ItineraryItem[]): Promise<void>;
}

// ---------- localStorage fallback (no auth) ----------

const lsKey = (kind: "fav" | "itin", tripId: string) => `wf_${kind}_${tripId}`;
function lsRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const localRepo: ItineraryRepository = {
  async listFavorites(tripId) {
    return lsRead<ExplorePlace[]>(lsKey("fav", tripId), []);
  },
  async setFavorite(tripId, _destination, place, on) {
    const key = lsKey("fav", tripId);
    const list = lsRead<ExplorePlace[]>(key, []).filter((p) => p.id !== place.id);
    if (on) list.push(place);
    lsWrite(key, list);
  },
  async listItinerary(tripId) {
    return lsRead<ItineraryItem[]>(lsKey("itin", tripId), []);
  },
  async saveItinerary(tripId, _destination, items) {
    lsWrite(lsKey("itin", tripId), items);
  },
};

// ---------- per-user Supabase repository (owner-only RLS, scoped by trip) ----------

async function currentUserId(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

interface SavedRow {
  data: ExplorePlace | null;
}
interface ItemRow {
  data: ExplorePlace | null;
  destination: string | null;
  day: number;
  slot: string;
  position: number;
  duration_min: number | null;
}

const userRepo: ItineraryRepository = {
  async listFavorites(tripId) {
    const sb = getSupabase();
    if (!sb) return localRepo.listFavorites(tripId);
    const uid = await currentUserId(sb);
    if (!uid) return localRepo.listFavorites(tripId);
    const { data, error } = await sb.from("saved_places").select("data").eq("trip_id", tripId).order("created_at", { ascending: true });
    if (error) return [];
    return (data as SavedRow[]).map((r) => r.data).filter((p): p is ExplorePlace => !!p);
  },

  async setFavorite(tripId, destination, place, on) {
    const sb = getSupabase();
    if (!sb) return localRepo.setFavorite(tripId, destination, place, on);
    const uid = await currentUserId(sb);
    if (!uid) return localRepo.setFavorite(tripId, destination, place, on);
    if (on) {
      await sb.from("saved_places").upsert(
        {
          user_id: uid,
          trip_id: tripId,
          destination,
          place_id: place.id,
          name: place.name,
          category: place.category,
          rating: place.rating ?? null,
          lat: place.position.lat,
          lng: place.position.lng,
          address: place.address ?? null,
          photo_url: place.photoUrl ?? null,
          data: place,
        },
        { onConflict: "user_id,place_id,trip_id" }
      );
    } else {
      await sb.from("saved_places").delete().eq("trip_id", tripId).eq("place_id", place.id);
    }
  },

  async listItinerary(tripId) {
    const sb = getSupabase();
    if (!sb) return localRepo.listItinerary(tripId);
    const uid = await currentUserId(sb);
    if (!uid) return localRepo.listItinerary(tripId);
    const { data, error } = await sb
      .from("schedule_items")
      .select("data, destination, day, slot, position, duration_min")
      .eq("trip_id", tripId)
      .order("day", { ascending: true })
      .order("slot", { ascending: true })
      .order("position", { ascending: true });
    if (error) return [];
    return (data as ItemRow[])
      .map((r): ItineraryItem | null =>
        r.data ? { place: r.data, destId: r.destination ?? "", day: r.day, slot: r.slot as Slot, position: r.position, durationMin: r.duration_min ?? undefined } : null
      )
      .filter((i): i is ItineraryItem => i !== null);
  },

  async saveItinerary(tripId, destination, items) {
    const sb = getSupabase();
    if (!sb) return localRepo.saveItinerary(tripId, destination, items);
    const uid = await currentUserId(sb);
    if (!uid) return localRepo.saveItinerary(tripId, destination, items);
    await sb.from("schedule_items").delete().eq("trip_id", tripId);
    if (items.length) {
      await sb.from("schedule_items").insert(
        items.map((it) => ({
          user_id: uid,
          trip_id: tripId,
          destination: it.destId || destination,
          place_id: it.place.id,
          name: it.place.name,
          category: it.place.category,
          lat: it.place.position.lat,
          lng: it.place.position.lng,
          photo_url: it.place.photoUrl ?? null,
          day: it.day,
          slot: it.slot,
          position: it.position,
          duration_min: it.durationMin ?? null,
          data: it.place,
        }))
      );
    }
  },
};

let repo: ItineraryRepository | null = null;
export function getRepository(): ItineraryRepository {
  if (repo) return repo;
  repo = isSupabaseConfigured() ? userRepo : localRepo;
  return repo;
}
