"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTrip } from "@/lib/store";
import { useTrips, type Trip } from "@/lib/trips/store";
import { DestinationPicker } from "@/components/destinations/DestinationPicker";
import { CityImage } from "@/components/destinations/CityImage";
import { loadTrip, saveDestinations } from "@/lib/destinations/repository";
import { loadCityImage } from "@/lib/geo";
import type { SelectedDestination } from "@/lib/geo";

function NewTripModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (trip: Trip, dests: SelectedDestination[]) => void;
}) {
  const { actions } = useTrips();
  const [name, setName] = useState("");
  const [dests, setDests] = useState<SelectedDestination[]>([]);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function create() {
    if (!dests.length || busy) return;
    setBusy(true);
    const primary = dests[0];
    const destString = [primary.cityName, primary.countryName].filter(Boolean).join(", ");
    const tripName = name.trim() || (dests.length > 1 ? `${primary.cityName} +${dests.length - 1}` : primary.cityName);
    // Resolve a representative photo for each city (best-effort) so cards are
    // recognizable and the image persists with the destination.
    const withImages = await Promise.all(
      dests.map(async (d) => ({ ...d, image: d.image ?? (await loadCityImage(d.cityName, d.countryName).catch(() => null)) }))
    );
    const trip = await actions.createTrip(tripName, destString);
    if (trip) await saveDestinations(trip.id, withImages);
    setBusy(false);
    if (trip) onCreated(trip, withImages);
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-8 overflow-y-auto vp-scroll"
      style={{ background: "rgba(0,43,54,.45)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[640px] bg-surface rounded-[22px] border border-line my-auto vp-pop"
        style={{ boxShadow: "0 30px 70px -30px rgba(0,0,0,.4)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-line">
          <div>
            <div className="font-display font-bold text-[20px] tracking-[-.01em]">Plan a new trip</div>
            <p className="text-muted text-[13px] mt-0.5">Choose a country, then add the cities you&apos;ll visit.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-[10px] border border-line text-muted grid place-items-center cursor-pointer hover:text-ink shrink-0"><X size={17} strokeWidth={2} /></button>
        </div>

        <div className="p-5 sm:p-6">
          <label className="text-[12.5px] font-semibold text-ink">Trip name <span className="text-muted font-normal">(optional)</span></label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Europe Summer 2026"
            className="w-full mt-1.5 mb-6 px-3.5 py-[12px] border border-line rounded-xl text-[14.5px] bg-surface outline-none vp-input"
          />
          <DestinationPicker value={dests} onChange={setDests} />
        </div>

        <div className="flex items-center justify-between gap-3 p-5 sm:p-6 border-t border-line sticky bottom-0 bg-surface rounded-b-[22px]">
          <span className="text-[12.5px] text-muted hidden sm:block">
            {dests.length ? `${dests.length} destination${dests.length > 1 ? "s" : ""} selected` : "Add at least one destination"}
          </span>
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2.5 rounded-[11px] border border-line bg-surface text-muted text-[13.5px] font-bold cursor-pointer hover:text-ink">Cancel</button>
            <button onClick={create} disabled={!dests.length || busy} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[11px] bg-accent text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06] disabled:opacity-50 disabled:cursor-default">
              {busy ? "Creating…" : "Create trip"}<ArrowRight size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
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
      <CityImage name={city} country={trip.destination.split(",").slice(1).join(",").trim()} className="h-[96px] w-full">
        {active && <span className="absolute top-2.5 right-2.5 z-10 text-[10.5px] font-bold uppercase tracking-wide bg-white text-ink px-2 py-0.5 rounded-md">Active</span>}
        <div className="absolute bottom-2.5 left-3.5 z-10 text-white">
          <div className="flex items-center gap-1.5 text-[12px]" style={{ textShadow: "0 1px 6px rgba(0,0,0,.4)" }}><MapPin size={12} strokeWidth={2} />{city}</div>
        </div>
      </CityImage>
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
              <button onClick={() => setConfirming(true)} title="Delete" className="w-7 h-7 rounded-[7px] border border-line bg-white text-muted grid place-items-center cursor-pointer hover:text-[#9A6512] hover:border-[#9A6512]"><Trash2 size={13} strokeWidth={2} /></button>
            </div>
          </div>
        )}
        {created && <div className="text-[11.5px] text-muted mt-1">Created {created}</div>}

        {confirming ? (
          <div className="mt-3 rounded-[10px] p-2.5" style={{ background: "#FCEFD6" }}>
            <div className="text-[12px] font-semibold" style={{ color: "#9A6512" }}>Delete this trip and its schedule?</div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => actions.remove(trip.id)} className="flex-1 py-1.5 rounded-[8px] text-white text-[12.5px] font-bold cursor-pointer" style={{ background: "#9A6512" }}>Delete</button>
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
  const [creating, setCreating] = useState(false);

  const openTrip = async (t: Trip) => {
    actions.select(t.id);
    trip.actions.setDestination(t.destination);
    trip.actions.beginTripLoad(); // clear prior plan + show skeleton (never sample data)
    trip.actions.goForm();
    const plan = await loadTrip(t.id);
    trip.actions.hydrateTrip(plan.destinations, plan.budgetLevel);
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
            <button
              onClick={() => setCreating(true)}
              className="rounded-[18px] border-2 border-dashed border-line bg-surface/50 grid place-items-center min-h-[150px] cursor-pointer transition hover:border-accent hover:bg-tint"
            >
              <div className="flex flex-col items-center gap-2 text-accent">
                <div className="w-11 h-11 rounded-full bg-tint grid place-items-center"><Plus size={22} strokeWidth={2} /></div>
                <span className="font-bold text-[14px]">New trip</span>
              </div>
            </button>
            {trips.map((t) => (
              <TripCard key={t.id} trip={t} active={t.id === activeId} onOpen={() => openTrip(t)} />
            ))}
          </div>
        )}

        {ready && trips.length === 0 && (
          <p className="text-muted text-[13.5px] mt-4">No trips yet — create your first one above to start planning.</p>
        )}
      </div>

      {creating && (
        <NewTripModal
          onClose={() => setCreating(false)}
          onCreated={(t) => {
            setCreating(false);
            openTrip(t);
          }}
        />
      )}
    </div>
  );
}
