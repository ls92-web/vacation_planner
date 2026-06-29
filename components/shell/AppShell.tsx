"use client";

import type { ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useTrip } from "@/lib/store";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { UnsavedChangesDialog } from "@/components/ui/UnsavedChangesDialog";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

/** Contained, recoverable fallback when a screen errors — the shell/nav stay usable. */
function ScreenError({ onRetry }: { onRetry: () => void }) {
  const { actions } = useTrip();
  return (
    <div className="min-h-full grid place-items-center p-6" style={{ background: "var(--bg)" }}>
      <div className="max-w-[420px] text-center flex flex-col items-center gap-3 vp-fade-fast">
        <span className="w-12 h-12 rounded-full grid place-items-center" style={{ background: "#f7e7e3", color: "#b3402f" }}>
          <TriangleAlert size={22} strokeWidth={2} />
        </span>
        <h2 className="font-display font-bold text-[18px] tracking-[-.01em]">Something went wrong on this screen</h2>
        <p className="text-[13.5px] text-muted leading-relaxed">Your data is safe. Try again, or head back to your dashboard.</p>
        <div className="flex items-center gap-2.5 mt-1">
          <button onClick={onRetry} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[11px] bg-accent text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06] transition">
            <RefreshCw size={15} strokeWidth={2.2} />Try again
          </button>
          <button onClick={() => { actions.goDashboard(); onRetry(); }} className="px-4 py-2.5 rounded-[11px] border border-line bg-surface text-ink text-[13.5px] font-bold cursor-pointer hover:border-accent transition">
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

/** Permanent application shell: fixed sidebar + sticky top bar + scrollable content. */
export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useTrip();
  return (
    <div className="font-body text-ink h-screen flex overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col h-screen">
        <TopBar />
        <main className="flex-1 min-w-0 overflow-y-auto vp-scroll">
          <ErrorBoundary resetKey={state.screen} fallback={(reset) => <ScreenError onRetry={reset} />}>
            {children}
          </ErrorBoundary>
        </main>
      </div>
      <UnsavedChangesDialog />
    </div>
  );
}
