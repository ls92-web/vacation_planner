"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import type { SelectedDestination } from "@/lib/geo";
import type { Accommodation, AccomType, Destination } from "@/lib/types";
import type { BudgetLevel } from "@/lib/budget/estimate";

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
  arrive: string | null;
  depart: string | null;
}

export async function listDestinations(tripId: string): Promise<SelectedDestination[]> {
  const sb = getSupabase();
  if (!sb) return lsRead(tripId);
  const { data: sess } = await sb.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return lsRead(tripId);
  const { data, error } = await sb
    .from("destinations")
    .select("name,country,country_code,lat,lng,image_url,arrive,depart")
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
    arrive: r.arrive ?? "",
    depart: r.depart ?? "",
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
      arrive: d.arrive || null,
      depart: d.depart || null,
      position: i,
    }))
  );
}

// ===== Full trip plan: destinations + accommodations + budget. =====

export type LoadedAccommodation = Omit<Accommodation, "id">;
export interface LoadedDestination {
  cityName: string;
  countryName: string;
  countryCode: string;
  lat: number;
  lng: number;
  image: string | null;
  arrive: string;
  depart: string;
  budgetOverride: number | null;
  accoms: LoadedAccommodation[];
}
export interface LoadedTrip {
  destinations: LoadedDestination[];
  budgetLevel: BudgetLevel;
  /** Chosen travel mode per inter-city leg, keyed by "fromCity|toCity" (lowercased). */
  transports: Record<string, string>;
}

const planKey = (tripId: string) => `itinera_plan_${tripId}`;
function lsPlanRead(tripId: string): LoadedTrip | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(planKey(tripId));
    return raw ? (JSON.parse(raw) as LoadedTrip) : null;
  } catch {
    return null;
  }
}
function lsPlanWrite(tripId: string, plan: LoadedTrip) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(planKey(tripId), JSON.stringify(plan));
  } catch {
    /* ignore */
  }
}

function toLoaded(destinations: Destination[]): LoadedDestination[] {
  return destinations
    .filter((d) => d.saved && d.name.trim())
    .map((d) => ({
      cityName: d.name,
      countryName: d.country,
      countryCode: d.countryCode ?? "",
      lat: d.lat ?? 0,
      lng: d.lng ?? 0,
      image: d.image ?? null,
      arrive: d.arrive || "",
      depart: d.depart || "",
      budgetOverride: typeof d.budgetOverride === "number" ? d.budgetOverride : null,
      accoms: d.accoms.map((a) => ({
        type: a.type,
        name: a.name,
        checkin: a.checkin,
        checkout: a.checkout,
        checkinTime: a.checkinTime ?? "",
        checkoutTime: a.checkoutTime ?? "",
        conf: a.conf,
        address: a.address,
        notes: a.notes,
        locationUrl: a.locationUrl ?? "",
      })),
    }));
}

interface AccomRow {
  destination_id: string;
  type: string | null;
  name: string | null;
  checkin: string | null;
  checkout: string | null;
  checkin_time: string | null;
  checkout_time: string | null;
  confirmation: string | null;
  address: string | null;
  notes: string | null;
  location_url: string | null;
}

// Serialize + coalesce saves per trip. The debounced auto-save and an explicit
// Save can otherwise run concurrently and, since each does delete-then-insert,
// produce duplicate rows. Runs at most one save at a time per trip; if more
// arrive while one is running, only the latest is run next.
const saveState = new Map<string, { running: boolean; next: (() => Promise<void>) | null }>();

export function saveTrip(tripId: string, destinations: Destination[], budgetLevel: BudgetLevel, transports: Record<string, string> = {}): Promise<void> {
  const run = () => doSaveTrip(tripId, destinations, budgetLevel, transports);
  const q = saveState.get(tripId) ?? { running: false, next: null };
  saveState.set(tripId, q);
  if (q.running) {
    q.next = run;
    return Promise.resolve();
  }
  q.running = true;
  return (async () => {
    try {
      await run();
      while (q.next) {
        const next = q.next;
        q.next = null;
        await next();
      }
    } finally {
      q.running = false;
    }
  })();
}

/** Replace the whole trip plan (destinations + accommodations + budget + transport modes). */
async function doSaveTrip(tripId: string, destinations: Destination[], budgetLevel: BudgetLevel, transports: Record<string, string>): Promise<void> {
  const loaded = toLoaded(destinations);
  const sb = getSupabase();
  if (!sb) {
    lsPlanWrite(tripId, { destinations: loaded, budgetLevel, transports });
    return;
  }
  const { data: sess } = await sb.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) {
    lsPlanWrite(tripId, { destinations: loaded, budgetLevel, transports });
    return;
  }

  await sb.from("trips").update({ budget_level: budgetLevel, transports }).eq("id", tripId);
  // accommodations reference destinations — clear them first.
  await sb.from("accommodations").delete().eq("trip_id", tripId);
  await sb.from("destinations").delete().eq("trip_id", tripId);
  if (!loaded.length) return;

  const { data: inserted, error } = await sb
    .from("destinations")
    .insert(
      loaded.map((d, i) => ({
        user_id: uid,
        trip_id: tripId,
        name: d.cityName,
        country: d.countryName,
        country_code: d.countryCode,
        lat: d.lat,
        lng: d.lng,
        image_url: d.image ?? null,
        arrive: d.arrive || null,
        depart: d.depart || null,
        budget_override: d.budgetOverride,
        position: i,
      }))
    )
    .select("id,position");
  if (error || !inserted) return;

  const idByPosition = new Map<number, string>();
  for (const row of inserted as { id: string; position: number }[]) idByPosition.set(row.position, row.id);

  const accomRows = loaded.flatMap((d, i) => {
    const destId = idByPosition.get(i);
    if (!destId) return [];
    return d.accoms.map((a, ai) => ({
      user_id: uid,
      trip_id: tripId,
      destination_id: destId,
      type: a.type,
      name: a.name,
      checkin: a.checkin || null,
      checkout: a.checkout || null,
      checkin_time: a.checkinTime || null,
      checkout_time: a.checkoutTime || null,
      confirmation: a.conf,
      address: a.address,
      notes: a.notes,
      location_url: a.locationUrl || null,
      position: ai,
    }));
  });
  if (accomRows.length) await sb.from("accommodations").insert(accomRows);
}

/** Thrown when a trip's plan can't be loaded (auth not ready / network) — distinct from a genuinely empty trip. */
export class TripLoadError extends Error {
  constructor(public reason: "auth-unavailable" | "query-failed") {
    super(`Trip load failed: ${reason}`);
    this.name = "TripLoadError";
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Resolve the signed-in user id, tolerating a session that hasn't hydrated yet.
 * getSession() reads the locally-stored session and can momentarily return null
 * right after a load, so we poll briefly before giving up; getUser() (network)
 * is a final fallback. Returns null only when there is genuinely no session.
 */
async function getReadyUserId(sb: SupabaseClient): Promise<string | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data } = await sb.auth.getSession();
    const uid = data.session?.user?.id;
    if (uid) return uid;
    await sleep(150);
  }
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Load the full trip plan for hydration.
 *
 * Throws TripLoadError instead of returning an empty plan when the user is
 * (likely) signed in but the session/DB is temporarily unavailable — so a
 * transient auth hiccup surfaces as a retryable error, never as silent data
 * loss. A genuinely empty trip (query succeeds, zero rows) still returns
 * normally. Unauthenticated localStorage mode (no Supabase) is unchanged.
 */
export async function loadTrip(tripId: string): Promise<LoadedTrip> {
  const sb = getSupabase();
  if (!sb) return lsPlanRead(tripId) ?? { destinations: [], budgetLevel: "standard", transports: {} };
  const uid = await getReadyUserId(sb);
  if (!uid) {
    // Supabase is configured (the app runs signed-in), yet no session became
    // available after retrying — treat as a transient failure, not "no data".
    throw new TripLoadError("auth-unavailable");
  }

  const [destsRes, accomsRes, tripRes] = await Promise.all([
    sb.from("destinations").select("id,name,country,country_code,lat,lng,image_url,arrive,depart,budget_override").eq("trip_id", tripId).order("position", { ascending: true }),
    sb.from("accommodations").select("destination_id,type,name,checkin,checkout,checkin_time,checkout_time,confirmation,address,notes,location_url").eq("trip_id", tripId).order("position", { ascending: true }),
    sb.from("trips").select("budget_level,transports").eq("id", tripId).maybeSingle(),
  ]);

  // A query error (or a missing trip row) is a load failure, not an empty trip.
  if (destsRes.error || !destsRes.data || tripRes.error) throw new TripLoadError("query-failed");

  const budgetLevel = ((tripRes.data?.budget_level as BudgetLevel) || "standard") as BudgetLevel;
  const transports = (tripRes.data?.transports as Record<string, string> | null) ?? {};

  const accomsByDest = new Map<string, LoadedAccommodation[]>();
  for (const a of (accomsRes.data as AccomRow[]) ?? []) {
    const list = accomsByDest.get(a.destination_id) ?? [];
    list.push({
      type: (a.type as AccomType) || "Hotel",
      name: a.name ?? "",
      checkin: a.checkin ?? "",
      checkout: a.checkout ?? "",
      checkinTime: a.checkin_time ?? "",
      checkoutTime: a.checkout_time ?? "",
      conf: a.confirmation ?? "",
      address: a.address ?? "",
      notes: a.notes ?? "",
      locationUrl: a.location_url ?? "",
    });
    accomsByDest.set(a.destination_id, list);
  }

  const destinations: LoadedDestination[] = (destsRes.data as (DestRow & { id: string; budget_override: number | null })[]).map((r) => ({
    cityName: r.name,
    countryName: r.country ?? "",
    countryCode: r.country_code ?? "",
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    image: r.image_url,
    arrive: r.arrive ?? "",
    depart: r.depart ?? "",
    budgetOverride: typeof r.budget_override === "number" ? r.budget_override : null,
    accoms: accomsByDest.get(r.id) ?? [],
  }));

  return { destinations, budgetLevel, transports };
}
