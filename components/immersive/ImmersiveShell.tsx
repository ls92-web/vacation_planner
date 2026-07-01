"use client";

import type { ReactNode } from "react";
import { RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { useTrip } from "@/lib/store";
import { Logo } from "@/components/Logo";
import { ImmersiveMenu } from "./ImmersiveMenu";
import { UnsavedChangesDialog } from "@/components/ui/UnsavedChangesDialog";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

/** Dark, on-theme fallback when an immersive screen errors — chrome stays usable. */
function ScreenError({ onRetry }: { onRetry: () => void }) {
  const { actions } = useTrip();
  return (
    <div className="min-h-[60vh] grid place-items-center p-6 text-white">
      <div className="max-w-[420px] text-center flex flex-col items-center gap-3">
        <span className="w-12 h-12 rounded-full grid place-items-center" style={{ background: "rgba(241,168,140,.14)", color: "#F1A88C" }}>
          <TriangleAlert size={22} strokeWidth={2} />
        </span>
        <h2 className="font-display font-bold text-[18px]">Something went wrong here</h2>
        <p className="text-[13.5px] text-white/60 leading-relaxed">Your data is safe. Try again, or head back to the start.</p>
        <div className="flex items-center gap-2.5 mt-1">
          <button onClick={onRetry} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[12px] text-white text-[13.5px] font-bold cursor-pointer transition" style={{ background: "var(--accent)" }}>
            <RefreshCw size={15} strokeWidth={2.2} />Try again
          </button>
          <button onClick={() => { actions.goWelcome(); onRetry(); }} className="imm-glass imm-glass-hover px-4 py-2.5 rounded-[12px] text-white text-[13.5px] font-bold cursor-pointer transition">
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The immersive canvas for secondary screens (My journeys, Saved). Dark navy
 * gradient + ambient accent glow + a single floating menu — no sidebar, no
 * admin top bar. Welcome and the Workspace render their own immersive layout.
 */
export function ImmersiveShell({ children }: { children: ReactNode }) {
  const { state, actions } = useTrip();
  // Pointer parallax — the whole canvas breathes with the cursor, like Welcome.
  const onPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const px = e.clientX / window.innerWidth - 0.5;
    const py = e.clientY / window.innerHeight - 0.5;
    el.style.setProperty("--px", px.toFixed(3));
    el.style.setProperty("--py", py.toFixed(3));
  };
  return (
    <div
      onPointerMove={onPointer}
      className="imm-bg min-h-screen w-full relative font-body overflow-x-hidden"
      style={{ ["--px" as string]: 0, ["--py" as string]: 0 }}
    >
      {/* persistent ambient lights (parallax depth) — shared with Welcome */}
      <div aria-hidden className="wl-light" style={{ top: "-16%", left: "50%", width: 760, height: 760, background: "radial-gradient(circle, color-mix(in oklab, var(--accent) 20%, transparent), transparent 62%)", transform: "translate(calc(-50% + var(--px) * -22px), calc(var(--py) * -16px))" }} />
      <div aria-hidden className="wl-light wl-float" style={{ top: "44%", left: "8%", width: 340, height: 340, background: "radial-gradient(circle, rgba(90,150,235,.14), transparent 64%)", transform: "translate(calc(var(--px) * 30px), calc(var(--py) * 22px))" }} />
      <div aria-hidden className="wl-light wl-float" style={{ top: "8%", right: "6%", left: "auto", width: 300, height: 300, background: "radial-gradient(circle, rgba(120,180,255,.1), transparent 64%)", transform: "translate(calc(var(--px) * -26px), calc(var(--py) * 20px))", animationDelay: "-6s" }} />

      <header className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 h-[60px]">
        <button onClick={() => actions.goWelcome()} className="flex items-center gap-2.5 cursor-pointer text-white" title="New journey">
          <Logo size={26} variant="plain" />
          <span className="font-brand font-semibold text-[19px] tracking-[-.01em]">Itinera</span>
        </button>
        <ImmersiveMenu />
      </header>
      <main className="relative z-10 imm-scroll">
        <ErrorBoundary resetKey={state.screen} fallback={(reset) => <ScreenError onRetry={reset} />}>
          {/* keyed so each screen rises in — one canvas morphing, not pages swapping */}
          <div key={state.screen} className="screen-stage">{children}</div>
        </ErrorBoundary>
      </main>
      <UnsavedChangesDialog />
    </div>
  );
}

/** Small helper so screens can show a consistent immersive page heading. */
export function ImmersiveHeading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="imm-rise">
      {eyebrow && <div className="inline-flex items-center gap-1.5 text-[11.5px] uppercase tracking-[.12em] text-white/55"><Sparkles size={12} style={{ color: "var(--accent)" }} />{eyebrow}</div>}
      <h1 className="font-brand font-bold tracking-[-.01em] mt-2" style={{ fontSize: "clamp(28px,4.5vw,44px)" }}>{title}</h1>
      {subtitle && <p className="text-white/60 text-[14.5px] mt-2 max-w-[560px]">{subtitle}</p>}
    </div>
  );
}
