"use client";

import { useSyncExternalStore } from "react";
import { Bell, Check, ChevronRight, Sparkle } from "lucide-react";
import { useTrip } from "@/lib/store";
import { useTrips } from "@/lib/trips/store";
import type { Screen } from "@/lib/types";
import { getSaveSnapshot, getServerSaveSnapshot, subscribeSave } from "@/lib/ui/saveStatus";
import { AccountButton } from "@/components/auth/AccountButton";

const SCREEN_LABEL: Record<Screen, string> = {
  auth: "Sign in",
  trips: "My Trips",
  form: "Route Planner",
  explore: "Explore & Plan",
  generating: "Generating",
  plan: "Itinerary",
};

function relativeTime(ts: number): string {
  if (!ts) return "";
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function SaveStatus() {
  const snap = useSyncExternalStore(subscribeSave, getSaveSnapshot, getServerSaveSnapshot);
  if (snap.state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
        <span className="w-3.5 h-3.5 border-2 border-line border-t-accent rounded-full vp-spin" />
        Saving…
      </span>
    );
  }
  if (snap.state === "unsaved") {
    return <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "#9A6512" }}><span className="w-2 h-2 rounded-full" style={{ background: "#F5A623" }} />Unsaved changes</span>;
  }
  if (snap.state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: "#0A7A76" }}>
        <Check size={13} strokeWidth={2.5} />Saved <span className="text-muted">· {relativeTime(snap.lastSaved)}</span>
      </span>
    );
  }
  return null;
}

export function TopBar() {
  const { state, actions } = useTrip();
  const { activeTrip } = useTrips();

  return (
    <header className="sticky top-0 z-40 h-[60px] border-b border-line flex items-center gap-4 px-4 sm:px-6" style={{ background: "color-mix(in oklab, var(--bg) 82%, #fff)", backdropFilter: "blur(12px)" }}>
      {/* breadcrumb + title */}
      <div className="min-w-0 flex-1">
        <div className="hidden sm:flex items-center gap-1.5 text-[11.5px] text-muted">
          <button onClick={actions.goTrips} className="hover:text-ink cursor-pointer">Dashboard</button>
          <ChevronRight size={12} strokeWidth={2} />
          <button onClick={actions.goTrips} className="hover:text-ink cursor-pointer">My Trips</button>
          {activeTrip && (
            <>
              <ChevronRight size={12} strokeWidth={2} />
              <span className="text-ink font-semibold truncate max-w-[180px]">{activeTrip.name}</span>
            </>
          )}
          <ChevronRight size={12} strokeWidth={2} />
          <span>{SCREEN_LABEL[state.screen]}</span>
        </div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className={`truncate ${activeTrip ? "font-display font-bold text-[16px] tracking-[-.01em]" : "font-brand font-semibold text-[18px]"}`}>{activeTrip?.name ?? "Itinera"}</span>
          {activeTrip && <span className="text-[12.5px] text-muted truncate hidden md:inline">· {activeTrip.destination}</span>}
        </div>
      </div>

      {/* right cluster */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="hidden sm:block"><SaveStatus /></div>
        <button
          onClick={() => actions.goExplore()}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-[11px] bg-accent text-white text-[13px] font-bold cursor-pointer hover:brightness-[1.06] transition"
          style={{ boxShadow: "0 8px 18px -10px var(--accent)" }}
        >
          <Sparkle size={15} strokeWidth={1.8} />AI Assistant
        </button>
        <button onClick={() => actions.flash("You're all caught up — no new notifications.")} title="Notifications" className="relative w-9 h-9 rounded-[10px] border border-line bg-surface grid place-items-center text-muted hover:text-ink cursor-pointer">
          <Bell size={17} strokeWidth={2} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-accent2" />
        </button>
        <AccountButton inline />
      </div>
    </header>
  );
}
