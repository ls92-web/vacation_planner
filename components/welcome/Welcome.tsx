"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { useTrip } from "@/lib/store";
import { useTrips } from "@/lib/trips/store";
import { useTripLoader } from "@/lib/trips/useTripLoader";
import { composeTrip } from "@/lib/ai-client";
import { geocodeCity } from "@/lib/geo";
import { saveTrip } from "@/lib/destinations/repository";
import type { Destination } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { ImmersiveMenu } from "@/components/immersive/ImmersiveMenu";

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

const PROMPTS = [
  "10 days exploring Italy with my family.",
  "A relaxing honeymoon in Bali.",
  "Road trip across Switzerland.",
  "A food adventure through Japan.",
  "A long weekend of coffee and design in Copenhagen.",
];

// Decorative glowing points scattered over the globe.
const DOTS = [
  { top: "28%", left: "38%", d: 0 },
  { top: "44%", left: "60%", d: 0.6 },
  { top: "58%", left: "30%", d: 1.2 },
  { top: "36%", left: "70%", d: 1.8 },
  { top: "66%", left: "52%", d: 2.4 },
];

export function Welcome() {
  const { actions } = useTrip();
  const { actions: tripActions } = useTrips();
  const loadPlan = useTripLoader();
  const [value, setValue] = useState("");
  const [promptIdx, setPromptIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setInterval(() => setPromptIdx((i) => (i + 1) % PROMPTS.length), 3400);
    return () => clearInterval(t);
  }, []);

  const start = async () => {
    const text = value.trim();
    if (!text || busy) return;
    setError(null);
    setBusy(true);
    try {
      // The AI reads the words and composes a real trip (destinations + preferences).
      // A trip is created ONLY on a confident result — never from the raw prompt.
      const outcome = await composeTrip(text);
      if (outcome.status !== "ok") {
        // Transient (busy) or unparseable (empty): create nothing, keep the prompt,
        // and let the user retry with one click.
        setBusy(false);
        setError(
          outcome.status === "busy"
            ? "The AI is currently busy. Please try again in a few seconds."
            : "I couldn’t turn that into a trip yet — try naming a destination or two."
        );
        return;
      }
      const composed = outcome.trip;
      const trip = await tripActions.createTrip(composed.name || composed.destinations[0].city, composed.destinations[0].city);
      if (!trip) throw new Error("createTrip failed");
      const cursor = new Date();
      cursor.setDate(cursor.getDate() + 30); // sensible default start ~a month out
      const dests: Destination[] = [];
      for (let i = 0; i < composed.destinations.length; i++) {
        const c = composed.destinations[i];
        const g = await geocodeCity(c.city, c.country).catch(() => null);
        const arrive = new Date(cursor);
        cursor.setDate(cursor.getDate() + c.nights);
        dests.push({
          id: i + 1, name: c.city, country: g?.countryName || c.country || "", countryCode: g?.countryCode || "",
          lat: g?.lat, lng: g?.lng, image: null, saved: true, expanded: false,
          arrive: fmtDate(arrive), depart: fmtDate(cursor), accoms: [], budgetOverride: null,
        });
      }
      await saveTrip(trip.id, dests, "standard", {}, composed.preferences || {});
      // Enter the conversational workspace, hydrating the store from what we
      // just saved (the workspace reads the store; loadPlan populates it).
      actions.goWorkspace();
      await loadPlan(trip.id, composed.destinations[0].city);
    } catch {
      // A confident trip failed to persist (rare DB/network hiccup) — surface it
      // for retry rather than dropping the user into a half-built trip.
      setBusy(false);
      setError("Something went wrong starting your trip. Please try again.");
    }
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center px-6 text-white"
      style={{ background: "radial-gradient(125% 120% at 50% -10%, #1a2c4d 0%, #0c1828 48%, #060c16 100%)" }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes vpw_spin { to { transform: rotate(360deg); } }
        @keyframes vpw_float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes vpw_pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1.35)} }
        @keyframes vpw_rise { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes vpw_prompt { 0%{opacity:0;transform:translateY(6px)} 14%,86%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-6px)} }
      `,
        }}
      />

      {/* ambient warm glow */}
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ top: "-12%", width: 760, height: 760, borderRadius: "50%", background: "radial-gradient(circle, rgba(197,110,20,.20), transparent 62%)" }} />

      {/* globe */}
      <div className="pointer-events-none absolute" style={{ top: "5%", animation: "vpw_float 10s ease-in-out infinite" }}>
        <div
          className="relative rounded-full overflow-hidden"
          style={{
            width: "clamp(240px, 42vw, 400px)",
            aspectRatio: "1",
            background: "radial-gradient(circle at 36% 30%, #234a78, #0f2a4d 58%, #08182f)",
            boxShadow: "inset -26px -26px 72px rgba(0,0,0,.66), 0 0 150px rgba(70,130,210,.22)",
          }}
        >
          <div
            className="absolute inset-0 opacity-60"
            style={{
              animation: "vpw_spin 42s linear infinite",
              background:
                "repeating-linear-gradient(90deg, rgba(130,180,235,.16) 0 1px, transparent 1px 28px), repeating-linear-gradient(0deg, rgba(130,180,235,.10) 0 1px, transparent 1px 28px)",
            }}
          />
          <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 72% 78%, rgba(0,0,0,.55), transparent 56%)" }} />
          {DOTS.map((dot, i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{ top: dot.top, left: dot.left, width: 8, height: 8, background: "var(--accent)", boxShadow: "0 0 12px 2px rgba(197,110,20,.7)", animation: `vpw_pulse 3.4s ease-in-out ${dot.d}s infinite` }}
            />
          ))}
        </div>
      </div>

      {/* brand */}
      <div className="absolute top-6 left-6 flex items-center gap-2.5" style={{ animation: "vpw_rise .8s ease both" }}>
        <Logo size={30} variant="plain" />
        <span className="font-brand font-semibold text-[20px] tracking-[-.01em]">Itinera</span>
      </div>
      {/* floating menu */}
      <div className="absolute top-5 right-5 z-20"><ImmersiveMenu /></div>

      {/* content */}
      <div className="relative z-10 w-full max-w-[640px] text-center" style={{ marginTop: "min(34vw, 320px)" }}>
        <h1 className="font-brand font-bold leading-[1.05]" style={{ fontSize: "clamp(34px, 6vw, 60px)", animation: "vpw_rise .8s ease both" }}>
          Where shall we go next?
        </h1>
        <p className="mt-3 text-[15px] sm:text-[16px]" style={{ color: "rgba(255,255,255,.66)", animation: "vpw_rise .9s ease .05s both" }}>
          Describe your dream journey in your own words.
        </p>

        {/* input */}
        <div
          className="mt-7 flex items-end gap-2 rounded-[20px] p-2.5 text-left"
          style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.14)", backdropFilter: "blur(14px)", boxShadow: "0 24px 60px -24px rgba(0,0,0,.7)", animation: "vpw_rise 1s ease .1s both" }}
        >
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); start(); } }}
            rows={1}
            placeholder="e.g. A week of food and temples in Kyoto…"
            className="flex-1 resize-none bg-transparent outline-none border-none px-3 py-2.5 text-[15.5px] leading-relaxed text-white placeholder:text-white/40 max-h-[140px]"
            autoFocus
          />
          <button
            onClick={start}
            disabled={busy || !value.trim()}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[14px] text-[14px] font-bold cursor-pointer transition disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 10px 24px -10px var(--accent)" }}
          >
            {busy ? <><Sparkles size={16} strokeWidth={2} className="animate-pulse" />Charting…</> : <>Plan it<ArrowRight size={16} strokeWidth={2} /></>}
          </button>
        </div>

        {/* graceful failure: no trip was created — keep the prompt, offer one-click retry */}
        {error && (
          <div
            className="mt-4 flex items-center gap-3 rounded-[14px] px-4 py-3 text-left vp-fade-fast"
            style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(240,168,140,.32)", backdropFilter: "blur(14px)" }}
            role="alert"
          >
            <AlertCircle size={17} strokeWidth={2} className="shrink-0" style={{ color: "#F1A88C" }} />
            <span className="flex-1 text-[13px] leading-snug text-white/85">{error}</span>
            <button
              onClick={start}
              disabled={busy}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold text-white cursor-pointer transition hover:brightness-[1.06] disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              <RefreshCw size={13} strokeWidth={2.2} />Try again
            </button>
          </div>
        )}

        {/* rotating example prompt */}
        <button
          onClick={() => setValue(PROMPTS[promptIdx])}
          className="mt-5 inline-flex items-center gap-2 text-[13.5px] cursor-pointer"
          style={{ color: "rgba(255,255,255,.55)" }}
          title="Use this example"
        >
          <Sparkles size={13} strokeWidth={2} style={{ color: "var(--accent)" }} />
          <span key={promptIdx} style={{ animation: "vpw_prompt 3.4s ease both" }}>“{PROMPTS[promptIdx]}”</span>
        </button>
      </div>

      {/* returning users */}
      <button
        onClick={actions.goTrips}
        className="absolute bottom-6 text-[13px] cursor-pointer transition hover:text-white"
        style={{ color: "rgba(255,255,255,.5)" }}
      >
        View my trips →
      </button>
    </div>
  );
}
