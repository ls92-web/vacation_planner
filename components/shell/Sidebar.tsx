"use client";

import {
  Compass,
  Download,
  Heart,
  HelpCircle,
  LayoutDashboard,
  Map as MapIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Plane,
  Settings,
  Sparkle,
  Star,
  User,
} from "lucide-react";
import { useTrip } from "@/lib/store";
import { useTrips } from "@/lib/trips/store";
import { useUI } from "@/lib/ui/store";
import { openAccount } from "@/lib/ui/account";
import { THEMES } from "@/lib/data";
import type { ThemeName } from "@/lib/types";

type Group = "dashboard" | "planner" | "saved" | null;

interface NavItem {
  label: string;
  icon: typeof Compass;
  group: Group;
  onClick: (a: ReturnType<typeof useTrip>["actions"]) => void;
}

const NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, group: "dashboard", onClick: (a) => a.goTrips() },
  { label: "My Trips", icon: Plane, group: "dashboard", onClick: (a) => a.goTrips() },
  { label: "Planner", icon: MapIcon, group: "planner", onClick: (a) => a.goForm() },
  { label: "Saved Places", icon: Heart, group: "saved", onClick: (a) => a.goExplore() },
  { label: "Export Itinerary", icon: Download, group: null, onClick: (a) => a.goExplore() },
];

const THEME_NAMES: ThemeName[] = ["Ocean", "Sunset", "Forest"];

export function Sidebar() {
  const { state, actions } = useTrip();
  const { activeTrip } = useTrips();
  const { collapsed, toggleSidebar } = useUI();

  const currentGroup: Group =
    state.screen === "trips" ? "dashboard" : state.screen === "form" ? "planner" : state.screen === "explore" || state.screen === "plan" || state.screen === "generating" ? "planner" : null;

  const width = collapsed ? "w-[72px]" : "w-[248px]";

  const Item = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = item.group !== null && item.group === currentGroup;
    return (
      <button
        onClick={() => item.onClick(actions)}
        title={collapsed ? item.label : undefined}
        className={`group relative flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13.5px] font-semibold cursor-pointer transition-all ${collapsed ? "justify-center" : ""}`}
        style={{ background: active ? "var(--tint)" : "transparent", color: active ? "var(--accent)" : "var(--muted)" }}
      >
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r bg-accent" />}
        <Icon size={18} strokeWidth={2} className="shrink-0 transition-transform group-hover:scale-110" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  const Action = ({ label, icon: Icon, onClick }: { label: string; icon: typeof Compass; onClick: () => void }) => (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13.5px] font-semibold text-muted cursor-pointer transition-colors hover:text-ink hover:bg-tint ${collapsed ? "justify-center" : ""}`}
    >
      <Icon size={18} strokeWidth={2} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );

  return (
    <aside
      className={`${width} shrink-0 h-screen sticky top-0 border-r border-line flex flex-col transition-[width] duration-300 ease-out`}
      style={{ background: "color-mix(in oklab, var(--bg) 60%, #fff)" }}
    >
      {/* brand + collapse */}
      <div className={`flex items-center h-[60px] px-3 border-b border-line ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 font-bold text-[15px]">
            <div className="w-8 h-8 rounded-[10px] bg-accent text-white grid place-items-center"><Compass size={17} strokeWidth={2} /></div>
            Wanderfold
          </div>
        )}
        <button onClick={toggleSidebar} className="w-8 h-8 rounded-[9px] grid place-items-center text-muted hover:text-ink hover:bg-tint cursor-pointer" title={collapsed ? "Expand" : "Collapse"}>
          {collapsed ? <PanelLeftOpen size={18} strokeWidth={2} /> : <PanelLeftClose size={18} strokeWidth={2} />}
        </button>
      </div>

      {/* current trip */}
      {activeTrip && !collapsed && (
        <div className="mx-3 mt-3 rounded-[14px] p-3 text-white relative overflow-hidden" style={{ background: "linear-gradient(150deg, var(--accent), color-mix(in oklab, var(--accent) 55%, #11304f))" }}>
          <div className="absolute inset-0 opacity-10" style={{ background: "repeating-linear-gradient(135deg,#fff 0 2px,transparent 2px 14px)" }} />
          <div className="relative text-[10.5px] uppercase tracking-[.08em] opacity-80">Current trip</div>
          <div className="relative font-display font-bold text-[15px] leading-tight mt-0.5 truncate">{activeTrip.name}</div>
          <div className="relative text-[11.5px] opacity-85 truncate">{activeTrip.destination}</div>
        </div>
      )}

      {/* nav */}
      <nav className="flex-1 overflow-y-auto vp-scroll px-3 py-3 flex flex-col gap-1">
        {!collapsed && <div className="text-[10.5px] font-bold uppercase tracking-[.08em] text-muted px-3 mb-1">Plan</div>}
        {NAV.map((item) => <Item key={item.label} item={item} />)}
        {!collapsed && <div className="text-[10.5px] font-bold uppercase tracking-[.08em] text-muted px-3 mt-4 mb-1">Account</div>}
        {collapsed && <div className="my-2 mx-auto w-6 border-t border-line" />}
        <Action label="Premium" icon={Star} onClick={() => actions.flash("Premium features are coming soon.")} />
        <Action label="Settings" icon={Settings} onClick={openAccount} />
        <Action label="Profile" icon={User} onClick={openAccount} />
        <Action label="Help" icon={HelpCircle} onClick={() => actions.flash("Help center coming soon — meanwhile, the AI assistant can help.")} />
      </nav>

      {/* footer: palette */}
      <div className="border-t border-line p-3">
        {!collapsed && <div className="text-[10.5px] font-bold uppercase tracking-[.08em] text-muted mb-2 flex items-center gap-1"><Sparkle size={11} strokeWidth={1.8} />Theme</div>}
        <div className={`flex items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
          {THEME_NAMES.map((n) => {
            const on = state.theme === n;
            return (
              <button
                key={n}
                onClick={() => actions.setTheme(n)}
                title={n}
                aria-label={n}
                className="w-6 h-6 rounded-full cursor-pointer transition"
                style={{ background: THEMES[n].accent, outline: on ? "2px solid var(--ink)" : "2px solid transparent", outlineOffset: 2 }}
              />
            );
          })}
        </div>
      </div>
    </aside>
  );
}
