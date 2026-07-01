"use client";

import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/store";
import { Logo } from "@/components/Logo";
import { AuthScreen } from "./AuthScreen";
import { Onboarding } from "./Onboarding";

function Splash() {
  return (
    <div className="imm-bg min-h-screen grid place-items-center text-white overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, color-mix(in oklab, var(--accent) 20%, transparent), transparent 62%)" }} />
      <div className="relative flex flex-col items-center gap-5">
        <Logo size={76} variant="plain" animated />
        <div className="font-brand font-semibold text-[22px] tracking-[-.01em]">Itinera</div>
        <div className="text-[12.5px] tracking-[.16em] uppercase text-white/45" style={{ animation: "logo_halo 2.4s var(--ease-soft) infinite" }}>Preparing your universe</div>
      </div>
    </div>
  );
}

function ConfigNotice() {
  return (
    <div className="imm-bg min-h-screen grid place-items-center p-6 text-white">
      <div className="max-w-[440px] text-center flex flex-col items-center gap-4">
        <Logo size={48} variant="plain" />
        <div className="font-brand font-semibold text-[22px] tracking-[-.01em]">Itinera</div>
        <h1 className="font-display font-bold text-[18px]">Sign-in isn&apos;t available</h1>
        <p className="text-[14px] text-white/60 leading-relaxed">
          This deployment is missing its Supabase configuration. Set{" "}
          <code className="font-mono text-[12.5px]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono text-[12.5px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in the hosting
          environment and redeploy (these are read at build time).
        </p>
      </div>
    </div>
  );
}

/**
 * Protects the app: shows auth/onboarding until the user is signed in and set up.
 * When Supabase isn't configured, development runs in a local no-auth fallback for
 * convenience — but production must NEVER silently grant access, so we show a clear
 * configuration notice instead of the app (a missing-env deploy otherwise looks
 * like "already logged in").
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (!isSupabaseConfigured()) {
    return process.env.NODE_ENV === "production" ? <ConfigNotice /> : <>{children}</>;
  }
  if (!state.ready) return <Splash />;
  if (state.recovery || !state.session) return <AuthScreen />;
  // Wait only until the profile fetch settles — never dead-end on the splash.
  if (state.session && !state.profileLoaded) return <Splash />;
  if (state.profile && !state.profile.onboarded) return <Onboarding />;
  return <>{children}</>;
}
