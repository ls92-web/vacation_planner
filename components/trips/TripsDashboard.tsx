"use client";

import { useRef, useState } from "react";
import { AlertCircle, ArrowRight, Check, MapPin, Pencil, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { useTrip } from "@/lib/store";
import { useTrips, type Trip } from "@/lib/trips/store";
import { CityImage } from "@/components/destinations/CityImage";
import { useTripLoader } from "@/lib/trips/useTripLoader";
import { useComposeJourney } from "@/lib/trips/useComposeJourney";
import { JourneyCore, type CoreNode } from "@/components/immersive/JourneyCore";

function TripCard({ trip, active, index, onOpen }: { trip: Trip; active: boolean; index: number; onOpen: () => void }) {
  const { actions } = useTrips();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(trip.name);
  const [confirming, setConfirming] = useState(false);
  const city = trip.destination.split(",")[0];
  const created = trip.created_at ? new Date(trip.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div
      className="journey-card imm-glass rounded-[20px] overflow-hidden flex flex-col vp-fade-fast"
      style={{ animationDelay: `${index * 0.05}s`, borderColor: active ? "var(--accent)" : undefined }}
    >
      <button onClick={onOpen} className="relative h-[132px] w-full block cursor-pointer overflow-hidden text-left">
        <CityImage name={city} country={trip.destination.split(",").slice(1).join(",").trim()} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(6,12,22,.1) 0%, rgba(6,12,22,.35) 55%, rgba(6,12,22,.86) 100%)" }} />
        {/* constellation node */}
        <span className="absolute top-3 left-3.5 z-10 w-2 h-2 rounded-full" style={{ background: "var(--accent)", boxShadow: "0 0 10px 2px color-mix(in oklab, var(--accent) 80%, transparent)" }} />
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
          <button onClick={onOpen} className="journey-open mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-white text-[13.5px] font-bold cursor-pointer" style={{ background: "var(--accent)" }}>
            Step into journey<ArrowRight size={15} strokeWidth={2} />
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
  const [warping, setWarping] = useState(false);
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // The "travel into the journey" transition — a brief warp before the workspace.
  const playWarp = () => new Promise<void>((res) => { setWarping(true); setTimeout(res, 460); });
  const { compose, busy, error, setError } = useComposeJourney(playWarp);

  const openTrip = async (t: Trip) => {
    await playWarp();
    actions.select(t.id);
    trip.actions.goWorkspace();
    await loadPlan(t.id, t.destination);
  };

  // The hub Core reflects your universe of journeys as orbiting stars.
  const hubNodes: CoreNode[] | undefined = trips.length
    ? trips.slice(0, 7).map((_, i) => {
        const n = Math.min(trips.length, 7);
        const ang = -Math.PI / 2 + (i / n) * 2 * Math.PI;
        return { x: Math.cos(ang) * 0.6, y: Math.sin(ang) * 0.6, active: i === 0 };
      })
    : undefined;
  const coreState: "idle" | "thinking" | "routing" = busy ? "routing" : value.trim() ? "thinking" : "idle";

  return (
    <div className="max-w-[1100px] mx-auto px-[clamp(16px,3vw,28px)] pb-14">
      {/* ===== hub: the Core + describe-to-create ===== */}
      <div className="flex flex-col items-center text-center pt-2">
        <JourneyCore size="clamp(140px,19vw,196px)" state={coreState} nodes={hubNodes} />
        <h1 className="font-brand font-bold tracking-[-.02em] leading-[1.04] -mt-2" style={{ fontSize: "clamp(30px,5vw,50px)" }}>Your travel universe</h1>
        <p className="text-white/60 text-[14.5px] mt-2.5 max-w-[460px]">Describe a new journey, or step back into one — the companion remembers every trip’s places, pace and plan.</p>

        {/* compose a new journey inline (no modal) */}
        <div className="w-full max-w-[560px] mt-6 flex items-end gap-2 rounded-[18px] p-2.5 text-left" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.14)", backdropFilter: "blur(14px)", boxShadow: "0 24px 60px -28px rgba(0,0,0,.7)" }}>
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); compose(value); } }}
            rows={1}
            placeholder="e.g. A week of food and design in Copenhagen…"
            className="flex-1 resize-none bg-transparent outline-none border-none px-3 py-2.5 text-[15px] leading-relaxed text-white placeholder:text-white/40 max-h-[120px]"
          />
          <button
            onClick={() => compose(value)}
            disabled={busy || !value.trim()}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[13px] text-[14px] font-bold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 10px 24px -10px var(--accent)", transition: "transform .2s var(--ease-spring), filter .2s ease" }}
          >
            {busy ? <><Sparkles size={16} strokeWidth={2} className="animate-pulse" />Charting…</> : <>Plan it<ArrowRight size={16} strokeWidth={2} /></>}
          </button>
        </div>
        {error && (
          <div className="w-full max-w-[560px] mt-3 flex items-center gap-3 rounded-[14px] px-4 py-3 text-left vp-fade-fast" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(240,168,140,.32)" }} role="alert">
            <AlertCircle size={17} strokeWidth={2} className="shrink-0" style={{ color: "#F1A88C" }} />
            <span className="flex-1 text-[13px] leading-snug text-white/85">{error}</span>
            <button onClick={() => compose(value)} disabled={busy} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold text-white cursor-pointer transition hover:brightness-[1.06] disabled:opacity-50" style={{ background: "var(--accent)" }}>
              <RefreshCw size={13} strokeWidth={2.2} />Try again
            </button>
          </div>
        )}
      </div>

      {/* ===== constellation of journeys ===== */}
      {(ready ? trips.length > 0 : true) && (
        <div className="mt-11">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={13} style={{ color: "var(--accent)" }} />
            <span className="text-[11.5px] uppercase tracking-[.14em] text-white/55">Your journeys</span>
            {ready && trips.length > 0 && <span className="text-[11.5px] text-white/35">· {trips.length}</span>}
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(238px,1fr))" }}>
            {!ready
              ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="min-h-[248px] rounded-[20px] imm-glass animate-pulse" />)
              : trips.map((t, i) => <TripCard key={t.id} trip={t} index={i} active={t.id === activeId} onOpen={() => openTrip(t)} />)}
          </div>
        </div>
      )}

      {ready && trips.length === 0 && (
        <p className="text-white/45 text-[13.5px] mt-10 text-center">No journeys yet — describe your first one above and watch it take shape.</p>
      )}

      {/* warp: travelling into the journey */}
      {warping && (
        <div className="fixed inset-0 z-[200] pointer-events-none grid place-items-center">
          <div className="absolute inset-0 warp-veil" style={{ background: "radial-gradient(circle at 50% 46%, color-mix(in oklab, var(--accent) 26%, transparent), rgba(4,10,20,.92) 68%)" }} />
          <div className="warp-ring" style={{ width: 120, height: 120, borderRadius: "50%", border: "2px solid var(--accent)", boxShadow: "0 0 44px 6px color-mix(in oklab, var(--accent) 70%, transparent)" }} />
        </div>
      )}
    </div>
  );
}
