"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, LogOut, Settings, TrashIcon, User, X } from "@/components/icons";
import { useAuth } from "@/lib/auth/store";
import { subscribeAccount } from "@/lib/ui/account";

const fieldLabel = "text-[12px] font-semibold text-muted";
const field = "w-full mt-1.5 px-3 py-2.5 border border-line rounded-[10px] text-[14px] bg-white outline-none vp-input";

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative mt-1.5">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2.5 border border-line rounded-[10px] text-[14px] bg-white outline-none appearance-none cursor-pointer vp-input">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={14} strokeWidth={2} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-[42px] h-[24px] rounded-full transition relative cursor-pointer" style={{ background: on ? "var(--accent)" : "var(--line)" }}>
      <span className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all" style={{ left: on ? 21 : 3 }} />
    </button>
  );
}

function Panel({ onClose }: { onClose: () => void }) {
  const { state, actions } = useAuth();
  const [fullName, setFullName] = useState(state.profile?.full_name ?? "");
  const [country, setCountry] = useState(state.profile?.country ?? "");
  const [pace, setPace] = useState(state.preferences?.pace ?? "Balanced");
  const [transport, setTransport] = useState(state.preferences?.transport ?? "Walking");
  const [family, setFamily] = useState(state.preferences?.family_friendly ?? true);
  const [travelers, setTravelers] = useState(state.preferences?.travelers != null ? String(state.preferences.travelers) : "");
  const [withChildren, setWithChildren] = useState(state.preferences?.with_children ?? false);
  const [childrenAges, setChildrenAges] = useState(state.preferences?.children_ages ?? "");
  const [savingP, setSavingP] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const flash = (m: string) => { setSaved(m); setTimeout(() => setSaved(null), 1800); };

  async function saveProfile() {
    setSavingP(true);
    await actions.updateProfile({ full_name: fullName.trim(), country: country.trim() });
    setSavingP(false);
    flash("Profile saved");
  }
  async function savePrefs() {
    setSavingPrefs(true);
    await actions.updatePreferences({ pace, transport, family_friendly: family, travelers: travelers ? Number(travelers) : null, with_children: withChildren, children_ages: childrenAges.trim() || null });
    setSavingPrefs(false);
    flash("Preferences saved");
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center p-4" style={{ background: "rgba(20,16,12,.55)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[460px] max-h-[88vh] overflow-auto vp-scroll bg-bg rounded-[20px] border border-line shadow-2xl vp-pop">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 border-b border-line" style={{ background: "color-mix(in oklab, var(--bg) 92%, #fff)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-accent text-white grid place-items-center font-display font-bold text-[14px]">
              {(state.profile?.full_name || state.user?.email || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-[15px] leading-tight truncate">{state.profile?.full_name || "Your account"}</div>
              <div className="text-[12px] text-muted truncate">{state.user?.email}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-[10px] border border-line bg-surface grid place-items-center cursor-pointer text-muted hover:text-ink"><X size={16} strokeWidth={2} /></button>
        </div>

        <div className="p-5 flex flex-col gap-6">
          {/* profile */}
          <section>
            <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[.04em] text-muted mb-3"><User size={13} strokeWidth={2} className="text-accent" />Profile</div>
            <label className={fieldLabel}>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} />
            <div className="mt-3">
              <label className={fieldLabel}>Username</label>
              <input value={state.profile?.username ?? ""} readOnly className={`${field} opacity-70`} />
            </div>
            <div className="mt-3">
              <label className={fieldLabel}>Country / region</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className={field} />
            </div>
            <button onClick={saveProfile} disabled={savingP} className="mt-3 px-4 py-2 rounded-[10px] bg-accent text-white text-[13px] font-bold cursor-pointer hover:brightness-[1.06] disabled:opacity-60">Save profile</button>
          </section>

          {/* preferences */}
          <section className="border-t border-line pt-5">
            <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[.04em] text-muted mb-3"><Settings size={13} strokeWidth={2} className="text-accent" />Travel preferences</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={fieldLabel}>Pace</label><Select value={pace} onChange={setPace} options={["Relaxed", "Balanced", "Busy"]} /></div>
              <div><label className={fieldLabel}>Transport</label><Select value={transport} onChange={setTransport} options={["Walking", "Driving", "Public transport"]} /></div>
            </div>
            <div className="mt-3"><label className={fieldLabel}>Number of travelers</label><input type="number" min={1} max={12} value={travelers} onChange={(e) => setTravelers(e.target.value)} className={field} /></div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[13px] text-ink">Family-friendly AI suggestions</span>
              <Toggle on={family} onClick={() => setFamily((v) => !v)} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[13px] text-ink">Traveling with children</span>
              <Toggle on={withChildren} onClick={() => setWithChildren((v) => !v)} />
            </div>
            {withChildren && (
              <div className="mt-3"><label className={fieldLabel}>Children&apos;s ages</label><input value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} placeholder="6, 9" className={field} /></div>
            )}
            <button onClick={savePrefs} disabled={savingPrefs} className="mt-3 px-4 py-2 rounded-[10px] bg-accent text-white text-[13px] font-bold cursor-pointer hover:brightness-[1.06] disabled:opacity-60">Save preferences</button>
          </section>

          {saved && (
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "#0A7A76" }}><Check size={14} strokeWidth={2.5} />{saved}</div>
          )}

          {/* danger / session */}
          <section className="border-t border-line pt-5 flex flex-col gap-3">
            <button onClick={() => actions.signOut()} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[10px] border border-line bg-surface text-ink text-[13.5px] font-bold cursor-pointer hover:border-ink">
              <LogOut size={15} strokeWidth={2} />Log out
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[10px] border border-line bg-surface text-[#9e3c37] text-[13.5px] font-bold cursor-pointer hover:border-[#9e3c37]">
                <TrashIcon size={15} strokeWidth={2} />Delete account
              </button>
            ) : (
              <div className="rounded-[12px] p-3" style={{ background: "#f7e4e2" }}>
                <div className="text-[13px] font-bold" style={{ color: "#9e3c37" }}>Permanently delete your account?</div>
                <div className="text-[12px] mt-1" style={{ color: "#7a3b37" }}>This removes your profile, trips, schedules and saved places. This can&apos;t be undone.</div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => actions.deleteAccount()} className="flex-1 py-2 rounded-[9px] text-white text-[13px] font-bold cursor-pointer" style={{ background: "#9e3c37" }}>Yes, delete everything</button>
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-[9px] border border-line bg-white text-ink text-[13px] font-bold cursor-pointer">Cancel</button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Account control. `inline` renders a compact avatar (for the top bar); it also
 *  opens whenever something calls openAccount() (e.g. the sidebar Settings/Profile). */
export function AccountButton({ inline = false }: { inline?: boolean }) {
  const { state } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => subscribeAccount(() => setOpen(true)), []);
  if (!state.user) return null;
  const initial = (state.profile?.full_name || state.user.email || "?").slice(0, 1).toUpperCase();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Account"
        className={
          inline
            ? "w-9 h-9 rounded-full bg-accent text-white font-display font-bold grid place-items-center cursor-pointer hover:brightness-[1.06] transition"
            : "fixed bottom-[22px] left-[84px] z-[70] w-10 h-10 rounded-full bg-accent text-white font-display font-bold grid place-items-center cursor-pointer"
        }
        style={inline ? undefined : { boxShadow: "0 8px 24px -10px rgba(0,0,0,.4)" }}
      >
        {initial}
      </button>
      {mounted && open && createPortal(<Panel onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
