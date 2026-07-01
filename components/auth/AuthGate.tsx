"use client";

import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/store";
import { Logo } from "@/components/Logo";
import { AuthScreen } from "./AuthScreen";
import { Onboarding } from "./Onboarding";

function Splash() {
  return (
    <div className="imm-bg min-h-screen grid place-items-center text-white">
      <div className="flex flex-col items-center gap-4">
        <Logo size={52} />
        <div className="font-brand font-semibold text-[22px] tracking-[-.01em]">Itinera</div>
        <div className="w-5 h-5 border-2 border-white/20 rounded-full vp-spin" style={{ borderTopColor: "var(--accent)" }} />
      </div>
    </div>
  );
}

function ConfigNotice() {
  return (
    <div className="imm-bg min-h-screen grid place-items-center p-6 text-white">
      <div className="max-w-[440px] text-center flex flex-col items-center gap-4">
        <Logo size={48} />
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
