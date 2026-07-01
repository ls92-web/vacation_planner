"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Eye, EyeOff } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth/store";

type Mode = "signin" | "signup" | "forgot" | "reset";

const TRAVEL_STYLES = ["Relaxed", "Balanced", "Busy", "Family-friendly", "Luxury", "Budget-friendly"];
const TRANSPORTS = ["Walking", "Driving", "Public transport"];

const label = "text-[12.5px] font-semibold text-white/80";
const input = "w-full mt-1.5 px-3.5 py-[12px] rounded-xl text-[14.5px] outline-none imm-input";

function Field({ children }: { children: React.ReactNode }) {
  return <div className="mt-4">{children}</div>;
}

export function AuthScreen() {
  const { state, actions } = useAuth();
  const [mode, setModeRaw] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  // form state
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("");
  const [travelStyle, setTravelStyle] = useState("Balanced");
  const [transport, setTransport] = useState("Walking");
  const [travelers, setTravelers] = useState("");
  const [withChildren, setWithChildren] = useState(false);
  const [childrenAges, setChildrenAges] = useState("");
  const [remember, setRemember] = useState(true);
  const [terms, setTerms] = useState(false);
  const [usernameFree, setUsernameFree] = useState<boolean | null>(null);

  const effectiveMode: Mode = state.recovery ? "reset" : mode;
  const setMode = (m: Mode) => { setError(null); setNotice(null); setModeRaw(m); };

  // debounced username availability
  useEffect(() => {
    if (effectiveMode !== "signup" || username.trim().length < 3) {
      setUsernameFree(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const free = await actions.usernameAvailable(username.trim());
      if (!cancelled) setUsernameFree(free);
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username, effectiveMode, actions]);

  const usernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(username.trim());
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const title = useMemo(() => {
    switch (effectiveMode) {
      case "signup": return "Create your account";
      case "forgot": return "Reset your password";
      case "reset": return "Choose a new password";
      default: return "Welcome back";
    }
  }, [effectiveMode]);
  const subtitle = useMemo(() => {
    switch (effectiveMode) {
      case "signup": return "Start planning trips that feel effortless.";
      case "forgot": return "We'll email you a secure reset link.";
      case "reset": return "Enter a new password for your account.";
      default: return "Sign in to pick up where you left off.";
    }
  }, [effectiveMode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (effectiveMode === "signin") {
      if (!identifier.trim() || !password) return setError("Enter your email/username and password.");
      setLoading(true);
      const r = await actions.signIn(identifier, password, remember);
      setLoading(false);
      if (!r.ok) setError(r.error);
      return;
    }

    if (effectiveMode === "forgot") {
      if (!emailValid) return setError("Enter a valid email address.");
      setLoading(true);
      const r = await actions.sendReset(email);
      setLoading(false);
      if (!r.ok) return setError(r.error);
      setNotice("Check your inbox for a password reset link.");
      return;
    }

    if (effectiveMode === "reset") {
      if (password.length < 12) return setError("Password must be at least 12 characters.");
      if (password !== confirm) return setError("Passwords don't match.");
      setLoading(true);
      const r = await actions.updatePassword(password);
      setLoading(false);
      if (!r.ok) return setError(r.error);
      setNotice("Password updated. You're all set.");
      return;
    }

    // signup
    if (!fullName.trim()) return setError("Please enter your full name.");
    if (!usernameValid) return setError("Username must be 3–20 letters, numbers or underscores.");
    if (usernameFree === false) return setError("That username is already taken.");
    if (!emailValid) return setError("Enter a valid email address.");
    if (password.length < 12) return setError("Password must be at least 12 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    if (!terms) return setError("Please accept the Terms & Privacy Policy.");

    setLoading(true);
    const r = await actions.signUp({
      fullName: fullName.trim(),
      username: username.trim(),
      email: email.trim(),
      password,
      country: country.trim() || undefined,
      travelStyle,
      transport,
      travelers: travelers ? Number(travelers) : undefined,
      withChildren,
      childrenAges: childrenAges.trim() || undefined,
    });
    setLoading(false);
    if (!r.ok) return setError(r.error);
    if (r.needsConfirmation) setNotice("Account created. Check your email to confirm, then sign in.");
    // if a session was created, the AuthGate moves on to onboarding automatically.
  }

  return (
    <div className="imm-bg min-h-screen relative flex items-center justify-center p-5 text-white overflow-hidden">
      {/* ambient accent glow */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ top: "-14%", width: 720, height: 720, borderRadius: "50%", background: "radial-gradient(circle, color-mix(in oklab, var(--accent) 22%, transparent), transparent 62%)" }} />
      <div className="relative w-full max-w-[440px] imm-glass rounded-[24px] p-[clamp(24px,4vw,38px)] imm-scroll imm-rise" style={{ boxShadow: "0 40px 90px -30px rgba(0,0,0,.8)", maxHeight: "94vh", overflowY: "auto" }}>
        <div className="flex items-center gap-2.5 mb-6">
          <Logo size={30} tile="rgba(255,255,255,.16)" />
          <span className="font-brand font-semibold text-[21px] tracking-[-.01em]">Itinera</span>
        </div>
        <form onSubmit={submit} className="w-full">
          <div className="font-brand font-bold text-[27px] tracking-[-.01em] leading-tight">{title}</div>
          <p className="text-white/60 mt-[7px] text-[14.5px]">{subtitle}</p>

          {notice && (
            <div className="mt-4 flex items-start gap-2 px-3.5 py-3 rounded-xl text-[13px]" style={{ background: "#E4F4F2", color: "#0A7A76" }}>
              <Check size={15} strokeWidth={2} className="mt-0.5 shrink-0" />{notice}
            </div>
          )}
          {error && (
            <div className="mt-4 px-3.5 py-3 rounded-xl text-[13px]" style={{ background: "#f7e4e2", color: "#9e3c37" }}>{error}</div>
          )}

          {/* SIGN IN */}
          {effectiveMode === "signin" && (
            <>
              <Field>
                <label className={label}>Email or username</label>
                <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" placeholder="you@example.com" className={input} />
              </Field>
              <Field>
                <div className="flex items-center justify-between">
                  <label className={label}>Password</label>
                  <button type="button" onClick={() => setMode("forgot")} className="text-[12px] font-semibold text-accent border-none bg-transparent cursor-pointer">Forgot?</button>
                </div>
                <PasswordInput value={password} onChange={setPassword} show={showPw} toggle={() => setShowPw((s) => !s)} autoComplete="current-password" />
              </Field>
              <label className="mt-4 flex items-center gap-2 text-[13px] text-white/70 cursor-pointer select-none">
                <Checkbox checked={remember} onChange={setRemember} /> Remember me on this device
              </label>
              <Submit loading={loading}>Sign in</Submit>
              <Switch>Don&apos;t have an account? <button type="button" onClick={() => setMode("signup")} className="text-accent font-bold border-none bg-transparent cursor-pointer">Create one</button></Switch>
            </>
          )}

          {/* SIGN UP */}
          {effectiveMode === "signup" && (
            <>
              <Field>
                <label className={label}>Full name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" placeholder="Maya Ortega" className={input} />
              </Field>
              <Field>
                <label className={label}>Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="mayatravels" className={input} />
                {username.trim().length >= 3 && (
                  <div className="text-[12px] mt-1.5" style={{ color: !usernameValid ? "#9e3c37" : usernameFree === false ? "#9e3c37" : usernameFree ? "#0A7A76" : "var(--muted)" }}>
                    {!usernameValid ? "3–20 letters, numbers or underscores." : usernameFree === false ? "Username is taken." : usernameFree ? "Username is available." : "Checking…"}
                  </div>
                )}
              </Field>
              <Field>
                <label className={label}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className={input} />
              </Field>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Password</label>
                  <PasswordInput value={password} onChange={setPassword} show={showPw} toggle={() => setShowPw((s) => !s)} autoComplete="new-password" />
                </div>
                <div>
                  <label className={label}>Confirm</label>
                  <input type={showPw ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="••••••••" className={input} />
                </div>
              </div>

              <button type="button" onClick={() => setShowOptional((o) => !o)} className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-accent border-none bg-transparent cursor-pointer">
                <ChevronDown size={15} strokeWidth={2} className="transition-transform" style={{ transform: showOptional ? "rotate(180deg)" : "none" }} />
                Personalize your trips (optional)
              </button>
              {showOptional && (
                <div className="mt-2 vp-slide-down flex flex-col gap-3">
                  <div>
                    <label className={label}>Country / region</label>
                    <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Spain" className={input} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={label}>Travel style</label>
                      <Select value={travelStyle} onChange={setTravelStyle} options={TRAVEL_STYLES} />
                    </div>
                    <div>
                      <label className={label}>Transport</label>
                      <Select value={transport} onChange={setTransport} options={TRANSPORTS} />
                    </div>
                  </div>
                  <div>
                    <label className={label}>Number of travelers</label>
                    <input type="number" min={1} max={12} value={travelers} onChange={(e) => setTravelers(e.target.value)} placeholder="2" className={input} />
                  </div>
                  <label className="flex items-center gap-2 text-[13px] text-white/70 cursor-pointer select-none">
                    <Checkbox checked={withChildren} onChange={setWithChildren} /> Traveling with children
                  </label>
                  {withChildren && (
                    <div>
                      <label className={label}>Children&apos;s ages</label>
                      <input value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} placeholder="6, 9" className={input} />
                    </div>
                  )}
                </div>
              )}

              <label className="mt-4 flex items-start gap-2 text-[13px] text-white/70 cursor-pointer select-none">
                <Checkbox checked={terms} onChange={setTerms} /> <span>I agree to the <span className="text-accent font-semibold">Terms</span> &amp; <span className="text-accent font-semibold">Privacy Policy</span>.</span>
              </label>
              <Submit loading={loading}>Create account</Submit>
              <Switch>Already have an account? <button type="button" onClick={() => setMode("signin")} className="text-accent font-bold border-none bg-transparent cursor-pointer">Sign in</button></Switch>
            </>
          )}

          {/* FORGOT */}
          {effectiveMode === "forgot" && (
            <>
              <Field>
                <label className={label}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className={input} />
              </Field>
              <Submit loading={loading}>Send reset link</Submit>
              <Switch><button type="button" onClick={() => setMode("signin")} className="text-accent font-bold border-none bg-transparent cursor-pointer">Back to sign in</button></Switch>
            </>
          )}

          {/* RESET */}
          {effectiveMode === "reset" && (
            <>
              <Field>
                <label className={label}>New password</label>
                <PasswordInput value={password} onChange={setPassword} show={showPw} toggle={() => setShowPw((s) => !s)} autoComplete="new-password" />
              </Field>
              <Field>
                <label className={label}>Confirm new password</label>
                <input type={showPw ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="••••••••" className={input} />
              </Field>
              <Submit loading={loading}>Update password</Submit>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, show, toggle, autoComplete }: { value: string; onChange: (v: string) => void; show: boolean; toggle: () => void; autoComplete?: string }) {
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder="••••••••" className={`${input} pr-10`} />
      <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-white/50 hover:text-white cursor-pointer" tabIndex={-1}>
        {show ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
      </button>
    </div>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="w-[18px] h-[18px] rounded-[6px] border grid place-items-center shrink-0 cursor-pointer transition" style={{ borderColor: checked ? "var(--accent)" : "rgba(255,255,255,.3)", background: checked ? "var(--accent)" : "rgba(255,255,255,.06)" }}>
      {checked && <Check size={12} strokeWidth={3} className="text-white" />}
    </button>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative mt-1.5">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3.5 py-[12px] rounded-xl text-[14px] outline-none appearance-none cursor-pointer imm-input">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={15} strokeWidth={2} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
    </div>
  );
}

function Submit({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading} className="w-full mt-[22px] py-3.5 border-none rounded-xl bg-accent text-white text-[15px] font-semibold cursor-pointer hover:brightness-[1.06] transition disabled:opacity-60 flex items-center justify-center gap-2" style={{ boxShadow: "0 8px 20px -8px var(--accent)" }}>
      {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full vp-spin" />}
      {children}
    </button>
  );
}

function Switch({ children }: { children: React.ReactNode }) {
  return <div className="mt-[18px] text-center text-[13.5px] text-white/60">{children}</div>;
}
