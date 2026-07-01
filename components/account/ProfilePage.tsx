"use client";

import { useRef, useState } from "react";
import { BadgeCheck, Camera, Loader2, Lock, Mail, ShieldAlert, Trash2, UserCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/store";
import { useTrip } from "@/lib/store";
import { acctInput, Field, PageHeader, SelectInput, SettingCard } from "./ui";
import { useUnsavedChanges } from "@/lib/ui/useUnsavedChanges";

const LANGUAGES = ["English", "Arabic", "French", "Spanish", "German", "Italian"].map((l) => ({ value: l, label: l }));
const TIMEZONES = [
  "Asia/Kuwait", "Asia/Riyadh", "Asia/Dubai", "Asia/Qatar", "Asia/Bahrain", "Asia/Muscat",
  "Europe/London", "Europe/Paris", "Europe/Istanbul", "America/New_York", "America/Los_Angeles", "Asia/Tokyo",
].map((t) => ({ value: t, label: t.replace("_", " ") }));

function relativeTime(iso: string | null): string {
  if (!iso) return "Not changed yet";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d < 1) return "today";
  if (d < 30) return `${d} day${d !== 1 ? "s" : ""} ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m} month${m !== 1 ? "s" : ""} ago`;
  const y = Math.floor(m / 12);
  return `${y} year${y !== 1 ? "s" : ""} ago`;
}

export function ProfilePage() {
  const { state, actions } = useAuth();
  const trip = useTrip();
  const flash = trip.actions.flash;
  const profile = state.profile;
  const email = state.user?.email ?? "";
  const verified = !!state.user?.email_confirmed_at;

  // personal info
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [country, setCountry] = useState(profile?.country ?? "");
  const [language, setLanguage] = useState(profile?.language ?? "English");
  const [timezone, setTimezone] = useState(profile?.timezone ?? "Asia/Kuwait");
  const piDirty =
    fullName !== (profile?.full_name ?? "") || username !== (profile?.username ?? "") || country !== (profile?.country ?? "") ||
    language !== (profile?.language ?? "English") || timezone !== (profile?.timezone ?? "Asia/Kuwait");

  // avatar
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // security
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useUnsavedChanges(piDirty);

  async function savePersonal() {
    const r = await actions.updateProfile({ full_name: fullName.trim(), username: username.trim(), country: country.trim(), language, timezone });
    if (!r.ok) { flash(r.error); return false; }
    return true;
  }

  function resetPersonal() {
    setFullName(profile?.full_name ?? "");
    setUsername(profile?.username ?? "");
    setCountry(profile?.country ?? "");
    setLanguage(profile?.language ?? "English");
    setTimezone(profile?.timezone ?? "Asia/Kuwait");
  }

  async function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { flash("Please choose an image under 4 MB."); return; }
    setAvatarBusy(true);
    const r = await actions.uploadAvatar(file);
    setAvatarBusy(false);
    flash(r.ok ? "Profile picture updated" : r.error);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    const r = await actions.removeAvatar();
    setAvatarBusy(false);
    flash(r.ok ? "Profile picture removed" : r.error);
  }

  async function changeEmail() {
    if (busy) return;
    setBusy(true);
    const r = await actions.changeEmail(newEmail);
    setBusy(false);
    if (!r.ok) { flash(r.error); return; }
    flash("Confirmation sent — check your new inbox to finish the change.");
    setEmailOpen(false);
    setNewEmail("");
  }

  async function changePassword() {
    if (busy) return;
    if (pw.length < 12) { flash("Password must be at least 12 characters."); return; }
    if (pw !== pw2) { flash("Passwords don't match."); return; }
    setBusy(true);
    const r = await actions.updatePassword(pw);
    setBusy(false);
    if (!r.ok) { flash(r.error); return; }
    flash("Password updated");
    setPwOpen(false); setPw(""); setPw2("");
  }

  const initial = (profile?.full_name || username || email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-full text-white">
      <div className="max-w-[760px] mx-auto px-[clamp(16px,3vw,28px)] py-8">
        <PageHeader title="Profile" subtitle="Manage your personal account details and security." dirty={piDirty} />

        <div className="flex flex-col gap-5">
          {/* header card */}
          <section className="imm-glass rounded-[18px] p-5 sm:p-6 flex items-center gap-4 sm:gap-5">
            <div className="relative shrink-0">
              <div className="w-[76px] h-[76px] rounded-full overflow-hidden grid place-items-center text-white font-display font-bold text-[28px]" style={{ background: "var(--accent)" }}>
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={avatarBusy} title="Upload photo" className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent text-white grid place-items-center cursor-pointer hover:brightness-[1.06]" style={{ border: "2px solid #0c1828" }}>
                {avatarBusy ? <Loader2 size={14} className="vp-spin" /> : <Camera size={14} strokeWidth={2} />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onAvatarFile} className="hidden" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-[19px] tracking-[-.01em] truncate">{profile?.full_name || "Your name"}</span>
                {verified ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(62,124,90,.2)", color: "#7FD1A3" }}><BadgeCheck size={12} strokeWidth={2.5} />Verified</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(224,164,79,.16)", color: "#E0A44F" }}><ShieldAlert size={12} strokeWidth={2.5} />Unverified</span>
                )}
              </div>
              <div className="text-[13px] text-white/55 truncate">@{profile?.username || "username"}</div>
              <div className="text-[13px] text-white/55 truncate">{email}</div>
              {profile?.avatar_url && (
                <button onClick={removeAvatar} disabled={avatarBusy} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white/55 hover:text-[#F1A88C] cursor-pointer"><Trash2 size={13} strokeWidth={2} />Remove photo</button>
              )}
            </div>
          </section>

          {/* personal information */}
          <SettingCard icon={UserCircle} title="Personal information" description="Your name and where you're based." dirty={piDirty} onSave={savePersonal} onReset={resetPersonal}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className={acctInput} /></Field>
              <Field label="Username"><input value={username} onChange={(e) => setUsername(e.target.value)} className={acctInput} /></Field>
              <Field label="Country / region"><input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Kuwait" className={acctInput} /></Field>
              <Field label="Language"><SelectInput value={language} onChange={setLanguage} options={LANGUAGES} /></Field>
              <Field label="Time zone"><SelectInput value={timezone} onChange={setTimezone} options={TIMEZONES} /></Field>
            </div>
          </SettingCard>

          {/* security */}
          <SettingCard icon={Lock} title="Security" description="Keep your sign-in details safe.">
            {/* email */}
            <div className="rounded-[12px] border border-white/10 p-3.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Mail size={16} className="text-white/50 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] text-white/50">Email address</div>
                    <div className="text-[14px] font-semibold text-white truncate">{email}</div>
                  </div>
                </div>
                <button onClick={() => setEmailOpen((o) => !o)} className="px-3.5 py-2 rounded-[10px] border border-white/15 text-[13px] font-bold text-white/80 cursor-pointer hover:border-white/35 hover:text-white transition">Change email</button>
              </div>
              {emailOpen && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2 vp-slide-down">
                  <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" className={acctInput} autoFocus />
                  <button onClick={changeEmail} disabled={busy} className="px-4 py-2.5 rounded-[11px] bg-accent text-white text-[13px] font-bold cursor-pointer hover:brightness-[1.06] disabled:opacity-60 whitespace-nowrap">{busy ? "Sending…" : "Send confirmation"}</button>
                </div>
              )}
            </div>

            {/* password */}
            <div className="rounded-[12px] border border-white/10 p-3.5 mt-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Lock size={16} className="text-white/50 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] text-white/50">Password</div>
                    <div className="text-[14px] font-semibold text-white tracking-[2px]">••••••••</div>
                    <div className="text-[11.5px] text-white/45">Last changed: {relativeTime(profile?.password_changed_at ?? null)}</div>
                  </div>
                </div>
                <button onClick={() => setPwOpen((o) => !o)} className="px-3.5 py-2 rounded-[10px] border border-white/15 text-[13px] font-bold text-white/80 cursor-pointer hover:border-white/35 hover:text-white transition">Change password</button>
              </div>
              {pwOpen && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 vp-slide-down">
                  <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className={acctInput} autoFocus />
                  <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm password" className={acctInput} />
                  <button onClick={changePassword} disabled={busy} className="sm:col-span-2 px-4 py-2.5 rounded-[11px] bg-accent text-white text-[13px] font-bold cursor-pointer hover:brightness-[1.06] disabled:opacity-60">{busy ? "Updating…" : "Update password"}</button>
                </div>
              )}
            </div>
          </SettingCard>

          {/* danger zone */}
          <SettingCard icon={Trash2} title="Delete account" description="Permanently delete your account and all trips, schedules and saved places." danger>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="px-4 py-2.5 rounded-[11px] border text-[13.5px] font-bold cursor-pointer" style={{ borderColor: "#F1A88C", color: "#F1A88C", background: "transparent" }}>Delete account</button>
            ) : (
              <div className="rounded-[12px] p-3.5" style={{ background: "rgba(241,168,140,.12)", border: "1px solid rgba(241,168,140,.3)" }}>
                <div className="text-[13.5px] font-bold" style={{ color: "#F1A88C" }}>This cannot be undone. Delete your account permanently?</div>
                <div className="flex gap-2 mt-2.5">
                  <button onClick={() => actions.deleteAccount()} className="px-4 py-2 rounded-[10px] text-white text-[13px] font-bold cursor-pointer" style={{ background: "#B3402F" }}>Yes, delete everything</button>
                  <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 rounded-[10px] border border-white/20 text-white text-[13px] font-bold cursor-pointer">Cancel</button>
                </div>
              </div>
            )}
          </SettingCard>
        </div>
      </div>
    </div>
  );
}
