"use client";

import type { ReactNode } from "react";
import { useTrip } from "@/lib/store";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** Permanent application shell: fixed sidebar + sticky top bar + scrollable content. */
export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useTrip();
  return (
    <div data-theme={state.theme.toLowerCase()} className="font-body text-ink h-screen flex overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col h-screen">
        <TopBar />
        <main className="flex-1 min-w-0 overflow-y-auto vp-scroll">{children}</main>
      </div>
    </div>
  );
}
