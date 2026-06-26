# Wanderfold — AI Vacation Planner

A faithful implementation of the **Vacation Planner** (`Vacation Planner.dc.html`) design handoff:
a family-oriented, AI-assisted multi-destination trip planner.

Flow: **Sign in → Route builder → Explore & build → (Create My Schedule) → Generating → Itinerary**

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** — design tokens exposed as CSS variables (`bg-accent`, `text-ink`, `border-line`, `font-display`…)
- **lucide-react** — all icons (no emojis, per the handoff)
- Google Fonts via `next/font`: **Bricolage Grotesque** (display), **Plus Jakarta Sans** (body), **Spline Sans Mono** (captions)

## Scope

This is the **faithful UI build with mock data**. All five screens are recreated pixel-faithfully with
the prototype's mock data and *simulated* AI (timed transitions, canned insights and replies) — exactly
as the design prototype behaved. There is no live backend yet.

The PRD targets **Next.js 16 + Supabase + OpenRouter**. The code is structured so those drop in cleanly:
everything data-related lives in [`lib/data.ts`](lib/data.ts) and the pure helpers / `replyFor` / `recommend`
functions there are the seams to replace with Supabase queries, geocoding/Mapbox calls, and OpenRouter
completions.

## Project structure

```
app/
  layout.tsx        # fonts + metadata
  globals.css       # theme tokens (Ocean/Sunset/Forest), keyframes, scrollbar
  page.tsx          # renders <App/>
components/
  App.tsx           # provider + screen router + theme wrapper
  AppNav.tsx        # shared segmented nav pill group + Brand
  Toast.tsx         # bottom-center toast
  ThemeSwitcher.tsx # palette switcher (Ocean default)
  icons.tsx         # lucide-react registry + dynamic icon maps
  screens/
    Auth.tsx
    RouteBuilder.tsx
    Explore.tsx     # Explore / Saved / Map / AI Planner sub-tabs
    Generating.tsx
    Itinerary.tsx   # Schedule / Map / Assistant sub-tabs
lib/
  types.ts          # domain types
  data.ts           # mock data + pure helpers (the backend seams)
  store.tsx         # React context store mirroring the prototype's state + actions
```

## Develop

```bash
npm run dev     # http://localhost:3000
npm run build   # production build + typecheck + lint
```

## Implemented features

- **Auth** — split brand/form panel, sign-in/sign-up toggle, focus rings.
- **Route builder** — vertical timeline, trip overview, progressive-disclosure destination cards,
  accommodations (type segmented control, auto-calculated nights, geocoding status, validation states),
  AI-suggested transport connectors (with recompute shimmer), HTML5 drag-and-drop reorder, sticky CTA.
- **Explore** — debounced search, single-select categories, multi-select smart filters, AI-curated banner,
  attraction/restaurant cards with AI score, save heart, expandable "Why AI recommends this",
  add-to-trip toggle + toast.
- **Saved / Map / AI Planner** — hearted grid, stylized interactive map with numbered pins + popups,
  selected-list with Must/Optional toggles + drag reorder, live AI insight cards.
- **Generating** — 5-step progress transition that auto-advances.
- **Itinerary** — Schedule timeline (km/mi toggle, day selector, day theme, travel-to-next),
  Map (route polyline + pins + side list), Assistant chat (typing indicator, suggested prompts,
  contextual replies), Export toast.
- **Theming** — Ocean (default), Sunset, Forest via the floating switcher.
