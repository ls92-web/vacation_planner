"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import type { ItineraryItem } from "@/lib/places";
import type { LatLng } from "@/lib/maps";
import type { TransportMode } from "@/lib/planner/travel";
import { TEMPLATES, type BookTemplate } from "./templates";
import { ItineraryBookView } from "./ItineraryBook";
import { JourneyCore } from "@/components/immersive/JourneyCore";

function TemplateCard({ t, city, days, onPick }: { t: BookTemplate; city: string; days: number; onPick: () => void }) {
  const labelCls = t.uppercaseLabels ? "uppercase tracking-[.12em]" : "";
  return (
    <button onClick={onPick} className="journey-card imm-glass text-left rounded-[16px] overflow-hidden cursor-pointer">
      {/* the printed cover, as a swatch */}
      <div className="relative h-[132px] p-4 flex flex-col justify-between" style={{ background: t.coverBg, color: t.coverFg }}>
        <div className="absolute inset-0 opacity-[.08]" style={{ background: "repeating-linear-gradient(135deg,#fff 0 2px,transparent 2px 16px)" }} />
        <div className={`relative text-[8.5px] font-bold ${labelCls}`} style={{ opacity: 0.85 }}>Itinera</div>
        <div className="relative">
          <div className={`${t.titleClass} font-bold leading-none`} style={{ fontSize: 24 }}>{city}</div>
          <div className="h-[2px] w-10 mt-1.5" style={{ background: t.accent }} />
        </div>
        <div className="relative text-[8.5px]" style={{ opacity: 0.85 }}>{days} day{days !== 1 ? "s" : ""} · travel guide</div>
      </div>
      <div className="p-3.5 text-white">
        <div className="font-display font-bold text-[13.5px]">{t.name}</div>
        <div className="text-[11.5px] text-white/55 leading-snug mt-0.5">{t.blurb}</div>
      </div>
    </button>
  );
}

/**
 * Presentational export control (button → template gallery → rendered book).
 * Takes schedule data as props so it works both in the planner and in the
 * conversational workspace (which passes its own live itinerary).
 */
export function ExportControl({
  itinerary,
  destination,
  center,
  transportMode,
  units,
  label = "Export",
  className,
  disabled = false,
}: {
  itinerary: ItineraryItem[];
  destination: string;
  center: LatLng;
  transportMode: TransportMode;
  units: "km" | "mi";
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [book, setBook] = useState<BookTemplate | null>(null);
  const [sealing, setSealing] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const city = destination.split(",")[0];
  const days = new Set(itinerary.map((it) => `${it.destId}|${it.day}`)).size;

  // Picking a cover plays a brief "binding" flourish, then the guide unfurls.
  const pick = (t: BookTemplate) => {
    setGalleryOpen(false);
    setSealing(true);
    setTimeout(() => { setSealing(false); setBook(t); }, 900);
  };

  // Overlays are portaled to <body> so the header's backdrop-filter can't trap position:fixed.
  const overlays = (
    <>
      {galleryOpen && (
        <div className="fixed inset-0 z-[90] grid place-items-center p-4 warp-veil" style={{ background: "rgba(4,10,20,.66)", backdropFilter: "blur(8px)" }} onClick={() => setGalleryOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="imm-bg w-full max-w-[720px] max-h-[88vh] overflow-auto imm-scroll rounded-[24px] border border-white/12 vp-pop" style={{ boxShadow: "0 50px 110px -40px rgba(0,0,0,.85)" }}>
            <div className="relative flex flex-col items-center text-center pt-7 px-6">
              <JourneyCore size="clamp(96px,13vw,124px)" state="routing" />
              <div className="font-brand font-bold tracking-[-.01em] mt-1" style={{ fontSize: "clamp(22px,3.4vw,30px)", color: "#fff" }}>Seal your journey</div>
              <p className="text-white/60 text-[13.5px] mt-1.5 max-w-[440px]">Your {city} plan, bound into a keepsake travel guide. Choose its cover.</p>
              <button onClick={() => setGalleryOpen(false)} aria-label="Close" className="absolute top-4 right-4 imm-glass imm-glass-hover w-9 h-9 rounded-full grid place-items-center cursor-pointer text-white transition"><X size={16} strokeWidth={2} /></button>
            </div>
            <div className="p-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
              {TEMPLATES.map((t) => (
                <TemplateCard key={t.key} t={t} city={city} days={days || 1} onPick={() => pick(t)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {sealing && (
        <div className="fixed inset-0 z-[95] pointer-events-none grid place-items-center">
          <div className="absolute inset-0 warp-veil" style={{ background: "radial-gradient(circle at 50% 46%, color-mix(in oklab, var(--accent) 26%, transparent), rgba(4,10,20,.94) 68%)" }} />
          <div className="relative flex flex-col items-center gap-4">
            <JourneyCore size={140} state="routing" />
            <div className="text-[12.5px] tracking-[.18em] uppercase text-white/60" style={{ animation: "logo_halo 1.6s var(--ease-soft) infinite" }}>Binding your journey</div>
          </div>
        </div>
      )}

      {book && (
        <ItineraryBookView
          template={book}
          onClose={() => setBook(null)}
          itinerary={itinerary}
          center={center}
          transportMode={transportMode}
          units={units}
        />
      )}
    </>
  );

  return (
    <>
      <button
        onClick={() => { if (!disabled) setGalleryOpen(true); }}
        disabled={disabled}
        style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
        className={className ?? "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[11px] bg-ink text-white text-[13px] font-bold cursor-pointer hover:brightness-125 transition"}
      >
        <Download size={15} strokeWidth={2} />{label}
      </button>
      {mounted && createPortal(overlays, document.body)}
    </>
  );
}
