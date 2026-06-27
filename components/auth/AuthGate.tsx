"use client";

import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/store";
import { Logo } from "@/components/Logo";
import { AuthScreen } from "./AuthScreen";
import { Onboarding } from "./Onboarding";

function Splash() {
  return (
    <div className="min-h-screen grid place-items-center" style={{ background: "var(--bg)" }}>
      <div className="flex flex-col items-center gap-4">
        <Logo size={52} />
        <div className="font-brand font-semibold text-[22px] tracking-[-.01em] text-ink">Itinera</div>
        <div className="w-5 h-5 border-2 border-line border-t-accent rounded-full vp-spin" />
      </div>
    </div>
  );
}

/**
 * Protects the app: shows auth/onboarding until the user is signed in and set up.
 * When Supabase isn't configured the app runs without auth (local fallback).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (!isSupabaseConfigured()) return <>{children}</>;
  if (!state.ready) return <Splash />;
  if (state.recovery || !state.session) return <AuthScreen />;
  if (state.session && !state.profile) return <Splash />;
  if (state.profile && !state.profile.onboarded) return <Onboarding />;
  return <>{children}</>;
}
