"use client";

import { useState } from "react";
import { Check, Sparkle } from "@/components/icons";
import { useAuth } from "@/lib/auth/store";
import { Logo } from "@/components/Logo";
import { ThemePicker } from "@/components/theme/ThemePicker";
import { applyThemeToDocument, normalizeTheme, type ThemeId } from "@/lib/theme/themes";

const QUESTIONS: { key: "traveler_type" | "travel_with" | "pace" | "transport"; q: string; opts: string[] }[] = [
  { key: "traveler_type", q: "What type of traveler are you?", opts: ["Culture seeker", "Foodie", "Outdoorsy", "Relaxed", "Adventurer", "Luxury"] },
  { key: "travel_with", q: "Who do you usually travel with?", opts: ["Solo", "Couple", "Family with kids", "Friends"] },
  { key: "pace", q: "What pace do you prefer?", opts: ["Relaxed", "Balanced", "Busy"] },
  { key: "transport", q: "What transport do you prefer?", opts: ["Walking", "Driving", "Public transport"] },
];

export function Onboarding() {
  const { state, actions } = useAuth();
  const p = state.preferences;
  const [answers, setAnswers] = useState<Record<string, string>>({
    traveler_type: p?.traveler_type || "Culture seeker",
    travel_with: p?.travel_with || "Family with kids",
    pace: p?.pace || "Balanced",
    transport: p?.transport || "Walking",
  });
  const [family, setFamily] = useState<boolean>(p?.family_friendly ?? true);
  const [theme, setTheme] = useState<ThemeId>(normalizeTheme(p?.theme));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setAnswers((a) => ({ ...a, [k]: v }));
  const pickTheme = (id: ThemeId) => {
    setTheme(id);
    applyThemeToDocument(id); // instant live preview across the app
  };

  async function finish() {
    setSaving(true);
    setError(null);
    const r = await actions.saveOnboarding({
      traveler_type: answers.traveler_type,
      travel_with: answers.travel_with,
      pace: answers.pace,
      transport: answers.transport,
      family_friendly: family,
      theme,
    });
    setSaving(false);
    if (!r.ok) setError(r.error);
    // success → AuthGate renders the app (profile.onboarded becomes true)
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[640px] vp-fade">
        <div className="flex items-center gap-2.5 mb-5">
          <Logo size={30} />
          <span className="font-brand font-semibold text-[20px] tracking-[-.01em] text-ink">Itinera</span>
        </div>
        <div className="bg-surface border border-line rounded-[22px] p-6 sm:p-8" style={{ boxShadow: "0 20px 50px -24px rgba(0,0,0,.25)" }}>
          <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[.05em] text-accent">
            <Sparkle size={14} strokeWidth={1.8} />A quick setup
          </div>
          <div className="font-brand font-semibold text-[28px] tracking-[-.01em] mt-1.5">
            Welcome{state.profile?.full_name ? `, ${state.profile.full_name.split(" ")[0]}` : ""}.
          </div>
          <p className="text-muted text-[14px] mt-1.5">Five quick taps so the AI tailors every plan to you. You can change these any time.</p>

          <div className="mt-6 flex flex-col gap-5">
            {QUESTIONS.map((question) => (
              <div key={question.key}>
                <div className="text-[13.5px] font-semibold mb-2">{question.q}</div>
                <div className="flex flex-wrap gap-2">
                  {question.opts.map((o) => {
                    const on = answers[question.key] === o;
                    return (
                      <button
                        key={o}
                        onClick={() => set(question.key, o)}
                        className="px-3.5 py-2 rounded-full border text-[13px] font-semibold cursor-pointer transition"
                        style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent)" : "#fff", color: on ? "#fff" : "var(--ink)" }}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <div className="text-[13.5px] font-semibold mb-2">Do you want AI suggestions to be family-friendly?</div>
              <div className="flex gap-2">
                {[true, false].map((v) => {
                  const on = family === v;
                  return (
                    <button
                      key={String(v)}
                      onClick={() => setFamily(v)}
                      className="px-4 py-2 rounded-full border text-[13px] font-semibold cursor-pointer transition"
                      style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent)" : "#fff", color: on ? "#fff" : "var(--ink)" }}
                    >
                      {v ? "Yes, prioritize family-friendly" : "No, show everything"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[13.5px] font-semibold mb-1">Choose your colour theme</div>
              <p className="text-[12px] text-muted mb-2.5">Sets the look of the whole app — you can change it anytime in Settings.</p>
              <ThemePicker value={theme} onChange={pickTheme} />
            </div>
          </div>

          {error && <div className="mt-4 px-3.5 py-3 rounded-xl text-[13px]" style={{ background: "#f7e4e2", color: "#9e3c37" }}>{error}</div>}

          <button onClick={finish} disabled={saving} className="mt-7 w-full py-3.5 border-none rounded-xl bg-accent text-white text-[15px] font-bold cursor-pointer hover:brightness-[1.06] transition disabled:opacity-60 flex items-center justify-center gap-2" style={{ boxShadow: "0 8px 20px -8px var(--accent)" }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full vp-spin" /> : <Check size={16} strokeWidth={2.5} />}
            Start planning
          </button>
        </div>
      </div>
    </div>
  );
}
