"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface UIState {
  collapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (v: boolean) => void;
}

const UIContext = createContext<UIState | null>(null);
const KEY = "wf_sidebar_collapsed";

export function UIProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored != null) setCollapsedState(stored === "1");
      else if (window.innerWidth < 1024) setCollapsedState(true);
    } catch {
      /* ignore */
    }
  }, []);

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <UIContext.Provider value={{ collapsed, toggleSidebar: () => setCollapsed(!collapsed), setCollapsed }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI(): UIState {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
