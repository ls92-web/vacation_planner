"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Compass, Heart, MapPin, Plane, Plus, Settings as SettingsIcon } from "lucide-react";
import { useTrip } from "@/lib/store";
import { useTrips, type Trip } from "@/lib/trips/store";
import { useAuth } from "@/lib/auth/store";
import { useTripLoader } from "@/lib/trips/useTripLoader";
import { getRepository } from "@/lib/itinerary/repository";
import { CityImage } from "@/components/destinations/CityImage";

function StatTile({ icon: Icon, label, value }: { icon: typeof Plane; label: string; value: string | number }) {
  return (
    <div className="rounded-[16px] border border-line bg-surface p-4 flex items-center gap-3" style={{ boxShadow: "0 6px 24px -20px rgba(0,0,0,.3)" }}>
      <span className="w-11 h-11 rounded-[12px] grid place-items-center shrink-0 bg-tint text-accent"><Icon size={20} strokeWidth={2} /></span>
      <div className="min-w-0">
        <div className="font-display font-bold text-[22px] leading-none">{value}</div>
        <div className="text-[12px] text-muted mt-1">{label}</div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { state: auth } = useAuth();
  const { ready, trips, activeTrip, actions: tripsActions } = useTrips();
  const { actions } = useTrip();
  const loadPlan = useTripLoader();
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const firstName = (auth.profile?.full_name || auth.profile?.username || "traveler").split(" ")[0];

  useEffect(() => {
    let cancelled = false;
    getRepository().listAllSaved().then((s) => { if (!cancelled) setSavedCount(s.length); }).catch(() => { if (!cancelled) setSavedCount(0); });
    return () => { cancelled = true; };
  }, []);

  const open = async (t: Trip) => {
    tripsActions.select(t.id);
    actions.goForm();
    await loadPlan(t.id, t.destination);
  };

  const recent = trips.slice(0, 6);

  return (
    <div className="vp-scroll min-h-full" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1100px] mx-auto px-[clamp(16px,3vw,28px)] py-6 vp-fade">
        {/* greeting */}
        <div className="mb-6">
          <h1 className="font-display font-bold text-[clamp(24px,3.2vw,34px)] tracking-[-.02em]">Welcome back, {firstName}</h1>
          <p className="text-muted text-[14.5px] mt-1.5">Your travel workspace — pick up a trip, browse what you&apos;ve saved, or start something new.</p>
        </div>

        {/* stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <StatTile icon={Plane} label={trips.length === 1 ? "Trip" : "Trips"} value={ready ? trips.length : "—"} />
          <StatTile icon={Heart} label="Saved places" value={savedCount ?? "—"} />
          <StatTile icon={Compass} label="Plan with AI" value="On" />
        </div>

        {/* jump back in / start */}
        {activeTrip ? (
          <section className="rounded-[18px] border border-line bg-surface overflow-hidden mb-7" style={{ boxShadow: "0 8px 28px -20px rgba(0,0,0,.35)" }}>
            <div className="relative h-[150px]">
              <CityImage name={activeTrip.destination} country="" image={undefined} className="absolute inset-0 h-full w-full" />
              <div className="absolute bottom-3 left-4 right-4 z-10 text-white flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[.08em] opacity-80">Continue planning</div>
                  <div className="font-display font-bold text-[22px] leading-tight truncate" style={{ textShadow: "0 1px 8px rgba(0,0,0,.4)" }}>{activeTrip.name}</div>
                  <div className="flex items-center gap-1.5 text-[12.5px] text-white/90" style={{ textShadow: "0 1px 6px rgba(0,0,0,.45)" }}><MapPin size={12} strokeWidth={2} />{activeTrip.destination}</div>
                </div>
                <button onClick={() => open(activeTrip)} className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[11px] bg-accent text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06]">
                  Open<ArrowRight size={15} strokeWidth={2} />
                </button>
              </div>
            </div>
          </section>
        ) : ready ? (
          <section className="rounded-[18px] border-2 border-dashed border-line bg-surface/50 p-8 text-center mb-7">
            <div className="w-12 h-12 rounded-full bg-tint grid place-items-center mx-auto text-accent"><Plus size={22} strokeWidth={2} /></div>
            <div className="font-display font-bold text-[17px] mt-3">Start your first trip</div>
            <p className="text-[13.5px] text-muted mt-1.5 max-w-[380px] mx-auto">Pick your destinations and let Itinera build a day-by-day plan.</p>
            <button onClick={() => actions.goTrips()} className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[11px] bg-accent text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06]">
              <Plus size={15} strokeWidth={2.2} />New trip
            </button>
          </section>
        ) : null}

        {/* your trips */}
        {recent.length > 0 && (
          <section className="mb-7">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-[17px] tracking-[-.01em]">Your trips</h2>
              <button onClick={() => actions.goTrips()} className="text-[13px] font-semibold text-accent hover:underline cursor-pointer inline-flex items-center gap-1">See all<ArrowRight size={14} strokeWidth={2} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recent.map((t) => (
                <button key={t.id} onClick={() => open(t)} className="text-left rounded-[16px] border border-line bg-surface overflow-hidden cursor-pointer transition hover:-translate-y-0.5" style={{ boxShadow: "0 6px 22px -18px rgba(0,0,0,.3)" }}>
                  <div className="relative h-[110px]">
                    <CityImage name={t.destination} country="" image={undefined} className="absolute inset-0 h-full w-full" />
                    <div className="absolute bottom-2 left-3 z-10 text-white flex items-center gap-1.5 text-[12px]" style={{ textShadow: "0 1px 6px rgba(0,0,0,.45)" }}><MapPin size={12} strokeWidth={2} />{t.destination.split(",")[0]}</div>
                  </div>
                  <div className="p-3">
                    <div className="font-display font-bold text-[15px] leading-tight truncate">{t.name}</div>
                    <div className="text-[12px] text-accent font-semibold mt-1.5 inline-flex items-center gap-1">Open<ArrowRight size={13} strokeWidth={2} /></div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* quick actions */}
        <section>
          <h2 className="font-display font-bold text-[17px] tracking-[-.01em] mb-3">Quick actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button onClick={() => actions.goExplore()} className="rounded-[14px] border border-line bg-surface p-4 text-left cursor-pointer transition hover:border-accent flex items-center gap-3">
              <span className="w-10 h-10 rounded-[11px] grid place-items-center bg-tint text-accent shrink-0"><Compass size={18} strokeWidth={2} /></span>
              <div><div className="font-semibold text-[14px]">Explore attractions</div><div className="text-[12px] text-muted">Discover places to add</div></div>
            </button>
            <button onClick={() => actions.goSaved()} className="rounded-[14px] border border-line bg-surface p-4 text-left cursor-pointer transition hover:border-accent flex items-center gap-3">
              <span className="w-10 h-10 rounded-[11px] grid place-items-center bg-tint text-accent shrink-0"><Heart size={18} strokeWidth={2} /></span>
              <div><div className="font-semibold text-[14px]">Saved places</div><div className="text-[12px] text-muted">Everything you&apos;ve hearted</div></div>
            </button>
            <button onClick={() => actions.goSettings()} className="rounded-[14px] border border-line bg-surface p-4 text-left cursor-pointer transition hover:border-accent flex items-center gap-3">
              <span className="w-10 h-10 rounded-[11px] grid place-items-center bg-tint text-accent shrink-0"><SettingsIcon size={18} strokeWidth={2} /></span>
              <div><div className="font-semibold text-[14px]">Settings</div><div className="text-[12px] text-muted">Theme, travel & export</div></div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
