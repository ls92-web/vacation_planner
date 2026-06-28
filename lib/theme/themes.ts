// ===== Theme catalogue. Colours live in globals.css ([data-theme="…"]);
// this is the metadata + the helper that applies a theme globally. =====

export type ThemeId = "classic" | "desert" | "minimal";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  tagline: string;
}

export const DEFAULT_THEME: ThemeId = "classic";

export const THEME_OPTIONS: ThemeOption[] = [
  { id: "classic", name: "Classic Luxury", tagline: "Ivory, deep navy & soft gold" },
  { id: "desert", name: "Desert Luxe", tagline: "Warm sand, terracotta & olive" },
  { id: "minimal", name: "Modern Minimal", tagline: "Clean white, charcoal & sage" },
];

const IDS = new Set(THEME_OPTIONS.map((t) => t.id));

export function normalizeTheme(value?: string | null): ThemeId {
  return value && IDS.has(value as ThemeId) ? (value as ThemeId) : DEFAULT_THEME;
}

/** Apply a theme to the whole document (used for live preview + on load). */
export function applyThemeToDocument(value?: string | null): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", normalizeTheme(value));
}
