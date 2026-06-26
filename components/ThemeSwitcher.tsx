"use client";

import { useTrip } from "@/lib/store";
import type { ThemeName } from "@/lib/types";
import { THEMES } from "@/lib/data";

const NAMES: ThemeName[] = ["Ocean", "Sunset", "Forest"];

/** Small floating control to demo the re-themable palette (Ocean default). */
export function ThemeSwitcher() {
  const { state, actions } = useTrip();
  return (
    <div
      className="fixed bottom-[22px] left-[22px] z-[70] flex items-center gap-2 bg-surface/90 border border-line rounded-full px-2.5 py-2 backdrop-blur"
      style={{ boxShadow: "0 8px 24px -12px rgba(0,0,0,.3)" }}
      title="Switch palette"
    >
      {NAMES.map((n) => {
        const on = state.theme === n;
        return (
          <button
            key={n}
            onClick={() => actions.setTheme(n)}
            title={n}
            aria-label={n}
            className="w-6 h-6 rounded-full cursor-pointer transition"
            style={{
              background: THEMES[n].accent,
              outline: on ? "2px solid var(--ink)" : "2px solid transparent",
              outlineOffset: 2,
            }}
          />
        );
      })}
    </div>
  );
}
