"use client";

import { useState } from "react";
import { CloudSun, GripVertical, MapPin, Moon, Sun, Trash2 } from "lucide-react";
import { dayDirectionsLink } from "@/lib/maps";
import { OpenInMapsButton } from "@/components/maps";
import { formatDurationMin, formatKm, haversineKm, SLOTS, SLOT_LABELS, type ItineraryItem, type Slot } from "@/lib/places";
import { usePlanner } from "@/lib/planner/store";

const SLOT_ICON: Record<Slot, typeof Sun> = { morning: Sun, afternoon: CloudSun, evening: Moon };

function reorder(all: ItineraryItem[], dragId: string, day: number, targetSlot: Slot, beforeId: string | null): ItineraryItem[] {
  const dragged = all.find((i) => i.place.id === dragId);
  if (!dragged) return all;
  const rest = all.filter((i) => i.place.id !== dragId);
  const moved = { ...dragged, day, slot: targetSlot };
  const slotItems = rest.filter((i) => i.day === day && i.slot === targetSlot).sort((a, b) => a.position - b.position);
  let insertAt = slotItems.length;
  if (beforeId) {
    const idx = slotItems.findIndex((i) => i.place.id === beforeId);
    if (idx >= 0) insertAt = idx;
  }
  slotItems.splice(insertAt, 0, moved);
  const renum = slotItems.map((it, idx) => ({ ...it, position: idx }));
  const others = rest.filter((i) => !(i.day === day && i.slot === targetSlot));
  return [...others, ...renum];
}

export function ScheduleBuilder() {
  const { state, actions } = usePlanner();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<Slot | null>(null);
  const day = state.day;

  const dayItems = state.itinerary.filter((it) => it.day === day);
  const ordered = [...dayItems].sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.position - b.position);
  const prevDist = new Map<string, number>();
  for (let i = 1; i < ordered.length; i++) {
    prevDist.set(ordered[i].place.id, haversineKm(ordered[i - 1].place.position, ordered[i].place.position));
  }
  const dirLink = dayDirectionsLink(ordered.map((it) => it.place.position));

  const drop = (slot: Slot, beforeId: string | null) => {
    if (!dragId) return;
    actions.replaceItinerary(reorder(state.itinerary, dragId, day, slot, beforeId));
    setDragId(null);
    setOverSlot(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* day selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {Array.from({ length: state.dayCount }).map((_, d) => {
          const on = state.day === d;
          const count = state.itinerary.filter((it) => it.day === d).length;
          return (
            <button
              key={d}
              onClick={() => actions.setDay(d)}
              className="px-4 py-2 rounded-[12px] border text-[13px] font-bold cursor-pointer transition"
              style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent)" : "var(--surface)", color: on ? "#fff" : "var(--ink)" }}
            >
              Day {d + 1}
              {count > 0 && <span className="ml-1.5 opacity-70">· {count}</span>}
            </button>
          );
        })}
        <div className="flex-1" />
        {dirLink && <OpenInMapsButton href={dirLink} label="Open day route" size="sm" />}
      </div>

      {/* slot columns */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
        {SLOTS.map((slot) => {
          const Icon = SLOT_ICON[slot];
          const items = dayItems.filter((it) => it.slot === slot).sort((a, b) => a.position - b.position);
          return (
            <div
              key={slot}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverSlot(slot); } }}
              onDrop={(e) => { e.preventDefault(); drop(slot, null); }}
              className="rounded-[16px] border p-3 transition-colors min-h-[120px]"
              style={{ borderColor: overSlot === slot ? "var(--accent)" : "var(--line)", background: overSlot === slot ? "var(--tint)" : "var(--surface)" }}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-accent flex"><Icon size={16} strokeWidth={2} /></span>
                <span className="font-display font-bold text-[14px]">{SLOT_LABELS[slot]}</span>
                <span className="text-[11.5px] text-muted">· {items.length}</span>
              </div>

              {items.length === 0 && (
                <div className="text-[12px] text-muted border border-dashed border-line rounded-xl px-3 py-4 text-center">
                  Drag a stop here, or add one from Explore.
                </div>
              )}

              <div className="flex flex-col gap-2">
                {items.map((it) => (
                  <div
                    key={it.place.id}
                    draggable
                    onDragStart={() => setDragId(it.place.id)}
                    onDragEnd={() => { setDragId(null); setOverSlot(null); }}
                    onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(slot, it.place.id); }}
                    className="bg-white border border-line rounded-[12px] p-2.5 flex items-start gap-2 transition-opacity"
                    style={{ opacity: dragId === it.place.id ? 0.5 : 1 }}
                  >
                    <span className="text-[#c4bbb0] cursor-grab mt-0.5 flex"><GripVertical size={15} fill="currentColor" stroke="none" /></span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] truncate">{it.place.name}</div>
                      <div className="text-[11px] text-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{formatDurationMin(it.place.estDurationMin)}</span>
                        {prevDist.has(it.place.id) && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin size={10} strokeWidth={2} />{formatKm(prevDist.get(it.place.id)!, state.units)} from prev
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => actions.removeFromItinerary(it.place.id)}
                      title="Remove"
                      className="shrink-0 w-[26px] h-[26px] rounded-md border border-line bg-white text-muted grid place-items-center cursor-pointer hover:border-[#d9534f] hover:text-[#d9534f]"
                    >
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
