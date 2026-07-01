"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

// Flight-style departure→return range picker. Pick departure, then return
// (auto-restricted to after departure); the days between highlight as a range.

const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const parse = (s?: string | null) => (s ? new Date(s + "T00:00:00Z") : null);
const fmt = (s?: string | null) => { const d = parse(s); return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : ""; };
const monthLabel = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const nights = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);

export function DateRangePicker({ startISO, endISO, onChange }: {
  startISO?: string | null;
  endISO?: string | null;
  onChange: (departISO: string, returnISO: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const base = parse(startISO) ?? new Date();
  const [view, setView] = useState({ y: base.getUTCFullYear(), m: base.getUTCMonth() });
  const [sel, setSel] = useState<{ dep: string | null; ret: string | null }>({ dep: startISO || null, ret: endISO || null });
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const d = parse(startISO) ?? new Date();
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
    setSel({ dep: startISO || null, ret: endISO || null });
    setHover(null);
  }, [open, startISO, endISO]);

  const today = iso(new Date());
  const pick = (day: string) => {
    if (day < today) return;
    if (!sel.dep || sel.ret) { setSel({ dep: day, ret: null }); return; } // start a fresh range
    if (day <= sel.dep) { setSel({ dep: day, ret: null }); return; }       // earlier → new departure
    setSel({ dep: sel.dep, ret: day });
    onChange(sel.dep, day);
    setOpen(false);
  };

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const pad = first.getUTCDay();
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: pad }, () => null);
  for (let d = 1; d <= days; d++) cells.push(iso(new Date(Date.UTC(view.y, view.m, d))));

  const previewEnd = sel.ret ?? (sel.dep && hover && hover > sel.dep ? hover : null);
  const label = startISO && endISO ? `${fmt(startISO)} – ${fmt(endISO)}` : "Add dates";

  return (
    <>
      <button onClick={() => setOpen(true)} title="Departure & return dates" className="inline-flex items-center gap-1.5 text-white/85 text-[12.5px] cursor-pointer hover:text-white transition">
        <Calendar size={14} style={{ color: "var(--accent)" }} />{label}
      </button>

      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[140] grid place-items-center p-4" style={{ background: "rgba(4,10,20,.6)", backdropFilter: "blur(6px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="imm-bg rounded-[22px] border border-white/12 p-5 w-[min(370px,92vw)] text-white" style={{ boxShadow: "0 40px 90px -30px rgba(0,0,0,.85)", animation: "imm_rise .3s var(--ease-out-expo) both" }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase tracking-[.12em] text-white/50">{sel.dep && !sel.ret ? "Select return" : "Select departure"}</div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="imm-glass imm-glass-hover w-8 h-8 rounded-full grid place-items-center cursor-pointer transition"><X size={15} /></button>
            </div>

            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))} className="w-8 h-8 rounded-full grid place-items-center text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition"><ChevronLeft size={16} /></button>
              <div className="font-display font-bold text-[15px]">{monthLabel(view.y, view.m)}</div>
              <button onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))} className="w-8 h-8 rounded-full grid place-items-center text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition"><ChevronRight size={16} /></button>
            </div>

            <div className="grid grid-cols-7" onMouseLeave={() => setHover(null)}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="text-[10px] font-bold text-white/40 py-1 text-center">{d}</div>)}
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const past = day < today;
                const isDep = day === sel.dep;
                const isRet = day === previewEnd;
                const mid = !!(sel.dep && previewEnd && day > sel.dep && day < previewEnd);
                const end = isDep || isRet;
                return (
                  <button
                    key={i}
                    disabled={past}
                    onClick={() => pick(day)}
                    onMouseEnter={() => setHover(day)}
                    className="h-9 w-full text-[12.5px] cursor-pointer disabled:cursor-default disabled:opacity-20 transition-colors"
                    style={{
                      background: end ? "var(--accent)" : mid ? "color-mix(in oklab, var(--accent) 22%, transparent)" : "transparent",
                      color: end ? "#fff" : "inherit",
                      fontWeight: end ? 700 : 400,
                      borderRadius: isDep && isRet ? 10 : isDep ? "10px 0 0 10px" : isRet ? "0 10px 10px 0" : mid ? 0 : 10,
                    }}
                  >
                    {Number(day.slice(-2))}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 text-[12px] text-white/60 text-center">
              {sel.dep ? (sel.ret ? `${fmt(sel.dep)} → ${fmt(sel.ret)} · ${nights(sel.dep, sel.ret)} night${nights(sel.dep, sel.ret) !== 1 ? "s" : ""}` : `Departing ${fmt(sel.dep)} — now pick your return`) : "Pick your departure day"}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
