"use client";

import { useState } from "react";
import {
  Car,
  Clock,
  Footprints,
  GripVertical,
  Minus,
  Plus,
  Sparkle,
  TrainFront,
  TriangleAlert,
  Trash2,
} from "lucide-react";
import { EX_THUMBS } from "@/lib/data";
import { dayDirectionsLink } from "@/lib/maps";
import { OpenInMapsButton } from "@/components/maps";
import { formatDurationMin, formatKm, type ExplorePlace, type ItineraryItem } from "@/lib/places";
import { computeTimeline, fmtClock, itemDuration, orderedItems, type TransportMode } from "@/lib/planner/travel";
import { usePlanner } from "@/lib/planner/store";
import { TransportToggle } from "./TransportToggle";

const LEG_ICON: Record<TransportMode, typeof Car> = { walk: Footprints, drive: Car, transit: TrainFront };

const TIPS: Record<string, string> = {
  viewpoints: "Best at golden hour — bring a camera.",
  beaches: "Late afternoon tends to be calmest for families.",
  restaurants: "Popular spots fill up — consider booking ahead.",
  cafes: "A good mid-route coffee break.",
  breakfast: "Start early to beat the morning queue.",
  museums: "Mornings are quietest; allow a little extra time.",
  parks: "Room to relax and let kids burn energy.",
  shopping: "Easy to lose track of time here — pace it.",
  historical: "A short guided tour adds real context.",
  architecture: "Look up — the details are the highlight.",
  nightlife: "Plan your transport back to the hotel.",
  kids: "Plenty to keep younger travellers happy.",
  family: "Easy and fun with children.",
};
function tipFor(p: ExplorePlace): string {
  return TIPS[p.category] ?? (p.tags.includes("Hidden Gem") ? "A local favourite most visitors miss." : "A highlight worth the stop.");
}

function moveBefore(order: ItineraryItem[], dragId: string, beforeId: string | null): ItineraryItem[] {
  const dragged = order.find((i) => i.place.id === dragId);
  if (!dragged) return order;
  const rest = order.filter((i) => i.place.id !== dragId);
  if (!beforeId) return [...rest, dragged];
  const idx = rest.findIndex((i) => i.place.id === beforeId);
  if (idx < 0) return [...rest, dragged];
  rest.splice(idx, 0, dragged);
  return rest;
}

function TravelConnector({ icon: Icon, label }: { icon: typeof Car; label: string }) {
  return (
    <div className="flex items-center gap-2 pl-[26px] py-1.5">
      <span className="w-[10px] h-[10px] rounded-full border-2 border-line bg-surface -ml-[5px]" />
      <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
        <Icon size={13} strokeWidth={2} className="text-accent" />
        {label}
      </span>
    </div>
  );
}

export function ItineraryTimeline() {
  const { state, actions } = usePlanner();
  const [dragId, setDragId] = useState<string | null>(null);
  const day = state.day;
  const dayItems = orderedItems(state.itinerary.filter((it) => it.day === day));
  const timeline = computeTimeline(dayItems, state.center, state.transportMode);
  const dirLink = dayDirectionsLink(dayItems.map((it) => it.place.position));

  const drop = (beforeId: string | null) => {
    if (!dragId) return;
    actions.reorderDay(day, moveBefore(dayItems, dragId, beforeId));
    setDragId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {Array.from({ length: state.dayCount }).map((_, d) => {
            const on = state.day === d;
            const count = state.itinerary.filter((it) => it.day === d).length;
            return (
              <button
                key={d}
                onClick={() => actions.setDay(d)}
                className="px-3.5 py-2 rounded-[12px] border text-[13px] font-bold cursor-pointer transition"
                style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent)" : "var(--surface)", color: on ? "#fff" : "var(--ink)" }}
              >
                Day {d + 1}
                {count > 0 && <span className="ml-1.5 opacity-70">· {count}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <TransportToggle />
        {dayItems.length >= 2 && (
          <button onClick={() => actions.optimizeDay(day)} className="px-3 py-2 rounded-[10px] border border-line bg-surface text-accent text-[12.5px] font-bold cursor-pointer hover:border-accent hover:bg-tint">
            Optimize route
          </button>
        )}
        {dirLink && <OpenInMapsButton href={dirLink} label="Open day route" size="sm" />}
      </div>

      {dayItems.length === 0 ? (
        <div className="border border-dashed border-line rounded-[16px] px-6 py-12 text-center text-muted">
          <div className="font-display font-bold text-ink text-[16px]">Day {day + 1} is open</div>
          <div className="text-[13px] mt-1">Add places from Explore and they&apos;ll appear here as a timeline.</div>
        </div>
      ) : (
        <div className="relative">
          {/* the rail */}
          <div className="absolute left-[26px] top-2 bottom-2 w-0.5 bg-line" />

          <TravelConnector icon={LEG_ICON[timeline.entries[0].travelFromPrev.mode]} label={`From hotel · ${timeline.entries[0].travelFromPrev.min} min · ${formatKm(timeline.entries[0].travelFromPrev.km, state.units)}`} />

          {timeline.entries.map((entry, i) => {
            const it = entry.item;
            const p = it.place;
            const dur = itemDuration(it);
            const thumb = EX_THUMBS[i % EX_THUMBS.length];
            return (
              <div key={p.id}>
                {i > 0 && (
                  <TravelConnector icon={LEG_ICON[entry.travelFromPrev.mode]} label={`${entry.travelFromPrev.min} min · ${formatKm(entry.travelFromPrev.km, state.units)} from previous`} />
                )}
                <div
                  draggable
                  onDragStart={() => setDragId(p.id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => dragId && e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); drop(p.id); }}
                  className="relative flex gap-3 pl-1"
                  style={{ opacity: dragId === p.id ? 0.5 : 1 }}
                >
                  {/* time + node */}
                  <div className="flex flex-col items-center w-[52px] shrink-0 pt-3">
                    <div className="text-[12px] font-bold text-accent font-mono">{fmtClock(entry.arrivalMin)}</div>
                    <div className="w-3 h-3 rounded-full bg-accent border-2 border-surface mt-1.5 z-[1]" style={{ boxShadow: "0 0 0 2px var(--line)" }} />
                  </div>

                  {/* card */}
                  <div className="flex-1 min-w-0 mb-1 bg-surface border border-line rounded-[16px] overflow-hidden shadow-[0_2px_12px_-8px_rgba(0,0,0,.2)]">
                    <div className="flex">
                      <div className="w-[96px] sm:w-[120px] shrink-0 relative" style={{ background: thumb }}>
                        {p.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.photoUrl} alt={p.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10.5px] font-bold uppercase tracking-[.04em] text-accent bg-tint px-2 py-0.5 rounded-md">{p.category}</span>
                            <div className="font-display font-bold text-[16px] leading-tight mt-1.5 truncate">{p.name}</div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setDragId(p.id)} className="text-[#c4bbb0] cursor-grab" title="Drag to reorder"><GripVertical size={15} fill="currentColor" stroke="none" /></button>
                            <button onClick={() => actions.removeFromItinerary(p.id)} title="Remove" className="w-[26px] h-[26px] rounded-md border border-line bg-white text-muted grid place-items-center cursor-pointer hover:border-[#d9534f] hover:text-[#d9534f]"><Trash2 size={13} strokeWidth={2} /></button>
                          </div>
                        </div>

                        {/* duration editor */}
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <div className="inline-flex items-center gap-1 bg-[#f7f3ec] border border-line rounded-lg px-1.5 py-0.5">
                            <button onClick={() => actions.setItemDuration(p.id, dur - 15)} className="w-5 h-5 grid place-items-center text-muted hover:text-accent cursor-pointer" title="Shorten 15 min"><Minus size={12} strokeWidth={2.5} /></button>
                            <span className="inline-flex items-center gap-1 text-[12px] font-bold text-ink min-w-[58px] justify-center"><Clock size={12} strokeWidth={2} className="text-accent" />{formatDurationMin(dur)}</span>
                            <button onClick={() => actions.setItemDuration(p.id, dur + 15)} className="w-5 h-5 grid place-items-center text-muted hover:text-accent cursor-pointer" title="Add 15 min"><Plus size={12} strokeWidth={2.5} /></button>
                          </div>
                          {p.openNow === false && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md" style={{ background: "#f7e4e2", color: "#9e3c37" }}>
                              <TriangleAlert size={11} strokeWidth={2} />Closed now — check hours
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-start gap-1.5 text-[12px] text-muted leading-[1.45]">
                          <Sparkle size={13} strokeWidth={1.8} className="text-accent shrink-0 mt-0.5" />
                          {tipFor(p)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {timeline.returnLeg && (
            <TravelConnector icon={LEG_ICON[timeline.returnLeg.mode]} label={`Back to hotel · ${timeline.returnLeg.min} min · ${formatKm(timeline.returnLeg.km, state.units)}`} />
          )}
        </div>
      )}
    </div>
  );
}
