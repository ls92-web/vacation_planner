// ===== Theme catalogue. Colours live in globals.css ([data-theme="…"]);
// this is the metadata + the helper that applies a theme globally.
//
// Four palettes over ONE design system — only colour tokens change between
// themes; typography, spacing, shapes, icons, layout and motion are identical. =====

export type ThemeId = "formal" | "girlie" | "funky" | "modern";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  tagline: string;
}

export const DEFAULT_THEME: ThemeId = "formal";

export const THEME_OPTIONS: ThemeOption[] = [
  { id: "formal", name: "Formal", tagline: "Deep navy, warm gold & ivory" },
  { id: "girlie", name: "Girlie", tagline: "Blush, dusty rose & lavender" },
  { id: "funky", name: "Funky", tagline: "Teal, coral & golden yellow" },
  { id: "modern", name: "Modern", tagline: "White, charcoal & sage" },
];

const IDS = new Set(THEME_OPTIONS.map((t) => t.id));

// Graceful migration from the previous theme ids so saved preferences still resolve.
const ALIASES: Record<string, ThemeId> = { classic: "formal", desert: "formal", minimal: "modern" };

export function normalizeTheme(value?: string | null): ThemeId {
  if (value && IDS.has(value as ThemeId)) return value as ThemeId;
  if (value && ALIASES[value]) return ALIASES[value];
  return DEFAULT_THEME;
}

/** Apply a theme to the whole document (used for live preview + on load). */
export function applyThemeToDocument(value?: string | null): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", normalizeTheme(value));
}
