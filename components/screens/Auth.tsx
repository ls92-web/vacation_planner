"use client";

import { useTrip } from "@/lib/store";
import { Compass } from "../icons";

function ringFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "var(--accent)";
  e.target.style.boxShadow = "0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent)";
}
function ringBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "var(--line)";
  e.target.style.boxShadow = "none";
}

const inputCls =
  "w-full mt-1.5 px-3.5 py-[13px] border border-line rounded-xl text-[14.5px] bg-white outline-none";

export function AuthScreen() {
  const { state, actions } = useTrip();
  const signup = state.authMode === "signup";

  return (
    <div className="min-h-screen flex flex-wrap">
      {/* Brand panel */}
      <div
        className="flex-[1_1_420px] min-h-[300px] relative overflow-hidden text-white flex flex-col justify-between"
        style={{
          background:
            "linear-gradient(155deg, var(--accent), color-mix(in oklab, var(--accent) 62%, #11304f))",
          padding: "clamp(32px,4vw,60px)",
        }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{ background: "repeating-linear-gradient(135deg,#fff 0 2px,transparent 2px 16px)" }}
        />
        <div className="relative flex items-center gap-[11px] font-semibold tracking-[.2px]">
          <div className="w-[34px] h-[34px] rounded-[11px] bg-white/[.18] grid place-items-center text-white">
            <Compass size={17} strokeWidth={2} />
          </div>
          Wanderfold
        </div>
        <div className="relative">
          <div
            className="font-display font-bold leading-[1.04] tracking-[-.02em] text-balance"
            style={{ fontSize: "clamp(30px,3.4vw,46px)" }}
          >
            One messy idea of a trip,
            <br />
            one finished plan.
          </div>
          <p className="mt-[18px] max-w-[420px] text-[15.5px] leading-[1.6] text-white/80">
            Tell us where you&apos;re headed and who&apos;s coming. We build the whole day-by-day
            schedule — attractions, opening hours, kid-friendly spots, distances and all — ready to
            export.
          </p>
          <div className="mt-[26px] flex gap-[22px] flex-wrap text-[13px] text-white/85">
            <div>
              <div className="font-display text-[24px] font-bold">2 min</div>
              to a full plan
            </div>
            <div>
              <div className="font-display text-[24px] font-bold">120+</div>
              cities covered
            </div>
            <div>
              <div className="font-display text-[24px] font-bold">PDF</div>
              one-tap export
            </div>
          </div>
        </div>
        <div className="relative text-[12.5px] text-white/60">
          Made for families who&apos;d rather travel than tab-hop.
        </div>
      </div>

      {/* Form panel */}
      <div
        className="flex-[1_1_440px] flex items-center justify-center"
        style={{ padding: "clamp(28px,4vw,56px)" }}
      >
        <div className="w-full max-w-[380px] vp-fade">
          <div className="font-display font-bold text-[27px] tracking-[-.01em]">
            {signup ? "Create your account" : "Welcome back"}
          </div>
          <p className="text-muted mt-[7px] text-[14.5px]">
            {signup ? "Plan your first trip in minutes." : "Sign in to pick up where you left off."}
          </p>

          {signup && (
            <div className="mt-[22px]">
              <label className="text-[12.5px] font-semibold text-ink">Full name</label>
              <input defaultValue="Maya Ortega" className={inputCls} onFocus={ringFocus} onBlur={ringBlur} />
            </div>
          )}

          <div className="mt-4">
            <label className="text-[12.5px] font-semibold text-ink">Email</label>
            <input
              type="email"
              defaultValue="maya@family.travel"
              className={inputCls}
              onFocus={ringFocus}
              onBlur={ringBlur}
            />
          </div>

          <div className="mt-4">
            <div className="flex justify-between items-baseline">
              <label className="text-[12.5px] font-semibold text-ink">Password</label>
              {!signup && (
                <button className="border-none bg-transparent text-accent text-[12px] font-semibold cursor-pointer">
                  Forgot?
                </button>
              )}
            </div>
            <input
              type="password"
              defaultValue="trekking2026"
              className={inputCls}
              onFocus={ringFocus}
              onBlur={ringBlur}
            />
            {signup && <div className="text-[11.5px] text-muted mt-1.5">Use at least 8 characters.</div>}
          </div>

          <button
            onClick={actions.goForm}
            className="w-full mt-[22px] py-3.5 border-none rounded-xl bg-accent text-white text-[15px] font-semibold cursor-pointer hover:brightness-[1.06] transition"
            style={{ boxShadow: "0 8px 20px -8px var(--accent)" }}
          >
            {signup ? "Create account →" : "Sign in →"}
          </button>

          <div className="mt-[18px] text-center text-[13.5px] text-muted">
            {signup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={actions.toggleAuth}
              className="border-none bg-transparent text-accent font-bold cursor-pointer text-[13.5px]"
            >
              {signup ? "Sign in" : "Create one"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
