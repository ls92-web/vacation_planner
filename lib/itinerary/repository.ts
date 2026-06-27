"use client";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ExplorePlace, ItineraryItem, Slot } from "@/lib/places";

// ===== Persistence for favorites + itinerary. =====
// Supabase when configured, otherwise localStorage. Either way the data survives
// leaving the page. Rows are scoped by a per-browser device id (no auth yet).

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

export interface ItineraryRepository {
  listFavorites(destination: string): Promise<ExplorePlace[]>;
  setFavorite(destination: string, place: ExplorePlace, on: boolean): Promise<void>;
  listItinerary(destination: string): Promise<ItineraryItem[]>;
  saveItinerary(destination: string, items: ItineraryItem[]): Promise<void>;
}

// ---- localStorage implementation (also the fallback when Supabase calls fail) ----

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
    /* ignore quota errors */
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

// ---- Supabase implementation (mirrors to localStorage so reads stay instant offline) ----

interface ItinRow {
  place_id: string;
  name: string;
  category: string | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  day: number;
  slot: string;
  position: number;
  data: ExplorePlace | null;
}

function makeSupabaseRepo(): ItineraryRepository {
  const sb = getSupabase()!;
  const dev = deviceId();

  return {
    async listFavorites(destination) {
      try {
        const { data, error } = await sb
          .from("favorites")
          .select("data")
          .eq("device_id", dev)
          .eq("destination", destination)
          .order("created_at", { ascending: true });
        if (error) throw error;
        const places = (data ?? []).map((r) => r.data as ExplorePlace).filter(Boolean);
        lsWrite(lsKey("fav", destination), places);
        return places;
      } catch {
        return localRepo.listFavorites(destination);
      }
    },
    async setFavorite(destination, place, on) {
      await localRepo.setFavorite(destination, place, on); // optimistic mirror
      try {
        if (on) {
          await sb.from("favorites").upsert(
            {
              device_id: dev,
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
            { onConflict: "device_id,place_id" }
          );
        } else {
          await sb.from("favorites").delete().eq("device_id", dev).eq("place_id", place.id);
        }
      } catch {
        /* localStorage already updated */
      }
    },
    async listItinerary(destination) {
      try {
        const { data, error } = await sb
          .from("itinerary_items")
          .select("*")
          .eq("device_id", dev)
          .eq("destination", destination)
          .order("day", { ascending: true })
          .order("slot", { ascending: true })
          .order("position", { ascending: true });
        if (error) throw error;
        const items = (data as ItinRow[] | null ?? [])
          .map((r): ItineraryItem | null => (r.data ? { place: r.data, day: r.day, slot: r.slot as Slot, position: r.position } : null))
          .filter((i): i is ItineraryItem => i !== null);
        lsWrite(lsKey("itin", destination), items);
        return items;
      } catch {
        return localRepo.listItinerary(destination);
      }
    },
    async saveItinerary(destination, items) {
      await localRepo.saveItinerary(destination, items); // optimistic mirror
      try {
        await sb.from("itinerary_items").delete().eq("device_id", dev).eq("destination", destination);
        if (items.length) {
          await sb.from("itinerary_items").insert(
            items.map((it) => ({
              device_id: dev,
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
              data: it.place,
            }))
          );
        }
      } catch {
        /* localStorage already updated */
      }
    },
  };
}

let repo: ItineraryRepository | null = null;

export function getRepository(): ItineraryRepository {
  if (repo) return repo;
  repo = isSupabaseConfigured() ? makeSupabaseRepo() : localRepo;
  return repo;
}
