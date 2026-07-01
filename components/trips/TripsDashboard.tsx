"use client";

import { useState } from "react";
import { ArrowRight, Check, MapPin, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useTrip } from "@/lib/store";
import { useTrips, type Trip } from "@/lib/trips/store";
import { CityImage } from "@/components/destinations/CityImage";
import { useTripLoader } from "@/lib/trips/useTripLoader";
import { ImmersiveHeading } from "@/components/immersive/ImmersiveShell";

function TripCard({ trip, active, onOpen }: { trip: Trip; active: boolean; onOpen: () => void }) {
  const { actions } = useTrips();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(trip.name);
  const [confirming, setConfirming] = useState(false);
  const city = trip.destination.split(",")[0];
  const created = trip.created_at ? new Date(trip.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div className="imm-glass rounded-[18px] overflow-hidden flex flex-col transition hover:-translate-y-0.5" style={{ boxShadow: "0 12px 34px -22px rgba(0,0,0,.6)", borderColor: active ? "var(--accent)" : undefined }}>
      <button onClick={onOpen} className="relative h-[120px] w-full block cursor-pointer overflow-hidden text-left">
        <CityImage name={city} country={trip.destination.split(",").slice(1).join(",").trim()} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(6,12,22,.05), rgba(6,12,22,.72))" }} />
        {active && <span className="absolute top-2.5 right-2.5 z-10 text-[10.5px] font-bold uppercase tracking-wide text-white px-2 py-0.5 rounded-md" style={{ background: "var(--accent)" }}>Active</span>}
        <div className="absolute bottom-2.5 left-3.5 z-10 text-white flex items-center gap-1.5 text-[12px]" style={{ textShadow: "0 1px 6px rgba(0,0,0,.5)" }}><MapPin size={12} strokeWidth={2} />{city}</div>
      </button>
      <div className="p-3.5 flex flex-col flex-1 text-white">
        {renaming ? (
          <div className="flex items-center gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-2.5 py-1.5 rounded-[8px] text-[14px] text-white bg-white/10 border border-white/20 outline-none" autoFocus />
            <button onClick={async () => { await actions.rename(trip.id, name); setRenaming(false); }} className="w-8 h-8 rounded-[8px] grid place-items-center cursor-pointer text-white" style={{ background: "var(--accent)" }}><Check size={15} strokeWidth={2.5} /></button>
            <button onClick={() => { setName(trip.name); setRenaming(false); }} className="w-8 h-8 rounded-[8px] border border-white/20 text-white/70 grid place-items-center cursor-pointer"><X size={15} strokeWidth={2} /></button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="font-display font-bold text-[16px] leading-tight">{trip.name}</div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setRenaming(true)} title="Rename" className="w-7 h-7 rounded-[7px] border border-white/15 text-white/60 grid place-items-center cursor-pointer hover:text-white hover:border-white/30 transition"><Pencil size={13} strokeWidth={2} /></button>
              <button onClick={() => setConfirming(true)} title="Delete" className="w-7 h-7 rounded-[7px] border border-white/15 text-white/60 grid place-items-center cursor-pointer hover:text-[#F1A88C] hover:border-[#F1A88C] transition"><Trash2 size={13} strokeWidth={2} /></button>
            </div>
          </div>
        )}
        {created && <div className="text-[11.5px] text-white/45 mt-1">Created {created}</div>}

        {confirming ? (
          <div className="mt-3 rounded-[10px] p-2.5" style={{ background: "rgba(241,168,140,.12)", border: "1px solid rgba(241,168,140,.3)" }}>
            <div className="text-[12px] font-semibold" style={{ color: "#F1A88C" }}>Delete this journey and its schedule?</div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => actions.remove(trip.id)} className="flex-1 py-1.5 rounded-[8px] text-white text-[12.5px] font-bold cursor-pointer" style={{ background: "#B3402F" }}>Delete</button>
              <button onClick={() => setConfirming(false)} className="flex-1 py-1.5 rounded-[8px] border border-white/20 text-white text-[12.5px] font-bold cursor-pointer">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={onOpen} className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-white text-[13.5px] font-bold cursor-pointer transition hover:brightness-[1.06]" style={{ background: "var(--accent)" }}>
            Open journey<ArrowRight size={15} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}

export function TripsDashboard() {
  const { ready, trips, activeId, actions } = useTrips();
  const trip = useTrip();
  const loadPlan = useTripLoader();

  const openTrip = async (t: Trip) => {
    actions.select(t.id);
    trip.actions.goWorkspace(); // open the conversational Journey Board
    await loadPlan(t.id, t.destination); // hydrate the store (or → retryable error)
  };

  return (
    <div className="max-w-[1100px] mx-auto px-[clamp(16px,3vw,28px)] py-8">
      <ImmersiveHeading eyebrow="Your journeys" title="Every journey you've imagined" subtitle="Pick up where you left off, or start a new one — the companion remembers each trip's places, pace and plan." />

      <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>
        {/* start a new journey → the AI Welcome */}
        <button
          onClick={() => trip.actions.goWelcome()}
          className="imm-glass imm-glass-hover rounded-[18px] grid place-items-center min-h-[240px] cursor-pointer transition text-white"
        >
          <div className="flex flex-col items-center gap-2.5 text-center px-4">
            <div className="w-12 h-12 rounded-full grid place-items-center" style={{ background: "var(--accent)" }}><Plus size={22} strokeWidth={2} className="text-white" /></div>
            <span className="font-display font-bold text-[15px]">Start a new journey</span>
            <span className="text-[12px] text-white/55 inline-flex items-center gap-1"><Sparkles size={12} style={{ color: "var(--accent)" }} />Describe it — the AI builds it</span>
          </div>
        </button>

        {!ready
          ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="min-h-[240px] rounded-[18px] imm-glass animate-pulse" />)
          : trips.map((t) => <TripCard key={t.id} trip={t} active={t.id === activeId} onOpen={() => openTrip(t)} />)}
      </div>

      {ready && trips.length === 0 && (
        <p className="text-white/50 text-[13.5px] mt-5">No journeys yet — start your first one above.</p>
      )}
    </div>
  );
}
