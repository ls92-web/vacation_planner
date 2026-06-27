"use client";

import { getSupabase } from "@/lib/supabase/client";
import type { SelectedDestination } from "@/lib/geo";

// ===== Selected-destination persistence, scoped per TRIP. =====
// Only the destinations the user picks are stored (city + country + coords +
// optional image) — never the full list of world countries/cities. Signed in →
// owner-only `destinations` table; otherwise a localStorage fallback.

const lsKey = (tripId: string) => `itinera_dests_${tripId}`;

function lsRead(tripId: string): SelectedDestination[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(lsKey(tripId)) || "[]") as SelectedDestination[];
  } catch {
    return [];
  }
}
function lsWrite(tripId: string, list: SelectedDestination[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lsKey(tripId), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

interface DestRow {
  name: string;
  country: string | null;
  country_code: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
}

export async function listDestinations(tripId: string): Promise<SelectedDestination[]> {
  const sb = getSupabase();
  if (!sb) return lsRead(tripId);
  const { data: sess } = await sb.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return lsRead(tripId);
  const { data, error } = await sb
    .from("destinations")
    .select("name,country,country_code,lat,lng,image_url")
    .eq("trip_id", tripId)
    .order("position", { ascending: true });
  if (error || !data) return [];
  return (data as DestRow[]).map((r, i) => ({
    id: `${tripId}-${i}`,
    cityName: r.name,
    countryName: r.country ?? "",
    countryCode: r.country_code ?? "",
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    image: r.image_url,
  }));
}

/** Replace the trip's stored destinations with `dests` (in order). */
export async function saveDestinations(tripId: string, dests: SelectedDestination[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    lsWrite(tripId, dests);
    return;
  }
  const { data: sess } = await sb.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) {
    lsWrite(tripId, dests);
    return;
  }
  await sb.from("destinations").delete().eq("trip_id", tripId);
  if (!dests.length) return;
  await sb.from("destinations").insert(
    dests.map((d, i) => ({
      user_id: uid,
      trip_id: tripId,
      name: d.cityName,
      country: d.countryName,
      country_code: d.countryCode,
      lat: d.lat,
      lng: d.lng,
      image_url: d.image ?? null,
      position: i,
    }))
  );
}
