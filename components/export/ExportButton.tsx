"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import { usePlanner } from "@/lib/planner/store";
import { TEMPLATES, type BookTemplate } from "./templates";
import { ItineraryBook } from "./ItineraryBook";

function TemplateCard({ t, city, days, onPick }: { t: BookTemplate; city: string; days: number; onPick: () => void }) {
  const labelCls = t.uppercaseLabels ? "uppercase tracking-[.12em]" : "";
  return (
    <button onClick={onPick} className="text-left rounded-[14px] border border-line overflow-hidden bg-surface cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg">
      {/* live preview */}
      <div className="relative h-[130px] p-4 flex flex-col justify-between" style={{ background: t.coverBg, color: t.coverFg }}>
        <div className="absolute inset-0 opacity-[.08]" style={{ background: "repeating-linear-gradient(135deg,#fff 0 2px,transparent 2px 16px)" }} />
        <div className={`relative text-[8.5px] font-bold ${labelCls}`} style={{ opacity: 0.85 }}>Itinera</div>
        <div className="relative">
          <div className={`${t.titleClass} font-bold leading-none`} style={{ fontSize: 24 }}>{city}</div>
          <div className="h-[2px] w-10 mt-1.5" style={{ background: t.accent }} />
        </div>
        <div className="relative text-[8.5px]" style={{ opacity: 0.85 }}>{days} day{days !== 1 ? "s" : ""} · family trip</div>
      </div>
      <div className="p-3">
        <div className="font-bold text-[13px] text-ink">{t.name}</div>
        <div className="text-[11.5px] text-muted leading-snug mt-0.5">{t.blurb}</div>
      </div>
    </button>
  );
}

export function ExportButton({ label = "Export", className, disabled = false }: { label?: string; className?: string; disabled?: boolean } = {}) {
  const { state } = usePlanner();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [book, setBook] = useState<BookTemplate | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const city = state.destination.split(",")[0];
  const days = new Set(state.itinerary.map((it) => `${it.destId}|${it.day}`)).size;

  // Overlays are portaled to <body> so the header's backdrop-filter can't trap position:fixed.
  const overlays = (
    <>
      {galleryOpen && (
        <div className="fixed inset-0 z-[90] grid place-items-center p-4" style={{ background: "rgba(20,16,12,.55)" }} onClick={() => setGalleryOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[760px] max-h-[88vh] overflow-auto vp-scroll bg-bg rounded-[20px] border border-line shadow-2xl vp-pop">
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 border-b border-line" style={{ background: "color-mix(in oklab, var(--bg) 90%, #fff)" }}>
              <div>
                <div className="font-display font-bold text-[17px]">Export your itinerary</div>
                <div className="text-[12.5px] text-muted">Choose a layout — your trip is rendered into a designed travel book.</div>
              </div>
              <button onClick={() => setGalleryOpen(false)} className="w-9 h-9 rounded-[10px] border border-line bg-surface grid place-items-center cursor-pointer text-muted hover:text-ink"><X size={16} strokeWidth={2} /></button>
            </div>
            <div className="p-5 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
              {TEMPLATES.map((t) => (
                <TemplateCard key={t.key} t={t} city={city} days={days || 1} onPick={() => { setGalleryOpen(false); setBook(t); }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {book && <ItineraryBook template={book} onClose={() => setBook(null)} />}
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
