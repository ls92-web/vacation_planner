"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Heart, MapPin, Star } from "lucide-react";
import { useTrip } from "@/lib/store";
import { useTrips } from "@/lib/trips/store";
import { getRepository, type SavedEntry } from "@/lib/itinerary/repository";
import { placeLink } from "@/lib/maps";

function PlaceCard({ entry }: { entry: SavedEntry }) {
  const p = entry.place;
  const href = placeLink({ name: p.name, position: p.position, placeId: p.placeId });
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="imm-glass imm-glass-hover group rounded-[14px] overflow-hidden flex cursor-pointer transition hover:-translate-y-0.5"
      style={{ boxShadow: "0 12px 30px -22px rgba(0,0,0,.6)" }}
    >
      <div className="w-[84px] shrink-0" style={{ background: "rgba(255,255,255,.06)" }}>
        {p.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photoUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full grid place-items-center" style={{ color: "var(--accent)" }}><MapPin size={18} /></span>
        )}
      </div>
      <div className="flex-1 min-w-0 p-3 text-white">
        <div className="font-semibold text-[14px] truncate">{p.name}</div>
        <div className="text-[12px] text-white/50 truncate mt-0.5 capitalize">{p.category}</div>
        <div className="flex items-center gap-2 mt-1.5">
          {p.rating != null && (
            <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: "#E0A44F" }}>
              <Star size={12} fill="currentColor" stroke="none" /><span className="text-white font-semibold">{p.rating.toFixed(1)}</span>
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold opacity-0 group-hover:opacity-100 transition" style={{ color: "var(--accent)" }}>
            Maps<ExternalLink size={12} strokeWidth={2} />
          </span>
        </div>
      </div>
    </a>
  );
}

export function SavedPlaces() {
  const { trips } = useTrips();
  const { actions } = useTrip();
  const [entries, setEntries] = useState<SavedEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRepository().listAllSaved().then((s) => { if (!cancelled) setEntries(s); }).catch(() => { if (!cancelled) setEntries([]); });
    return () => { cancelled = true; };
  }, []);

  const tripName = useMemo(() => {
    const m = new Map(trips.map((t) => [t.id, t.name] as const));
    return (id: string) => m.get(id) ?? "Trip";
  }, [trips]);

  // Group: trip → destination → places.
  const grouped = useMemo(() => {
    const byTrip = new Map<string, Map<string, SavedEntry[]>>();
    for (const e of entries ?? []) {
      const dests = byTrip.get(e.tripId) ?? new Map<string, SavedEntry[]>();
      const dest = e.destination || "Other";
      (dests.get(dest) ?? dests.set(dest, []).get(dest)!).push(e);
      byTrip.set(e.tripId, dests);
    }
    return byTrip;
  }, [entries]);

  return (
    <div className="min-h-full text-white">
      <div className="max-w-[1000px] mx-auto px-[clamp(16px,3vw,28px)] py-8">
        <div className="mb-7 imm-rise">
          <div className="inline-flex items-center gap-1.5 text-[11.5px] uppercase tracking-[.12em] text-white/55"><Heart size={12} style={{ color: "var(--accent)" }} />Saved</div>
          <h1 className="font-brand font-bold tracking-[-.01em] mt-2" style={{ fontSize: "clamp(28px,4.5vw,44px)" }}>Places you've saved</h1>
          <p className="text-white/60 text-[14.5px] mt-2">Everything the companion suggested that caught your eye, grouped by journey.</p>
        </div>

        {entries === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[88px] rounded-[14px] imm-glass animate-pulse" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="imm-glass rounded-[18px] p-10 text-center">
            <div className="w-12 h-12 rounded-full grid place-items-center mx-auto text-white" style={{ background: "var(--accent)" }}><Heart size={22} strokeWidth={2} /></div>
            <div className="font-display font-bold text-[17px] mt-3">No saved places yet</div>
            <p className="text-[13.5px] text-white/55 mt-1.5 max-w-[400px] mx-auto">Ask the companion for ideas while planning a journey and save any place it suggests — they&apos;ll collect here.</p>
            <button onClick={() => actions.goWelcome()} className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[12px] text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06]" style={{ background: "var(--accent)" }}>
              Plan with AI
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {[...grouped.entries()].map(([tripId, dests]) => (
              <section key={tripId}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-display font-bold text-[17px] tracking-[-.01em]">{tripName(tripId)}</span>
                  <span className="text-[12px] text-white/50">· {[...dests.values()].reduce((n, a) => n + a.length, 0)} saved</span>
                </div>
                <div className="flex flex-col gap-4">
                  {[...dests.entries()].map(([dest, places]) => (
                    <div key={dest}>
                      <div className="text-[12px] font-bold uppercase tracking-[.05em] text-white/55 mb-2 flex items-center gap-1.5"><MapPin size={12} strokeWidth={2} style={{ color: "var(--accent)" }} />{dest}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {places.map((e) => <PlaceCard key={`${e.tripId}-${e.place.id}`} entry={e} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
