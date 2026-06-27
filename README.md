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

All five screens are recreated pixel-faithfully with the prototype's mock data. **AI is powered by
OpenRouter** (see below); every AI feature falls back to the built-in simulated behavior when no key
is configured, so the app always works. Supabase (auth + persistence) is the remaining PRD piece —
the mock data in [`lib/data.ts`](lib/data.ts) is the seam for those queries.

## AI provider (OpenRouter)

All AI runs through OpenRouter and is driven entirely by environment variables — **no model name is
hardcoded anywhere in the code**.

```bash
cp .env.example .env.local      # then paste your key
# OPENROUTER_API_KEY=sk-or-v1-...
# OPENROUTER_MODEL=qwen/qwen3-next-80b-a3b-instruct:free   # the default free Qwen 3
```

- **Swap models with one env change** — set `OPENROUTER_MODEL` to any OpenRouter id
  (`anthropic/claude-3.7-sonnet`, `openai/gpt-5`, `google/gemini-2.5-pro`, …). No code changes.
- **Shared service** — [`lib/ai/`](lib/ai) is the single place all OpenRouter requests go through:
  - `client.ts` — OpenRouter client: base URL `https://openrouter.ai/api/v1`, streaming, retry with
    backoff on transient failures (`429`/`5xx`/network), graceful error types, dev logging,
    attribution headers.
  - `provider.ts` — provider abstraction (`ChatProvider`) so a non-OpenRouter provider can be added later.
  - `service.ts` — the four domain features: travel assistant (streaming), itinerary generation,
    recommendations, planning insights.
- **Server-only** — the key never reaches the browser. Features call Next.js route handlers under
  [`app/api/ai/*`](app/api/ai), which call the shared service.
- **Every AI feature uses it**:
  - Travel **assistant** chat → streamed live (`/api/ai/assistant`).
  - **Itinerary generation** during the Generating screen → `/api/ai/itinerary`.
  - **Recommendations** (AI fit scores / ranking on Explore) → `/api/ai/recommendations`.
  - Planning **insights** (AI Planner panel) → `/api/ai/insights`.
- **Resilient** — without a key (or on any model/network error) each feature silently falls back to the
  built-in heuristic/canned behavior; the UI is never blocked.

## Google Maps Platform

Maps are integrated through a modular service layer built on **`@vis.gl/react-google-maps`**. Like the
AI layer, it is **fully optional** — without a key the app uses the original stylized fallback map, so
nothing breaks.

```bash
# .env.local
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=        # enable Maps JS, Places (New), Routes, Geocoding
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=DEMO_MAP_ID
```

**Directions are external, not computed in-app.** The app uses Maps for *display* and Places for *discovery*;
it does not call the Directions/Routes APIs at runtime. Instead it builds **"Open in Google Maps"** links so
users get turn-by-turn directions in Google Maps itself (a single place, or a full day as
origin → waypoints → destination). In-app route calculation stays in the codebase as a **dormant premium
seam** ([`routes-client`](lib/maps/routes-client.ts), [`/api/maps/routes`](app/api/maps/routes),
`<RoutePlanner>`/`<DirectionsOverlay>`) — wired off, ready to enable later.

- **Service layer** — [`lib/maps/`](lib/maps): `config` (env, `isMapsConfigured()`), `cache` (TTL +
  in-flight de-dup), `categories` (Places types + marker styles), `links` (Google Maps URL builders),
  `coords` (seed lat/lng), and `hooks` (`usePlacesSearch`, `useGeocode`, `useAutocomplete` — debounced 300ms).
- **Reusable components** — [`components/maps/`](components/maps): `<MapsApiProvider>` (lazy-loads the
  script per map screen), `<GoogleMap>` (smooth re-center, zoom controls, skeleton, error + fallback),
  `<DestinationMarkers>` / `<HotelMarkers>` / `<PlaceMarkers>` (Advanced Markers, per-kind styling),
  `<MapInfoCard>`, `<PlacesExplorer>`, `<MapSearch>`, `<OpenInMapsButton>`.
- **Where it's wired**:
  - **Itinerary → Map / Schedule**: display-only markers + info cards; an **"Open in Google Maps"** link per
    stop and a multi-stop **"Directions for this day"** link (origin → waypoints → destination).
  - **Explore → Map**: destination + selected-place + geocoded hotel markers, info cards, plus a **Places**
    panel to browse & add nearby spots. Each place card has an **"Open in Google Maps"** link.
  - **Route builder**: address **autocomplete** for accommodations + an **"Open in Google Maps"** link per stay.
  - **AI**: the assistant context includes place coordinates + map-added places, so it can reason about
    proximity, nearby recommendations, and efficient ordering.
- **Performance**: script lazy-loads only on map screens; Places/Geocoding results are cached and
  de-duplicated; autocomplete is debounced; failures degrade gracefully to the stylized fallback map.
- **Future-ready**: enable the dormant routing seam for in-app polylines/ETAs, or add traffic,
  transit/walking/cycling routes, weather/crowd overlays, or AI-generated sightseeing routes — the
  `<GoogleMap>` context + category/library maps mean screens don't change.

## Project structure

```
app/
  layout.tsx        # fonts + metadata
  globals.css       # theme tokens (Ocean/Sunset/Forest), keyframes, scrollbar
  page.tsx          # renders <App/>
  api/ai/           # route handlers: assistant, itinerary, recommendations, insights
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
  ai-client.ts      # browser helpers that call the /api/ai routes (with fallback)
  ai/               # shared AI service (OpenRouter): client, provider, prompts, service
  maps/             # Google Maps service: config, hooks, cache, routes, coords, categories
components/maps/     # GoogleMap, markers, InfoCard, RoutePlanner, PlacesExplorer, MapSearch, …
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
