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
  Sparkles,
  Star,
  User,
} from "lucide-react";
import { useTrip } from "@/lib/store";
import { useTrips } from "@/lib/trips/store";
import { useUI } from "@/lib/ui/store";
import { Logo } from "@/components/Logo";
import type { Screen } from "@/lib/types";

type Actions = ReturnType<typeof useTrip>["actions"];

interface NavItem {
  key: string;
  label: string;
  icon: typeof Compass;
  onClick: (a: Actions) => void;
}

const SECTIONS: { group: string; items: NavItem[] }[] = [
  {
    group: "Main",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, onClick: (a) => a.goTrips() },
      { key: "mytrips", label: "My Trips", icon: Plane, onClick: (a) => a.goTrips() },
      { key: "planner", label: "Planner", icon: MapIcon, onClick: (a) => a.goForm() },
      { key: "saved", label: "Saved Places", icon: Heart, onClick: (a) => a.goExplore() },
    ],
  },
  {
    group: "Tools",
    items: [
      { key: "export", label: "Export Itinerary", icon: Download, onClick: (a) => a.goExplore() },
      { key: "ai", label: "AI Assistant", icon: Sparkles, onClick: (a) => a.flash("Ask the AI Assistant from any trip — full chat is coming soon.") },
    ],
  },
  {
    group: "Account",
    items: [
      { key: "profile", label: "Profile", icon: User, onClick: (a) => a.goProfile() },
      { key: "settings", label: "Settings", icon: Settings, onClick: (a) => a.goSettings() },
      { key: "premium", label: "Premium", icon: Star, onClick: (a) => a.flash("Premium features are coming soon.") },
    ],
  },
  {
    group: "Support",
    items: [{ key: "help", label: "Help", icon: HelpCircle, onClick: (a) => a.flash("Help center coming soon — meanwhile, the AI assistant can help.") }],
  },
];

function activeKeyFor(screen: Screen): string | null {
  switch (screen) {
    case "trips": return "mytrips";
    case "form":
    case "explore":
    case "generating":
    case "plan": return "planner";
    case "profile": return "profile";
    case "settings": return "settings";
    default: return null;
  }
}

export function Sidebar() {
  const { state, actions } = useTrip();
  const { activeTrip } = useTrips();
  const { collapsed, toggleSidebar } = useUI();
  const activeKey = activeKeyFor(state.screen);
  const width = collapsed ? "w-[72px]" : "w-[248px]";

  const Item = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = item.key === activeKey;
    return (
      <button
        onClick={() => item.onClick(actions)}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={`group relative flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13.5px] font-semibold cursor-pointer transition-all ${collapsed ? "justify-center" : ""}`}
        style={{ background: active ? "var(--tint)" : "transparent", color: active ? "var(--accent)" : "var(--muted)" }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--ink)"; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--muted)"; }}
      >
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r bg-accent" />}
        <Icon size={18} strokeWidth={2} className="shrink-0 transition-transform group-hover:scale-110" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  return (
    <aside
      className={`${width} shrink-0 h-screen sticky top-0 border-r border-line flex flex-col transition-[width] duration-300 ease-out`}
      style={{ background: "color-mix(in oklab, var(--bg) 60%, #fff)" }}
    >
      {/* brand + collapse */}
      <div className={`flex items-center h-[60px] px-3 border-b border-line ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-brand font-semibold text-[21px] tracking-[-.01em] text-ink">Itinera</span>
          </div>
        )}
        <button onClick={toggleSidebar} className="w-8 h-8 rounded-[9px] grid place-items-center text-muted hover:text-ink hover:bg-tint cursor-pointer" title={collapsed ? "Expand" : "Collapse"}>
          {collapsed ? <PanelLeftOpen size={18} strokeWidth={2} /> : <PanelLeftClose size={18} strokeWidth={2} />}
        </button>
      </div>

      {/* current trip */}
      {activeTrip && !collapsed && (
        <div className="mx-3 mt-3 rounded-[14px] p-3 text-white" style={{ background: "var(--brand-deep)" }}>
          <div className="text-[10.5px] uppercase tracking-[.08em] opacity-70">Current trip</div>
          <div className="font-display font-bold text-[15px] leading-tight mt-0.5 truncate">{activeTrip.name}</div>
          <div className="text-[11.5px] opacity-80 truncate">{activeTrip.destination}</div>
        </div>
      )}

      {/* grouped nav */}
      <nav className="flex-1 overflow-y-auto vp-scroll px-3 py-3 flex flex-col gap-1">
        {SECTIONS.map((section, i) => (
          <div key={section.group} className={i > 0 ? "mt-4" : ""}>
            {!collapsed ? (
              <div className="text-[10.5px] font-bold uppercase tracking-[.08em] text-muted px-3 mb-1">{section.group}</div>
            ) : i > 0 ? (
              <div className="my-2 mx-auto w-6 border-t border-line" />
            ) : null}
            <div className="flex flex-col gap-1">
              {section.items.map((item) => <Item key={item.key} item={item} />)}
            </div>
          </div>
        ))}
      </nav>

      {/* footer */}
      <div className="border-t border-line p-3">
        {!collapsed ? (
          <div className="font-brand text-[12px] text-muted leading-snug">Every journey,<br />perfectly planned.</div>
        ) : (
          <div className="flex justify-center"><Logo size={26} /></div>
        )}
      </div>
    </aside>
  );
}
