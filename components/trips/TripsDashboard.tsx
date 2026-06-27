"use client";

import { useState } from "react";
import { ArrowRight, Check, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { DESTINATION_SUGGESTIONS } from "@/lib/data";
import { useTrip } from "@/lib/store";
import { useTrips, type Trip } from "@/lib/trips/store";

function NewTrip({ onCreated }: { onCreated: (t: Trip) => void }) {
  const { actions } = useTrips();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!destination.trim() || busy) return;
    setBusy(true);
    const trip = await actions.createTrip(name || destination.split(",")[0], destination);
    setBusy(false);
    if (trip) {
      setOpen(false);
      setName("");
      setDestination("");
      onCreated(trip);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-[18px] border-2 border-dashed border-line bg-surface/50 grid place-items-center min-h-[150px] cursor-pointer transition hover:border-accent hover:bg-tint"
      >
        <div className="flex flex-col items-center gap-2 text-accent">
          <div className="w-11 h-11 rounded-full bg-tint grid place-items-center"><Plus size={22} strokeWidth={2} /></div>
          <span className="font-bold text-[14px]">New trip</span>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-[18px] border border-line bg-surface p-4 flex flex-col">
      <div className="font-display font-bold text-[15px] mb-2">New trip</div>
      <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Where to? e.g. Barcelona, Spain" className="w-full px-3 py-2.5 border border-line rounded-[10px] text-[14px] bg-white outline-none vp-input" autoFocus />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Trip name (optional)" className="w-full mt-2 px-3 py-2.5 border border-line rounded-[10px] text-[14px] bg-white outline-none vp-input" />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {DESTINATION_SUGGESTIONS.slice(0, 4).map((s) => (
          <button key={s.name} onClick={() => setDestination(s.name)} className="px-2.5 py-1 rounded-full border border-line bg-white text-[12px] text-muted cursor-pointer hover:border-accent hover:text-accent">{s.name.split(",")[0]}</button>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={create} disabled={!destination.trim() || busy} className="flex-1 py-2.5 rounded-[10px] bg-accent text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06] disabled:opacity-60">{busy ? "Creating…" : "Create trip"}</button>
        <button onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-[10px] border border-line bg-white text-muted text-[13.5px] font-bold cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

function TripCard({ trip, active, onOpen }: { trip: Trip; active: boolean; onOpen: () => void }) {
  const { actions } = useTrips();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(trip.name);
  const [confirming, setConfirming] = useState(false);
  const city = trip.destination.split(",")[0];
  const created = trip.created_at ? new Date(trip.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div className="rounded-[18px] border bg-surface overflow-hidden flex flex-col transition hover:-translate-y-0.5 hover:shadow-lg" style={{ borderColor: active ? "var(--accent)" : "var(--line)", boxShadow: "0 4px 18px -12px rgba(0,0,0,.18)" }}>
      <div className="h-[88px] relative" style={{ background: "#002B36" }}>
        {active && <span className="absolute top-2.5 right-2.5 text-[10.5px] font-bold uppercase tracking-wide bg-white text-ink px-2 py-0.5 rounded-md">Active</span>}
        <div className="absolute bottom-2.5 left-3.5 text-white">
          <div className="flex items-center gap-1.5 text-[12px] opacity-90"><MapPin size={12} strokeWidth={2} />{city}</div>
        </div>
      </div>
      <div className="p-3.5 flex flex-col flex-1">
        {renaming ? (
          <div className="flex items-center gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-2.5 py-1.5 border border-line rounded-[8px] text-[14px] bg-white outline-none vp-input" autoFocus />
            <button onClick={async () => { await actions.rename(trip.id, name); setRenaming(false); }} className="w-8 h-8 rounded-[8px] bg-accent text-white grid place-items-center cursor-pointer"><Check size={15} strokeWidth={2.5} /></button>
            <button onClick={() => { setName(trip.name); setRenaming(false); }} className="w-8 h-8 rounded-[8px] border border-line bg-white text-muted grid place-items-center cursor-pointer"><X size={15} strokeWidth={2} /></button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="font-display font-bold text-[16px] leading-tight">{trip.name}</div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setRenaming(true)} title="Rename" className="w-7 h-7 rounded-[7px] border border-line bg-white text-muted grid place-items-center cursor-pointer hover:text-ink"><Pencil size={13} strokeWidth={2} /></button>
              <button onClick={() => setConfirming(true)} title="Delete" className="w-7 h-7 rounded-[7px] border border-line bg-white text-muted grid place-items-center cursor-pointer hover:text-[#9e3c37] hover:border-[#9e3c37]"><Trash2 size={13} strokeWidth={2} /></button>
            </div>
          </div>
        )}
        {created && <div className="text-[11.5px] text-muted mt-1">Created {created}</div>}

        {confirming ? (
          <div className="mt-3 rounded-[10px] p-2.5" style={{ background: "#f7e4e2" }}>
            <div className="text-[12px] font-semibold" style={{ color: "#9e3c37" }}>Delete this trip and its schedule?</div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => actions.remove(trip.id)} className="flex-1 py-1.5 rounded-[8px] text-white text-[12.5px] font-bold cursor-pointer" style={{ background: "#9e3c37" }}>Delete</button>
              <button onClick={() => setConfirming(false)} className="flex-1 py-1.5 rounded-[8px] border border-line bg-white text-ink text-[12.5px] font-bold cursor-pointer">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={onOpen} className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] bg-accent text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06]">
            Open trip<ArrowRight size={15} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}

export function TripsDashboard() {
  const { ready, trips, activeId, actions } = useTrips();
  const trip = useTrip();

  const openTrip = (t: Trip) => {
    actions.select(t.id);
    trip.actions.setDestination(t.destination);
    trip.actions.goForm();
  };

  return (
    <div className="vp-scroll min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1100px] mx-auto px-[clamp(16px,3vw,28px)] py-6">
        <div>
          <div className="font-display font-bold text-[clamp(26px,3.4vw,36px)] tracking-[-.02em]">Your trips</div>
          <p className="text-muted text-[14.5px] mt-1.5">Every trip keeps its own saved places and schedule — private to your account.</p>
        </div>

        {!ready ? (
          <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[200px] rounded-[18px] border border-line vp-shimmer" />)}
          </div>
        ) : (
          <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>
            <NewTrip onCreated={openTrip} />
            {trips.map((t) => (
              <TripCard key={t.id} trip={t} active={t.id === activeId} onOpen={() => openTrip(t)} />
            ))}
          </div>
        )}

        {ready && trips.length === 0 && (
          <p className="text-muted text-[13.5px] mt-4">No trips yet — create your first one above to start planning.</p>
        )}
      </div>
    </div>
  );
}
