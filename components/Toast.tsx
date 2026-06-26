"use client";

import { useTrip } from "@/lib/store";
import { Check } from "./icons";

export function Toast() {
  const { state } = useTrip();
  if (!state.toast) return null;
  return (
    <div
      className="fixed bottom-[26px] left-1/2 -translate-x-1/2 z-[80] bg-ink text-white px-5 py-3.5 rounded-[14px] flex items-center gap-[11px] text-[14px] font-medium vp-pop"
      style={{ boxShadow: "0 16px 40px -10px rgba(0,0,0,.5)" }}
    >
      <span className="w-[26px] h-[26px] rounded-full bg-accent grid place-items-center">
        <Check size={14} strokeWidth={2.5} />
      </span>
      {state.toast}
    </div>
  );
}
