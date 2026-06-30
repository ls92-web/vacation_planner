// ===== Apply an AI-composed/refined trip structure to a real trip =====
// Turns the model's {destinations, preferences} into the app's Destination[] and
// persists it. Reuses existing cities' coordinates, dates and hotels where the
// city stays in the plan, and reflows dates sequentially so added/removed/
// reordered cities or changed night-counts stay consistent.

import { geocodeCity } from "@/lib/geo";
import { saveTrip } from "@/lib/destinations/repository";
import type { BudgetLevel } from "@/lib/budget/estimate";
import type { ComposedTrip } from "@/lib/ai-client";
import type { Destination } from "@/lib/types";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

export async function buildDestinations(composed: ComposedTrip, existing: Destination[]): Promise<Destination[]> {
  const byCity = new Map(existing.map((d) => [d.name.trim().toLowerCase(), d]));
  // Start from the earliest existing arrival if there is one, else ~a month out.
  const firstArrive = existing.map((d) => d.arrive).filter(Boolean).sort()[0];
  const cur = firstArrive ? new Date(`${firstArrive}T00:00:00`) : (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })();

  const out: Destination[] = [];
  for (let i = 0; i < composed.destinations.length; i++) {
    const c = composed.destinations[i];
    const ex = byCity.get(c.city.trim().toLowerCase());
    let lat = ex?.lat, lng = ex?.lng, country = ex?.country || c.country || "", code = ex?.countryCode || "";
    if (lat == null || lng == null || (lat === 0 && lng === 0)) {
      const g = await geocodeCity(c.city, c.country).catch(() => null);
      if (g) { lat = g.lat; lng = g.lng; country = g.countryName || country; code = g.countryCode || code; }
    }
    const arrive = new Date(cur);
    cur.setDate(cur.getDate() + c.nights);
    out.push({
      id: i + 1, name: c.city, country, countryCode: code, lat, lng,
      image: ex?.image ?? null, saved: true, expanded: false,
      arrive: fmt(arrive), depart: fmt(cur), accoms: ex?.accoms ?? [], budgetOverride: ex?.budgetOverride ?? null,
    });
  }
  return out;
}

/** Build + persist the destinations and preferences for a trip. Returns the new list. */
export async function applyTrip(
  tripId: string,
  composed: ComposedTrip,
  existing: Destination[],
  budgetLevel: BudgetLevel = "standard",
  transports: Record<string, string> = {}
): Promise<Destination[]> {
  const dests = await buildDestinations(composed, existing);
  await saveTrip(tripId, dests, budgetLevel, transports, composed.preferences || {});
  return dests;
}
