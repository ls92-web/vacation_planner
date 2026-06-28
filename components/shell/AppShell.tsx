"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { UnsavedChangesDialog } from "@/components/ui/UnsavedChangesDialog";

/** Permanent application shell: fixed sidebar + sticky top bar + scrollable content. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="font-body text-ink h-screen flex overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col h-screen">
        <TopBar />
        <main className="flex-1 min-w-0 overflow-y-auto vp-scroll">{children}</main>
      </div>
      <UnsavedChangesDialog />
    </div>
  );
}
