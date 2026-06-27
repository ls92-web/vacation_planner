"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { AuthResult, OnboardingAnswers, Preferences, Profile, SignupInput, SignupResult } from "./types";

interface AuthState {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  preferences: Preferences | null;
  recovery: boolean; // password-recovery link in progress
}

const REMEMBER_KEY = "wf_remember";
const ACTIVE_KEY = "wf_active";

function useProvideAuth() {
  const sb = getSupabase();
  const [state, setState] = useState<AuthState>({ ready: false, session: null, user: null, profile: null, preferences: null, recovery: false });
  const loadedFor = useRef<string | null>(null);

  const loadProfile = useCallback(
    async (userId: string) => {
      if (!sb) return;
      const [{ data: profile }, { data: preferences }] = await Promise.all([
        sb.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        sb.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      setState((s) => ({ ...s, profile: (profile as Profile) ?? null, preferences: (preferences as Preferences) ?? null }));
    },
    [sb]
  );

  useEffect(() => {
    if (!sb) {
      setState((s) => ({ ...s, ready: true }));
      return;
    }
    let active = true;

    sb.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      // "Remember me": if the user opted out, end the session when the tab/browser was closed.
      if (session && typeof window !== "undefined") {
        const remember = window.localStorage.getItem(REMEMBER_KEY);
        const stillActive = window.sessionStorage.getItem(ACTIVE_KEY);
        if (remember === "0" && !stillActive) {
          await sb.auth.signOut();
          if (active) setState((s) => ({ ...s, ready: true, session: null, user: null }));
          return;
        }
        window.sessionStorage.setItem(ACTIVE_KEY, "1");
      }
      if (!active) return;
      setState((s) => ({ ...s, ready: true, session, user: session?.user ?? null }));
      if (session?.user) {
        loadedFor.current = session.user.id;
        loadProfile(session.user.id);
      }
    });

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        recovery: event === "PASSWORD_RECOVERY" ? true : s.recovery,
        profile: session ? s.profile : null,
        preferences: session ? s.preferences : null,
      }));
      if (session?.user && loadedFor.current !== session.user.id) {
        loadedFor.current = session.user.id;
        loadProfile(session.user.id);
      }
      if (!session) loadedFor.current = null;
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [sb, loadProfile]);

  const actions = useMemo(() => {
    const fail = (error: string): AuthResult => ({ ok: false, error });

    return {
      isConfigured: () => isSupabaseConfigured(),

      async usernameAvailable(username: string): Promise<boolean> {
        if (!sb || !username) return true;
        const { data, error } = await sb.rpc("username_available", { p_username: username });
        return error ? true : Boolean(data);
      },

      async signUp(input: SignupInput): Promise<SignupResult> {
        if (!sb) return { ok: false, error: "Auth is not configured." };
        const { data, error } = await sb.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
            data: {
              full_name: input.fullName,
              username: input.username,
              country: input.country ?? null,
              travel_style: input.travelStyle ?? null,
              transport: input.transport ?? null,
              travelers: input.travelers != null ? String(input.travelers) : null,
              with_children: input.withChildren ?? false,
              children_ages: input.childrenAges ?? null,
            },
          },
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, needsConfirmation: !data.session };
      },

      async signIn(identifier: string, password: string, remember: boolean): Promise<AuthResult> {
        if (!sb) return fail("Auth is not configured.");
        let email = identifier.trim();
        if (!email.includes("@")) {
          const { data, error } = await sb.rpc("get_email_for_username", { p_username: email });
          if (error || !data) return fail("We couldn't find an account with that username.");
          email = data as string;
        }
        if (typeof window !== "undefined") {
          window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
          window.sessionStorage.setItem(ACTIVE_KEY, "1");
        }
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return fail(error.message);
        return { ok: true };
      },

      async signOut() {
        if (!sb) return;
        await sb.auth.signOut();
        if (typeof window !== "undefined") window.sessionStorage.removeItem(ACTIVE_KEY);
      },

      async sendReset(email: string): Promise<AuthResult> {
        if (!sb) return fail("Auth is not configured.");
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        });
        return error ? fail(error.message) : { ok: true };
      },

      async updatePassword(password: string): Promise<AuthResult> {
        if (!sb) return fail("Auth is not configured.");
        const { error } = await sb.auth.updateUser({ password });
        if (error) return fail(error.message);
        setState((s) => ({ ...s, recovery: false }));
        return { ok: true };
      },

      async saveOnboarding(a: OnboardingAnswers): Promise<AuthResult> {
        if (!sb || !state.user) return fail("Not signed in.");
        const uid = state.user.id;
        const [{ error: e1 }, { error: e2 }] = await Promise.all([
          sb.from("user_preferences").upsert(
            { user_id: uid, traveler_type: a.traveler_type, travel_with: a.travel_with, pace: a.pace, transport: a.transport, family_friendly: a.family_friendly },
            { onConflict: "user_id" }
          ),
          sb.from("profiles").update({ onboarded: true }).eq("user_id", uid),
        ]);
        if (e1 || e2) return fail((e1 || e2)!.message);
        await loadProfile(uid);
        return { ok: true };
      },

      async updateProfile(patch: Partial<Pick<Profile, "full_name" | "country" | "username">>): Promise<AuthResult> {
        if (!sb || !state.user) return fail("Not signed in.");
        const { error } = await sb.from("profiles").update(patch).eq("user_id", state.user.id);
        if (error) return fail(error.message);
        await loadProfile(state.user.id);
        return { ok: true };
      },

      async updatePreferences(patch: Partial<Omit<Preferences, "user_id">>): Promise<AuthResult> {
        if (!sb || !state.user) return fail("Not signed in.");
        const { error } = await sb.from("user_preferences").upsert({ user_id: state.user.id, ...patch }, { onConflict: "user_id" });
        if (error) return fail(error.message);
        await loadProfile(state.user.id);
        return { ok: true };
      },

      async deleteAccount(): Promise<AuthResult> {
        if (!sb) return fail("Auth is not configured.");
        const { error } = await sb.rpc("delete_my_account");
        if (error) return fail(error.message);
        await sb.auth.signOut();
        return { ok: true };
      },
    };
  }, [sb, state.user, loadProfile]);

  return { state, actions };
}

export type AuthStore = ReturnType<typeof useProvideAuth>;
const AuthContext = createContext<AuthStore | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useProvideAuth();
  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthStore {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
