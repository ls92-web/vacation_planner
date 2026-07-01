"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Heart, MapPin, Star } from "lucide-react";
import { useTrip } from "@/lib/store";
import { useTrips } from "@/lib/trips/store";
import { getRepository, type SavedEntry } from "@/lib/itinerary/repository";
import { placeLink } from "@/lib/maps";
import { JourneyCore, type CoreNode } from "@/components/immersive/JourneyCore";

function PlaceCard({ entry, index }: { entry: SavedEntry; index: number }) {
  const p = entry.place;
  const href = placeLink({ name: p.name, position: p.position, placeId: p.placeId });
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="journey-card imm-glass group rounded-[14px] overflow-hidden flex cursor-pointer vp-fade-fast"
      style={{ boxShadow: "0 12px 30px -22px rgba(0,0,0,.6)", animationDelay: `${Math.min(index, 10) * 0.04}s` }}
    >
      <div className="relative w-[84px] shrink-0" style={{ background: "rgba(255,255,255,.06)" }}>
        {p.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photoUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full grid place-items-center" style={{ color: "var(--accent)" }}><MapPin size={18} /></span>
        )}
        {/* constellation node */}
        <span className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)", boxShadow: "0 0 8px 1px color-mix(in oklab, var(--accent) 80%, transparent)" }} />
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

  const total = entries?.length ?? 0;
  // Saved places form a constellation on the Core.
  const savedNodes: CoreNode[] | undefined = total
    ? Array.from({ length: Math.min(total, 9) }, (_, i) => {
        const n = Math.min(total, 9);
        const ang = -Math.PI / 2 + (i / n) * 2 * Math.PI + (i % 2 ? 0.4 : 0);
        const rad = 0.4 + (i % 3) * 0.18;
        return { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, active: i === 0 };
      })
    : undefined;

  return (
    <div className="min-h-full text-white">
      <div className="max-w-[1000px] mx-auto px-[clamp(16px,3vw,28px)] py-6">
        <div className="mb-8 flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-6 text-center sm:text-left imm-rise">
          <JourneyCore size="clamp(120px,15vw,160px)" state="idle" nodes={savedNodes} className="shrink-0" />
          <div className="sm:pt-4">
            <div className="inline-flex items-center gap-1.5 text-[11.5px] uppercase tracking-[.12em] text-white/55"><Heart size={12} style={{ color: "var(--accent)" }} />Saved</div>
            <h1 className="font-brand font-bold tracking-[-.02em] mt-2" style={{ fontSize: "clamp(28px,4.5vw,44px)" }}>Your constellation of places</h1>
            <p className="text-white/60 text-[14.5px] mt-2 max-w-[520px]">Every place the companion suggested that caught your eye{total ? ` — ${total} saved` : ""}, grouped by journey.</p>
          </div>
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
                        {places.map((e, i) => <PlaceCard key={`${e.tripId}-${e.place.id}`} entry={e} index={i} />)}
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
