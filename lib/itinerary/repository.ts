"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ExplorePlace, ItineraryItem, Slot } from "@/lib/places";

// ===== Favorites + itinerary persistence. =====
// When a user is signed in, everything is written to the per-user tables
// (saved_places / schedule_items) which have owner-only RLS — so a user's saved
// schedules are private to their account and reload on any device when they sign
// back in. With no auth (Supabase not configured) it falls back to localStorage.

export interface ItineraryRepository {
  listFavorites(destination: string): Promise<ExplorePlace[]>;
  setFavorite(destination: string, place: ExplorePlace, on: boolean): Promise<void>;
  listItinerary(destination: string): Promise<ItineraryItem[]>;
  saveItinerary(destination: string, items: ItineraryItem[]): Promise<void>;
}

// ---------- localStorage fallback (no auth) ----------

const DEVICE_KEY = "wf_device_id";
export function deviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

const lsKey = (kind: "fav" | "itin", destination: string) => `wf_${kind}_${destination.toLowerCase()}`;
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
  async listFavorites(destination) {
    return lsRead<ExplorePlace[]>(lsKey("fav", destination), []);
  },
  async setFavorite(destination, place, on) {
    const key = lsKey("fav", destination);
    const list = lsRead<ExplorePlace[]>(key, []).filter((p) => p.id !== place.id);
    if (on) list.push(place);
    lsWrite(key, list);
  },
  async listItinerary(destination) {
    return lsRead<ItineraryItem[]>(lsKey("itin", destination), []);
  },
  async saveItinerary(destination, items) {
    lsWrite(lsKey("itin", destination), items);
  },
};

// ---------- per-user Supabase repository (owner-only RLS) ----------

async function currentUserId(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

interface SavedRow {
  data: ExplorePlace | null;
}
interface ItemRow {
  data: ExplorePlace | null;
  day: number;
  slot: string;
  position: number;
  duration_min: number | null;
}

const userRepo: ItineraryRepository = {
  async listFavorites(destination) {
    const sb = getSupabase();
    if (!sb) return localRepo.listFavorites(destination);
    const uid = await currentUserId(sb);
    if (!uid) return localRepo.listFavorites(destination);
    const { data, error } = await sb
      .from("saved_places")
      .select("data")
      .eq("destination", destination)
      .order("created_at", { ascending: true });
    if (error) return [];
    return (data as SavedRow[]).map((r) => r.data).filter((p): p is ExplorePlace => !!p);
  },

  async setFavorite(destination, place, on) {
    const sb = getSupabase();
    if (!sb) return localRepo.setFavorite(destination, place, on);
    const uid = await currentUserId(sb);
    if (!uid) return localRepo.setFavorite(destination, place, on);
    if (on) {
      await sb.from("saved_places").upsert(
        {
          user_id: uid,
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
        { onConflict: "user_id,place_id,destination" }
      );
    } else {
      await sb.from("saved_places").delete().eq("destination", destination).eq("place_id", place.id);
    }
  },

  async listItinerary(destination) {
    const sb = getSupabase();
    if (!sb) return localRepo.listItinerary(destination);
    const uid = await currentUserId(sb);
    if (!uid) return localRepo.listItinerary(destination);
    const { data, error } = await sb
      .from("schedule_items")
      .select("data, day, slot, position, duration_min")
      .eq("destination", destination)
      .order("day", { ascending: true })
      .order("slot", { ascending: true })
      .order("position", { ascending: true });
    if (error) return [];
    return (data as ItemRow[])
      .map((r): ItineraryItem | null =>
        r.data ? { place: r.data, day: r.day, slot: r.slot as Slot, position: r.position, durationMin: r.duration_min ?? undefined } : null
      )
      .filter((i): i is ItineraryItem => i !== null);
  },

  async saveItinerary(destination, items) {
    const sb = getSupabase();
    if (!sb) return localRepo.saveItinerary(destination, items);
    const uid = await currentUserId(sb);
    if (!uid) return localRepo.saveItinerary(destination, items);
    await sb.from("schedule_items").delete().eq("destination", destination);
    if (items.length) {
      await sb.from("schedule_items").insert(
        items.map((it) => ({
          user_id: uid,
          destination,
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
