"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, User } from "lucide-react";
import { useAuth } from "@/lib/auth/store";
import { useTrip } from "@/lib/store";

function Avatar({ url, initial, size }: { url?: string | null; initial: string; size: number }) {
  return (
    <div className="rounded-full overflow-hidden grid place-items-center text-white font-display font-bold shrink-0" style={{ width: size, height: size, background: "var(--brand-deep)", fontSize: size * 0.42 }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}

/** Compact account menu in the top bar: routes to Profile / Settings, or signs out. */
export function AccountButton(_props: { inline?: boolean }) {
  const { state, actions } = useAuth();
  const { actions: nav } = useTrip();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);

  const profile = state.profile;
  const email = state.user?.email ?? "";
  const initial = (profile?.full_name || profile?.username || email || "?").slice(0, 1).toUpperCase();
  const go = (fn: () => void) => { setOpen(false); fn(); };

  const MenuItem = ({ icon: Icon, label, onClick, danger }: { icon: typeof User; label: string; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-[13.5px] font-semibold cursor-pointer transition-colors"
      style={{ color: danger ? "#b3402f" : "var(--ink)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--tint)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <Icon size={16} strokeWidth={2} className={danger ? "" : "text-muted"} />{label}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full cursor-pointer transition hover:brightness-[1.05]"
        style={{ outline: open ? "2px solid var(--accent)" : "2px solid transparent", outlineOffset: 2 }}
      >
        <Avatar url={profile?.avatar_url} initial={initial} size={36} />
      </button>

      {open && (
        <div className="absolute right-0 top-[46px] z-50 w-[244px] rounded-[14px] border border-line bg-surface vp-pop overflow-hidden" style={{ boxShadow: "0 18px 44px -18px rgba(0,0,0,.4)" }} role="menu">
          <div className="px-3.5 py-3 border-b border-line flex items-center gap-2.5">
            <Avatar url={profile?.avatar_url} initial={initial} size={38} />
            <div className="min-w-0">
              <div className="font-semibold text-[13.5px] text-ink truncate">{profile?.full_name || "Your account"}</div>
              <div className="text-[12px] text-muted truncate">{email}</div>
            </div>
          </div>
          <div className="p-1.5">
            <MenuItem icon={User} label="Profile" onClick={() => go(nav.goProfile)} />
            <MenuItem icon={Settings} label="Settings" onClick={() => go(nav.goSettings)} />
          </div>
          <div className="p-1.5 border-t border-line">
            <MenuItem icon={LogOut} label="Log out" danger onClick={() => go(() => actions.signOut())} />
          </div>
        </div>
      )}
    </div>
  );
}
