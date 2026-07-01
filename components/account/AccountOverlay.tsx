"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Heart, LogOut, Plane, SlidersHorizontal, UserCircle, X } from "lucide-react";
import { useAuth } from "@/lib/auth/store";
import { useTrip } from "@/lib/store";
import { useTrips } from "@/lib/trips/store";
import { getRepository } from "@/lib/itinerary/repository";
import { requestNavigation } from "@/lib/ui/unsavedGuard";
import { THEME_OPTIONS, normalizeTheme } from "@/lib/theme/themes";
import { CURRENCIES } from "@/lib/budget/estimate";

/**
 * The account, in the Journey Core language — a cinematic modal, not a page.
 * An orbiting avatar (your identity as the heart), a quiet read on your travels,
 * then identity/appearance/currency + the full Profile & Settings paths. All
 * existing account plumbing is preserved; this is the on-theme surface.
 */
export function AccountOverlay({ onClose }: { onClose: () => void }) {
  const { state, actions } = useAuth();
  const { actions: tripActions } = useTrip();
  const { trips } = useTrips();
  const [mounted, setMounted] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    let cancelled = false;
    getRepository().listAllSaved().then((s) => { if (!cancelled) setSavedCount(s.length); }).catch(() => { if (!cancelled) setSavedCount(0); });
    return () => { cancelled = true; };
  }, []);

  const name = state.profile?.full_name || state.profile?.username || "Traveller";
  const email = state.user?.email || state.profile?.username || "";
  const initial = name.trim().charAt(0).toUpperCase() || "T";
  const avatarUrl = state.profile?.avatar_url;
  const theme = normalizeTheme(state.preferences?.theme);
  const currency = state.preferences?.currency || "KWD";

  if (!mounted) return null;

  const stat = (icon: React.ReactNode, value: string) => (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-white/70">{icon}{value}</span>
  );

  return createPortal(
    <div className="fixed inset-0 z-[130] grid place-items-center p-4 warp-veil" style={{ background: "rgba(4,10,20,.62)", backdropFilter: "blur(8px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="imm-bg relative w-full max-w-[440px] max-h-[92vh] overflow-auto imm-scroll rounded-[24px] border border-white/12 text-white"
        style={{ boxShadow: "0 50px 110px -40px rgba(0,0,0,.85)", animation: "imm_rise .5s var(--ease-out-expo) both" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ambient glow */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ top: "-26%", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, color-mix(in oklab, var(--accent) 22%, transparent), transparent 64%)" }} />
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 z-10 imm-glass imm-glass-hover w-9 h-9 rounded-full grid place-items-center cursor-pointer transition"><X size={16} /></button>

        {/* header — the orbiting avatar */}
        <div className="relative flex flex-col items-center text-center pt-9 px-6">
          <div className="relative w-[92px] h-[92px] grid place-items-center">
            {/* orbit + travelling node */}
            <span className="absolute inset-0" style={{ animation: "logo_sweep 14s linear infinite", transformOrigin: "center" }}>
              <span className="absolute rounded-full" style={{ inset: 6, border: "1px solid color-mix(in oklab, var(--accent) 35%, transparent)", transform: "rotate(-24deg) scaleY(.42)" }} />
              <span className="absolute rounded-full" style={{ top: "50%", left: -1, width: 5, height: 5, marginTop: -2.5, background: "var(--accent)", boxShadow: "0 0 8px 1px color-mix(in oklab, var(--accent) 80%, transparent)" }} />
            </span>
            {/* avatar */}
            <div className="w-[68px] h-[68px] rounded-full overflow-hidden grid place-items-center font-display font-bold text-[26px] text-white shrink-0" style={{ background: avatarUrl ? "rgba(255,255,255,.06)" : "var(--accent)", boxShadow: "0 0 30px -6px color-mix(in oklab, var(--accent) 70%, transparent)" }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : initial}
            </div>
          </div>
          <div className="font-brand font-bold tracking-[-.01em] text-[22px] mt-3.5">{name}</div>
          {email && <div className="text-[12.5px] text-white/55 truncate max-w-full">{email}</div>}
          <div className="mt-2.5 flex items-center gap-4">
            {stat(<Plane size={13} style={{ color: "var(--accent)" }} />, `${trips.length} ${trips.length === 1 ? "journey" : "journeys"}`)}
            {stat(<Heart size={13} style={{ color: "var(--accent)" }} />, `${savedCount ?? "—"} saved`)}
          </div>
        </div>

        <div className="relative p-5 pt-6 flex flex-col gap-5">
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
                    className="journey-card rounded-[14px] p-3 text-left cursor-pointer"
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
            <select
              value={currency}
              onChange={(e) => actions.updatePreferences({ currency: e.target.value })}
              className="imm-input w-full appearance-none rounded-[12px] px-3.5 py-3 text-[14px] cursor-pointer outline-none"
            >
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code} style={{ color: "#111" }}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* full profile + settings (all existing functionality preserved) */}
          <div>
            <div className="text-[11px] uppercase tracking-[.12em] text-white/45 mb-2.5">More settings</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { onClose(); tripActions.goProfile(); }}
                className="journey-card imm-glass flex items-center gap-2 px-3.5 py-3 rounded-[12px] text-[13px] font-semibold text-white cursor-pointer"
              >
                <UserCircle size={16} style={{ color: "var(--accent)" }} />Profile &amp; security
              </button>
              <button
                onClick={() => { onClose(); tripActions.goSettings(); }}
                className="journey-card imm-glass flex items-center gap-2 px-3.5 py-3 rounded-[12px] text-[13px] font-semibold text-white cursor-pointer"
              >
                <SlidersHorizontal size={16} style={{ color: "var(--accent)" }} />All settings
              </button>
            </div>
          </div>

          {/* sign out */}
          <button
            onClick={() => { onClose(); requestNavigation(() => actions.signOut()); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[12px] text-[14px] font-semibold cursor-pointer transition hover:brightness-110"
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
