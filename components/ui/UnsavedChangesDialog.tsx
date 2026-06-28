"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { isGuardDialogOpen, resolveDiscard, resolveStay, subscribeGuard } from "@/lib/ui/unsavedGuard";

/** Shared "Discard your changes?" dialog driven by the global unsaved guard. */
export function UnsavedChangesDialog() {
  const open = useSyncExternalStore(subscribeGuard, isGuardDialogOpen, () => false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolveStay();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] grid place-items-center p-4" style={{ background: "rgba(20,16,12,.55)", backdropFilter: "blur(3px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) resolveStay(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" className="w-full max-w-[420px] bg-surface rounded-[20px] border border-line p-6 vp-pop" style={{ boxShadow: "0 30px 70px -28px rgba(0,0,0,.5)" }}>
        <div className="w-11 h-11 rounded-full grid place-items-center" style={{ background: "#f7e7e3", color: "#b3402f" }}>
          <AlertTriangle size={20} strokeWidth={2} />
        </div>
        <h2 id="unsaved-title" className="font-display font-bold text-[19px] tracking-[-.01em] mt-3.5">Discard your changes?</h2>
        <p className="text-[14px] text-muted mt-1.5 leading-relaxed">You have unsaved changes. Leaving this page will discard them.</p>
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            onClick={resolveDiscard}
            className="px-4 py-2.5 rounded-[11px] border text-[13.5px] font-bold cursor-pointer transition"
            style={{ borderColor: "#b3402f", color: "#b3402f", background: "transparent" }}
          >
            Discard changes
          </button>
          <button
            onClick={resolveStay}
            autoFocus
            className="px-5 py-2.5 rounded-[11px] bg-accent text-white text-[13.5px] font-bold cursor-pointer hover:brightness-[1.06] transition"
            style={{ boxShadow: "0 8px 20px -10px var(--accent)" }}
          >
            Stay editing
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
