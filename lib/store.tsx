"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DAYS,
  INITIAL_CHAT,
  INITIAL_DESTINATIONS,
  PLACES,
  replyFor,
} from "./data";
import type {
  AccomType,
  AuthMode,
  ChatMessage,
  DayPlan,
  Destination,
  ExploreTab,
  PlanTab,
  Priority,
  Screen,
  ThemeName,
  TransportMode,
  Units,
} from "./types";
import type { AIMessage, TripContext } from "./ai";
import type { SelectedDestination } from "./geo";
import type { BudgetLevel } from "./budget/estimate";
import { fetchItinerary, streamAssistantReply } from "./ai-client";
import { placeCoords } from "./maps/coords";
import type { PlaceResult } from "./maps/types";

interface AppState {
  screen: Screen;
  authMode: AuthMode;
  theme: ThemeName;
  dest: string;
  destOpen: boolean;
  adults: number;
  kids: number;
  pace: string;
  destinations: Destination[];
  budgetLevel: BudgetLevel;
  transports: Record<string, TransportMode>;
  dragId: number | null;
  dragOverId: number | null;
  routing: boolean;
  exSearch: string;
  exTab: ExploreTab;
  exCat: string;
  exSmart: string[];
  exSelected: { id: string; priority: Priority }[];
  exSaved: string[];
  exExpanded: string | null;
  exDragId: string | null;
  exDragOver: string | null;
  exMapSel: string | null;
  genStep: number;
  planTab: PlanTab;
  day: number;
  units: Units;
  pin: number | null;
  chat: ChatMessage[];
  chatInput: string;
  typing: boolean;
  toast: string | null;
  scrollId: string | null;
  days: DayPlan[];
  /** Places discovered via Google Places and added to the trip. */
  mapPicks: PlaceResult[];
}

const INITIAL: AppState = {
  screen: "trips",
  authMode: "signin",
  theme: "Ocean",
  dest: "Barcelona, Spain",
  destOpen: false,
  adults: 2,
  kids: 2,
  pace: "balanced",
  destinations: INITIAL_DESTINATIONS,
  budgetLevel: "standard",
  transports: {},
  dragId: null,
  dragOverId: null,
  routing: false,
  exSearch: "",
  exTab: "explore",
  exCat: "All",
  exSmart: [],
  exSelected: [],
  exSaved: [],
  exExpanded: null,
  exDragId: null,
  exDragOver: null,
  exMapSel: null,
  genStep: 0,
  planTab: "schedule",
  day: 0,
  units: "km",
  pin: null,
  chat: INITIAL_CHAT,
  chatInput: "",
  typing: false,
  toast: null,
  scrollId: null,
  days: DAYS,
  mapPicks: [],
};

/** Build the trip context the AI service needs from current state (incl. map data). */
function tripContext(s: AppState): TripContext {
  const selected = s.exSelected
    .map((x) => {
      const p = PLACES.find((pp) => pp.id === x.id);
      if (!p) return null;
      const c = placeCoords(p.id);
      return { name: p.name, category: p.cats[0], type: p.type, priority: x.priority, lat: c?.lat, lng: c?.lng };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
  const discovered = s.mapPicks.map((p) => ({ name: p.name, category: p.category }));
  return {
    destination: s.dest,
    travelers: `${s.adults} adults · ${s.kids} kids (6 & 9)`,
    numDays: s.days.length,
    selected,
    discovered: discovered.length ? discovered : undefined,
  };
}

type Patch = Partial<AppState> | ((s: AppState) => Partial<AppState>);

function smoothScrollTo(id: string) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-scroll="${id}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      window.scrollTo({ top: r.top + window.scrollY - 92, behavior: "smooth" });
    }
  });
}

export function useTripStore() {
  const [state, setState] = useState<AppState>(INITIAL);
  const set = useCallback((p: Patch) => {
    setState((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) }));
  }, []);

  const genInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = useRef(100);

  // Always-current snapshot so async actions can read state without stale closures.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    return () => {
      if (genInterval.current) clearInterval(genInterval.current);
      [toastTimer, chatTimer, routingTimer].forEach((t) => t.current && clearTimeout(t.current));
    };
  }, []);

  // Auto-scroll to newly added rows.
  useEffect(() => {
    if (state.scrollId) {
      const id = state.scrollId;
      smoothScrollTo(id);
      setState((s) => (s.scrollId === id ? { ...s, scrollId: null } : s));
    }
  }, [state.scrollId]);

  const flash = useCallback((msg: string, ms = 2400) => {
    set({ toast: msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => set({ toast: null }), ms);
  }, [set]);

  const pulseRouting = useCallback(() => {
    set({ routing: true });
    if (routingTimer.current) clearTimeout(routingTimer.current);
    routingTimer.current = setTimeout(() => set({ routing: false }), 850);
  }, [set]);

  const runGenerate = useCallback(() => {
    set({ screen: "generating", genStep: 0, destOpen: false });

    // Kick off real itinerary generation through the shared AI service.
    // On success we swap in the AI plan; on any failure we keep the mock DAYS.
    fetchItinerary(tripContext(stateRef.current))
      .then((days) => {
        if (days) setState((st) => ({ ...st, days }));
      })
      .catch(() => {});

    if (genInterval.current) clearInterval(genInterval.current);
    genInterval.current = setInterval(() => {
      setState((s) => {
        const n = s.genStep + 1;
        if (n > 5) {
          if (genInterval.current) clearInterval(genInterval.current);
          return { ...s, screen: "plan", genStep: 5 };
        }
        return { ...s, genStep: n };
      });
    }, 640);
  }, [set]);

  // Streamed travel-assistant reply via the AI service; falls back to a canned reply.
  const runAssistant = useCallback((ctx: TripContext, history: ChatMessage[], userText: string) => {
    const aiMessages: AIMessage[] = history
      .filter((m) => m.text.trim())
      .map((m) => ({ role: m.role, content: m.text }));

    const setLastAssistant = (text: string) =>
      setState((s) => ({ ...s, chat: s.chat.map((m, i) => (i === s.chat.length - 1 ? { ...m, text } : m)) }));

    let started = false;
    streamAssistantReply(ctx, aiMessages, (full) => {
      setLastAssistant(full);
      if (!started) {
        started = true;
        setState((s) => ({ ...s, typing: false })); // first token arrived → hide dots
      }
    })
      .then(() => setState((s) => ({ ...s, typing: false })))
      .catch(() => {
        // No key configured or the model failed — use the built-in reply.
        if (chatTimer.current) clearTimeout(chatTimer.current);
        chatTimer.current = setTimeout(() => {
          setLastAssistant(replyFor(userText));
          setState((s) => ({ ...s, typing: false }));
        }, 600);
      });
  }, []);

  const actions = useMemo(() => {
    return {
      // theme
      setTheme: (t: ThemeName) => set({ theme: t }),
      // auth
      toggleAuth: () => set((s) => ({ authMode: s.authMode === "signin" ? "signup" : "signin" })),
      goForm: () => set({ screen: "form" }),
      goTrips: () => {
        set({ screen: "trips" });
        requestAnimationFrame(() => window.scrollTo({ top: 0 }));
      },
      setDestination: (dest: string) => set({ dest }),
      /** Seed the route from picked cities (city + country + coords). Keeps current list when empty. */
      setDestinations: (list: SelectedDestination[]) =>
        setState((s) => ({
          ...s,
          destinations: list.length
            ? list.map((d) => ({
                id: ++uid.current,
                name: d.cityName,
                country: d.countryName,
                countryCode: d.countryCode,
                lat: d.lat,
                lng: d.lng,
                image: d.image ?? null,
                saved: true,
                expanded: false,
                arrive: "",
                depart: "",
                accoms: [],
              }))
            : s.destinations,
        })),
      // navigation between explore subviews / pages
      goExplore: () => {
        set({ screen: "explore" });
        requestAnimationFrame(() => window.scrollTo({ top: 0 }));
      },
      exSetTab: (t: ExploreTab) => {
        set({ exTab: t });
        requestAnimationFrame(() => window.scrollTo({ top: 0 }));
      },
      navPick: (k: ExploreTab) => {
        set({ screen: "explore", exTab: k });
        requestAnimationFrame(() => window.scrollTo({ top: 0 }));
      },
      // generating
      runGenerate,
      createSchedule: runGenerate,
      // destinations
      updateDest: (id: number, field: keyof Destination, val: string) =>
        setState((s) => ({ ...s, destinations: s.destinations.map((d) => (d.id === id ? { ...d, [field]: val } : d)) })),
      toggleDest: (id: number) =>
        setState((s) => ({ ...s, destinations: s.destinations.map((d) => (d.id === id ? { ...d, expanded: !d.expanded } : d)) })),
      /** Collapse a saved destination card (after the user saves it). */
      collapseDest: (id: number) =>
        setState((s) => ({ ...s, destinations: s.destinations.map((d) => (d.id === id ? { ...d, expanded: false } : d)) })),
      /** Collapse every saved destination card. */
      collapseAllDests: () =>
        setState((s) => ({ ...s, destinations: s.destinations.map((d) => (d.saved ? { ...d, expanded: false } : d)) })),
      /** Trip-wide budget level — recalculates every estimate. */
      setBudgetLevel: (level: BudgetLevel) => setState((s) => ({ ...s, budgetLevel: level })),
      /** Manual per-destination budget override (null clears it). */
      setDestBudget: (id: number, value: number | null) =>
        setState((s) => ({ ...s, destinations: s.destinations.map((d) => (d.id === id ? { ...d, budgetOverride: value } : d)) })),
      saveDest: (id: number) => {
        setState((s) => ({ ...s, scrollId: "dest-" + id, destinations: s.destinations.map((d) => (d.id === id ? { ...d, saved: true, expanded: true } : d)) }));
        pulseRouting();
      },
      removeDest: (id: number) => {
        setState((s) => (s.destinations.length <= 1 ? s : { ...s, destinations: s.destinations.filter((d) => d.id !== id) }));
        pulseRouting();
      },
      cancelDest: (id: number) =>
        setState((s) => ({ ...s, destinations: s.destinations.filter((d) => d.id !== id) })),
      addDest: () => {
        const id = ++uid.current;
        const aid = ++uid.current;
        setState((s) => ({
          ...s,
          scrollId: "dest-" + id,
          destinations: [
            ...s.destinations.map((d) => ({ ...d, expanded: false })),
            { id, name: "", country: "", saved: false, expanded: true, arrive: "", depart: "", accoms: [{ id: aid, type: "Hotel" as AccomType, name: "", checkin: "", checkout: "", conf: "", address: "", notes: "", locationUrl: "" }] },
          ],
        }));
      },
      setTransport: (key: string, mode: TransportMode) => {
        setState((s) => ({ ...s, transports: { ...s.transports, [key]: mode } }));
        pulseRouting();
      },
      // destination drag & drop
      onDragStart: (id: number) => (e: React.DragEvent) => {
        set({ dragId: id });
        try {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(id));
        } catch {}
      },
      onDragOver: (overId: number) => (e: React.DragEvent) => {
        setState((s) => {
          if (s.dragId == null) return s;
          e.preventDefault();
          return s.dragOverId !== overId ? { ...s, dragOverId: overId } : s;
        });
      },
      onDrop: (overId: number) => (e: React.DragEvent) => {
        e.preventDefault();
        setState((s) => {
          const dragId = s.dragId;
          if (dragId == null || dragId === overId) return { ...s, dragId: null, dragOverId: null };
          const a = [...s.destinations];
          const from = a.findIndex((d) => d.id === dragId);
          const to = a.findIndex((d) => d.id === overId);
          if (from < 0 || to < 0) return { ...s, dragId: null, dragOverId: null };
          const [m] = a.splice(from, 1);
          a.splice(to, 0, m);
          return { ...s, destinations: a, dragId: null, dragOverId: null };
        });
        pulseRouting();
      },
      onDragEnd: () => set({ dragId: null, dragOverId: null }),
      // accommodations
      updateAccom: (destId: number, accomId: number, field: string, val: string) =>
        setState((s) => ({ ...s, destinations: s.destinations.map((d) => (d.id !== destId ? d : { ...d, accoms: d.accoms.map((a) => (a.id === accomId ? { ...a, [field]: val } : a)) })) })),
      setAccomType: (destId: number, accomId: number, type: AccomType) =>
        setState((s) => ({ ...s, destinations: s.destinations.map((d) => (d.id !== destId ? d : { ...d, accoms: d.accoms.map((a) => (a.id === accomId ? { ...a, type } : a)) })) })),
      addAccom: (destId: number) => {
        const aid = ++uid.current;
        setState((s) => ({
          ...s,
          scrollId: "accom-" + aid,
          destinations: s.destinations.map((d) => (d.id !== destId ? d : { ...d, accoms: [...d.accoms, { id: aid, type: "Hotel" as AccomType, name: "", checkin: d.arrive || "", checkout: d.depart || "", conf: "", address: "", notes: "", locationUrl: "" }] })),
        }));
      },
      removeAccom: (destId: number, accomId: number) =>
        setState((s) => ({ ...s, destinations: s.destinations.map((d) => (d.id !== destId ? d : { ...d, accoms: d.accoms.filter((a) => a.id !== accomId) })) })),
      flash,
      // explore
      exOnSearch: (v: string) => set({ exSearch: v }),
      exSetCat: (c: string) => set({ exCat: c }),
      exToggleSmart: (k: string) =>
        set((s) => ({ exSmart: s.exSmart.includes(k) ? s.exSmart.filter((x) => x !== k) : [...s.exSmart, k] })),
      exClearSmart: () => set({ exSmart: [], exCat: "All", exSearch: "" }),
      exToggleSave: (id: string) =>
        set((s) => ({ exSaved: s.exSaved.includes(id) ? s.exSaved.filter((x) => x !== id) : [...s.exSaved, id] })),
      exToggleTrip: (id: string) =>
        setState((s) => {
          const has = s.exSelected.some((x) => x.id === id);
          if (has) return { ...s, exSelected: s.exSelected.filter((x) => x.id !== id) };
          const place = PLACES.find((p) => p.id === id);
          if (place && place.duration) {
            if (toastTimer.current) clearTimeout(toastTimer.current);
            toastTimer.current = setTimeout(() => set({ toast: null }), 2400);
            return { ...s, exSelected: [...s.exSelected, { id, priority: "optional" as Priority }], exMapSel: id, toast: `Most travelers spend about ${place.duration} at ${place.name}.` };
          }
          return { ...s, exSelected: [...s.exSelected, { id, priority: "optional" as Priority }], exMapSel: id };
        }),
      exRemove: (id: string) =>
        set((s) => ({ exSelected: s.exSelected.filter((x) => x.id !== id), exMapSel: s.exMapSel === id ? null : s.exMapSel })),
      exSetPriority: (id: string, pri: Priority) =>
        set((s) => ({ exSelected: s.exSelected.map((x) => (x.id === id ? { ...x, priority: pri } : x)) })),
      exExpand: (id: string) => set((s) => ({ exExpanded: s.exExpanded === id ? null : id })),
      exMapPick: (id: string | null) => set({ exMapSel: id }),
      // Google Places picks
      addMapPick: (place: PlaceResult) => {
        setState((s) => (s.mapPicks.some((p) => p.id === place.id) ? s : { ...s, mapPicks: [...s.mapPicks, place] }));
        flash(`Added ${place.name} to your trip.`);
      },
      removeMapPick: (id: string) => set((s) => ({ mapPicks: s.mapPicks.filter((p) => p.id !== id) })),
      // explore selected drag reorder
      exDragStart: (id: string) => (e: React.DragEvent) => {
        set({ exDragId: id });
        try {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
        } catch {}
      },
      exDragOverItem: (overId: string) => (e: React.DragEvent) => {
        setState((s) => {
          if (s.exDragId == null) return s;
          e.preventDefault();
          return s.exDragOver !== overId ? { ...s, exDragOver: overId } : s;
        });
      },
      exDropItem: (overId: string) => (e: React.DragEvent) => {
        e.preventDefault();
        setState((s) => {
          const drag = s.exDragId;
          if (drag == null || drag === overId) return { ...s, exDragId: null, exDragOver: null };
          const a = [...s.exSelected];
          const from = a.findIndex((x) => x.id === drag);
          const to = a.findIndex((x) => x.id === overId);
          if (from < 0 || to < 0) return { ...s, exDragId: null, exDragOver: null };
          const [m] = a.splice(from, 1);
          a.splice(to, 0, m);
          return { ...s, exSelected: a, exDragId: null, exDragOver: null };
        });
      },
      exDragEndItem: () => set({ exDragId: null, exDragOver: null }),
      // plan
      setTab: (t: PlanTab) => set({ planTab: t, pin: null }),
      setDay: (d: number) => set({ day: d, pin: null }),
      setUnits: (u: Units) => set({ units: u }),
      pickPin: (i: number) => set((s) => ({ pin: s.pin === i ? null : i })),
      doExport: () => flash("Your custom Barcelona plan PDF is ready to download", 2800),
      // chat
      onChatInput: (v: string) => set({ chatInput: v }),
      send: (preset?: string) => {
        const s = stateRef.current;
        const txt = (preset || s.chatInput).trim();
        if (!txt) return;
        const history: ChatMessage[] = [...s.chat, { role: "user", text: txt }];
        setState((st) => ({ ...st, chat: [...history, { role: "assistant", text: "" }], chatInput: "", typing: true }));
        runAssistant(tripContext(s), history, txt);
      },
    };
  }, [set, flash, pulseRouting, runGenerate, runAssistant]);

  return { state, actions };
}

export type TripStore = ReturnType<typeof useTripStore>;

const TripContext = createContext<TripStore | null>(null);

export function TripProvider({ children }: { children: ReactNode }) {
  const store = useTripStore();
  return <TripContext.Provider value={store}>{children}</TripContext.Provider>;
}

export function useTrip(): TripStore {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used within TripProvider");
  return ctx;
}
