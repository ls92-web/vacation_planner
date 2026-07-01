"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Compass, Heart, LogOut, Menu, Plane, Sparkles, User, X } from "lucide-react";
import { useTrip } from "@/lib/store";
import { useAuth } from "@/lib/auth/store";
import { requestNavigation } from "@/lib/ui/unsavedGuard";
import { AccountOverlay } from "@/components/account/AccountOverlay";

/**
 * The single floating navigation control for the immersive experience — replaces
 * the old sidebar/top-bar. A glass menu button that opens a dark nav sheet
 * (New journey · My journeys · Saved · Account · Sign out). Drop it into any
 * immersive screen's header. Self-contained: manages its own open + account state.
 */
export function ImmersiveMenu({ className }: { className?: string }) {
  const { actions } = useTrip();
  const { state: auth, actions: authActions } = useAuth();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const name = auth.profile?.full_name || auth.profile?.username || "Traveller";
  const go = (fn: () => void) => { setOpen(false); fn(); };

  const items: { icon: typeof Compass; label: string; onClick: () => void; danger?: boolean }[] = [
    { icon: Sparkles, label: "New journey", onClick: () => actions.goWelcome() },
    { icon: Plane, label: "My journeys", onClick: () => actions.goTrips() },
    { icon: Heart, label: "Saved places", onClick: () => actions.goSaved() },
    { icon: User, label: "Account", onClick: () => setAccount(true) },
    { icon: LogOut, label: "Sign out", danger: true, onClick: () => requestNavigation(() => authActions.signOut()) },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Menu"
        className={className ?? "imm-glass imm-glass-hover w-10 h-10 rounded-full grid place-items-center text-white cursor-pointer transition"}
      >
        <Menu size={18} strokeWidth={2} />
      </button>

      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[120] flex justify-end" style={{ background: "rgba(4,10,20,.55)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="imm-bg h-full w-[min(340px,88vw)] p-5 flex flex-col text-white vp-slide-up" style={{ boxShadow: "-30px 0 80px -30px rgba(0,0,0,.7)", animation: "imm_rise .25s ease both" }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[.12em] text-white/50">Signed in</div>
                <div className="font-display font-bold text-[16px] truncate">{name}</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="imm-glass imm-glass-hover w-9 h-9 rounded-full grid place-items-center cursor-pointer transition"><X size={16} /></button>
            </div>

            <nav className="mt-6 flex flex-col gap-1.5">
              {items.map((it) => (
                <button
                  key={it.label}
                  onClick={() => go(it.onClick)}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-[14px] text-left cursor-pointer transition imm-glass-hover"
                  style={{ color: it.danger ? "#F1A88C" : "#fff" }}
                >
                  <it.icon size={17} strokeWidth={2} style={{ color: it.danger ? "#F1A88C" : "var(--accent)" }} />
                  <span className="text-[14.5px] font-semibold">{it.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-auto flex items-center gap-2 text-[11.5px] text-white/40">
              <Compass size={13} /> Every journey, perfectly planned.
            </div>
          </div>
        </div>,
        document.body
      )}

      {account && <AccountOverlay onClose={() => setAccount(false)} />}
    </>
  );
}
