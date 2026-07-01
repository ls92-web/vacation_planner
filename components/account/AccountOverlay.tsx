"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, LogOut, X } from "lucide-react";
import { useAuth } from "@/lib/auth/store";
import { requestNavigation } from "@/lib/ui/unsavedGuard";
import { THEME_OPTIONS, normalizeTheme } from "@/lib/theme/themes";
import { CURRENCIES } from "@/lib/budget/estimate";

/**
 * Minimal, dark account essentials — a modal overlay, not a page. Identity +
 * appearance (theme) + currency + sign out. Reuses the auth prefs setters
 * (updatePreferences → live retint via ThemeApplier). Full account plumbing
 * still lives in the auth store; this is the surfaced, on-theme essentials.
 */
export function AccountOverlay({ onClose }: { onClose: () => void }) {
  const { state, actions } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const name = state.profile?.full_name || state.profile?.username || "Traveller";
  const email = state.user?.email || state.profile?.username || "";
  const initial = name.trim().charAt(0).toUpperCase() || "T";
  const theme = normalizeTheme(state.preferences?.theme);
  const currency = state.preferences?.currency || "KWD";

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] grid place-items-center p-4" style={{ background: "rgba(4,10,20,.6)", backdropFilter: "blur(6px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="imm-bg w-full max-w-[440px] rounded-[22px] border border-white/12 text-white overflow-hidden" style={{ boxShadow: "0 40px 90px -30px rgba(0,0,0,.8)", animation: "imm_rise .25s ease both" }} onMouseDown={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="relative p-5 flex items-center gap-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,.1)" }}>
          <div className="w-12 h-12 rounded-full grid place-items-center font-display font-bold text-[19px] text-white shrink-0" style={{ background: "var(--accent)" }}>{initial}</div>
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold text-[17px] leading-tight truncate">{name}</div>
            {email && <div className="text-[12.5px] text-white/55 truncate">{email}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="imm-glass imm-glass-hover w-9 h-9 rounded-full grid place-items-center cursor-pointer transition"><X size={16} /></button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* appearance */}
          <div>
            <div className="text-[11px] uppercase tracking-[.12em] text-white/45 mb-2.5">Appearance</div>
            <div className="grid grid-cols-2 gap-2">
              {THEME_OPTIONS.map((t) => {
                const active = t.id === theme;
                return (
                  <button
                    key={t.id}
                    onClick={() => actions.updatePreferences({ theme: t.id })}
                    className="rounded-[14px] p-3 text-left cursor-pointer transition"
                    style={{ background: "rgba(255,255,255,.05)", border: `1px solid ${active ? "var(--accent)" : "rgba(255,255,255,.12)"}` }}
                  >
                    <div className="flex items-center gap-1.5" data-theme={t.id}>
                      <span className="w-4 h-4 rounded-full" style={{ background: "var(--accent)" }} />
                      <span className="w-4 h-4 rounded-full" style={{ background: "var(--brand-deep)" }} />
                      <span className="w-4 h-4 rounded-full" style={{ background: "var(--tint)" }} />
                      <span className="flex-1" />
                      {active && <Check size={14} strokeWidth={2.5} style={{ color: "var(--accent)" }} />}
                    </div>
                    <div className="mt-2 text-[13px] font-semibold">{t.name}</div>
                    <div className="text-[11px] text-white/45 leading-snug truncate">{t.tagline}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* currency */}
          <div>
            <div className="text-[11px] uppercase tracking-[.12em] text-white/45 mb-2.5">Currency</div>
            <div className="relative">
              <select
                value={currency}
                onChange={(e) => actions.updatePreferences({ currency: e.target.value })}
                className="w-full appearance-none rounded-[12px] px-3.5 py-3 text-[14px] text-white cursor-pointer outline-none"
                style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)" }}
              >
                {Object.values(CURRENCIES).map((c) => (
                  <option key={c.code} value={c.code} style={{ color: "#111" }}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* sign out */}
          <button
            onClick={() => { onClose(); requestNavigation(() => actions.signOut()); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[12px] text-[14px] font-semibold cursor-pointer transition"
            style={{ background: "rgba(241,168,140,.12)", color: "#F1A88C", border: "1px solid rgba(241,168,140,.3)" }}
          >
            <LogOut size={16} strokeWidth={2} />Sign out
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
