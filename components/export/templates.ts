// ===== Export book templates — themed variants of one premium layout. =====

export interface BookTemplate {
  key: string;
  name: string;
  blurb: string;
  page: string; // page background
  fg: string; // primary text
  muted: string; // secondary text
  accent: string; // rules, labels
  surface: string; // card background
  line: string; // borders
  coverBg: string; // cover background (can be gradient)
  coverFg: string; // cover text
  titleClass: string; // typography treatment for big titles
  uppercaseLabels: boolean;
}

export const TEMPLATES: BookTemplate[] = [
  {
    key: "luxury",
    name: "Luxury Magazine",
    blurb: "Editorial spreads, gold rules, generous whitespace.",
    page: "#fbf9f4", fg: "#221c16", muted: "#8a7f72", accent: "#a9853f", surface: "#ffffff", line: "#e7ded0",
    coverBg: "linear-gradient(160deg,#2a2520,#4a3f33)", coverFg: "#f6efe2",
    titleClass: "font-display tracking-[-.02em]", uppercaseLabels: true,
  },
  {
    key: "explorer",
    name: "Modern Explorer",
    blurb: "Clean, contemporary, map-forward.",
    page: "#ffffff", fg: "#1d2422", muted: "#6c7b76", accent: "#16767e", surface: "#f6faf9", line: "#e3ece9",
    coverBg: "linear-gradient(155deg,#16767e,#0f4a50)", coverFg: "#eafaf8",
    titleClass: "font-display tracking-[-.02em]", uppercaseLabels: false,
  },
  {
    key: "family",
    name: "Family Vacation",
    blurb: "Warm, friendly, easy to read together.",
    page: "#fdf7f1", fg: "#2a2018", muted: "#917d6b", accent: "#e07a4f", surface: "#ffffff", line: "#f0e2d4",
    coverBg: "linear-gradient(155deg,#e07a4f,#c2554a)", coverFg: "#fff4ec",
    titleClass: "font-display", uppercaseLabels: false,
  },
  {
    key: "minimal",
    name: "Minimal Professional",
    blurb: "Black, white, and quiet typography.",
    page: "#ffffff", fg: "#111111", muted: "#777777", accent: "#111111", surface: "#fafafa", line: "#e6e6e6",
    coverBg: "#111111", coverFg: "#ffffff",
    titleClass: "font-display tracking-[-.03em]", uppercaseLabels: true,
  },
  {
    key: "adventure",
    name: "Adventure Journal",
    blurb: "Bold headers, field-notes energy.",
    page: "#f4f1e9", fg: "#23271f", muted: "#73786a", accent: "#3f7a5a", surface: "#fbfaf5", line: "#e0ddcf",
    coverBg: "linear-gradient(160deg,#3f7a5a,#27402f)", coverFg: "#eef6ef",
    titleClass: "font-display uppercase tracking-[.02em]", uppercaseLabels: true,
  },
  {
    key: "dark",
    name: "Elegant Dark",
    blurb: "Refined dark theme for screens & print.",
    page: "#16140f", fg: "#f2ece0", muted: "#9a9183", accent: "#cda86a", surface: "#211e17", line: "#322d23",
    coverBg: "linear-gradient(160deg,#211e17,#0d0c09)", coverFg: "#f2ece0",
    titleClass: "font-display tracking-[-.01em]", uppercaseLabels: true,
  },
];

export const templateByKey = (key: string): BookTemplate => TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0];
