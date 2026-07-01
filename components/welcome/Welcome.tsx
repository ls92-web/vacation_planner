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
import { JourneyCore, type CoreNode } from "@/components/immersive/JourneyCore";

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

const PROMPTS = [
  "10 days exploring Italy with my family.",
  "A relaxing honeymoon in Bali.",
  "Road trip across Switzerland.",
  "A food adventure through Japan.",
  "A long weekend of coffee and design in Copenhagen.",
];

// Turn what the user is typing into destination nodes on the Core, so the
// intelligence visibly reacts — points appear and shift as words are added.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function nodesFromText(text: string): CoreNode[] | undefined {
  const words = text.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2).slice(0, 5);
  if (!words.length) return undefined; // fall back to the Core's calm default
  return words.map((w, i) => {
    const h = hash(w);
    const ang = (h % 360) * (Math.PI / 180);
    const rad = 0.28 + ((h >> 4) % 46) / 100;
    return { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, active: i === 0 };
  });
}

export function Welcome() {
  const { actions } = useTrip();
  const { actions: tripActions } = useTrips();
  const loadPlan = useTripLoader();
  const [value, setValue] = useState("");
  const [promptIdx, setPromptIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setInterval(() => setPromptIdx((i) => (i + 1) % PROMPTS.length), 3400);
    return () => clearInterval(t);
  }, []);

  // Subtle pointer parallax — the whole scene breathes with the cursor.
  const onPointer = (e: React.PointerEvent) => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--px", px.toFixed(3));
    el.style.setProperty("--py", py.toFixed(3));
  };

  const coreState: "idle" | "thinking" | "routing" = busy ? "routing" : value.trim() ? "thinking" : "idle";
  const coreNodes = nodesFromText(value);

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
      ref={rootRef}
      onPointerMove={onPointer}
      className="imm-bg relative min-h-screen w-full overflow-hidden flex flex-col items-center px-6 text-white"
      style={{ ["--px" as string]: 0, ["--py" as string]: 0 }}
    >
      {/* ambient floating lights (parallax depth) */}
      <div aria-hidden className="wl-light" style={{ top: "-14%", left: "50%", width: 760, height: 760, background: "radial-gradient(circle, color-mix(in oklab, var(--accent) 22%, transparent), transparent 62%)", transform: "translate(calc(-50% + var(--px) * -26px), calc(var(--py) * -18px))" }} />
      <div aria-hidden className="wl-light wl-float" style={{ top: "40%", left: "12%", width: 360, height: 360, background: "radial-gradient(circle, rgba(90,150,235,.16), transparent 64%)", transform: "translate(calc(var(--px) * 34px), calc(var(--py) * 26px))" }} />
      <div aria-hidden className="wl-light wl-float" style={{ top: "10%", right: "8%", left: "auto", width: 320, height: 320, background: "radial-gradient(circle, rgba(120,180,255,.12), transparent 64%)", transform: "translate(calc(var(--px) * -30px), calc(var(--py) * 22px))", animationDelay: "-6s" }} />

      {/* brand + menu */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-2.5 imm-rise">
        <Logo size={30} variant="plain" />
        <span className="font-brand font-semibold text-[20px] tracking-[-.01em]">Itinera</span>
      </div>
      <div className="absolute top-5 right-5 z-20"><ImmersiveMenu /></div>

      {/* the living heart */}
      <div
        className="relative z-10 mt-[clamp(64px,12vh,120px)]"
        style={{ transform: "translate(calc(var(--px) * 16px), calc(var(--py) * 12px))", transition: "transform .3s var(--ease-out-expo)" }}
      >
        <JourneyCore size="clamp(260px,44vw,420px)" state={coreState} nodes={coreNodes} />
      </div>

      {/* hero */}
      <div className="relative z-10 w-full max-w-[640px] text-center -mt-[clamp(28px,5vw,56px)]">
        <h1 className="font-brand font-bold leading-[1.02] imm-rise" style={{ fontSize: "clamp(36px, 6.4vw, 64px)", letterSpacing: "-.02em" }}>
          Where shall we go next?
        </h1>
        <p className="mt-3 text-[15px] sm:text-[16px] imm-rise-2" style={{ color: "rgba(255,255,255,.62)" }}>
          Describe your journey. The intelligence maps the rest.
        </p>

        {/* compose */}
        <div
          className="mt-7 flex items-end gap-2 rounded-[20px] p-2.5 text-left imm-rise-3"
          style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.14)", backdropFilter: "blur(14px)", boxShadow: "0 24px 60px -24px rgba(0,0,0,.7)" }}
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
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[14px] text-[14px] font-bold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 10px 24px -10px var(--accent)", transition: "transform .2s var(--ease-spring), filter .2s ease" }}
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
          className="mt-5 inline-flex items-center gap-2 text-[13.5px] cursor-pointer transition hover:text-white/80"
          style={{ color: "rgba(255,255,255,.5)" }}
          title="Use this example"
        >
          <Sparkles size={13} strokeWidth={2} style={{ color: "var(--accent)" }} />
          <span key={promptIdx} style={{ animation: "vpw_prompt 3.4s ease both" }}>“{PROMPTS[promptIdx]}”</span>
        </button>
      </div>

      {/* returning users */}
      <button
        onClick={actions.goTrips}
        className="absolute bottom-6 z-20 text-[13px] cursor-pointer transition hover:text-white"
        style={{ color: "rgba(255,255,255,.5)" }}
      >
        View my trips →
      </button>

      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes vpw_prompt { 0%{opacity:0;transform:translateY(6px)} 14%,86%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-6px)} }`,
        }}
      />
    </div>
  );
}
