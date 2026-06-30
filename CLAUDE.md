@AGENTS.md

# Itinera — project context

## Project overview
Itinera is a premium AI-assisted travel planner. Users sign in, create trips, pick countries/cities, build a multi-destination route (dates, hotels, budget, weather), browse real attractions per destination, and get a destination-grouped day-by-day itinerary they can export as a luxury PDF guide. Tagline: "Every journey, perfectly planned."

## Product vision
This is **not** a fixed itinerary generator — it is an AI planner for completely personalized, multi-destination trips. The product is built around these principles:
- Unlimited destinations · multiple hotels per destination
- AI-assisted attraction discovery · AI itinerary generation
- Drag-and-drop planning · weather-aware scheduling
- Budget estimation (live currency) · restaurant discovery
- PDF itinerary export · Google Maps deep links instead of in-app navigation
- Premium AI travel assistant

## Stable architectural decisions
Do **not** change these unless the user explicitly asks:
- Sidebar navigation is permanent.
- Fonts: **Outfit** (UI) and **DM Serif Display** (branding). No emojis.
- Premium UI style throughout.
- Multiple destinations per trip; multiple hotels per destination.
- Itinerary is grouped by destination.
- Export luxury PDF itineraries.
- Google Maps opens externally (no in-app navigation).
- OpenRouter powers AI features.
- Supabase stores only user-selected places, never world datasets.
- **Never render sample/demo destinations inside a user's trip.** While a trip's plan is loading, show a skeleton; if it has no destinations, show the empty state. Sample routes belong only to an explicit demo mode.

## Architecture
- **Stack:** Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind CSS v4 (CSS-variable tokens). Icons: `lucide-react`. No router — a single page (`app/page.tsx` → `components/App.tsx`) swaps "screens" via `TripProvider.state.screen`.
- **No Next.js API routes — all server logic runs as Supabase Edge Functions** (Deno), deployed via the Supabase MCP `deploy_edge_function` (not in this repo's source tree). The browser calls them through `lib/edge.ts` (`callFn(name, body)` → `${SUPABASE_URL}/functions/v1/<name>`, attaching the session token / anon key). Functions: `fx`, `geo-countries`, `geo-cities`, `geo-geocode`, `geo-city-image`, `geo-weather`, `username-login`, `maps-routes`, `ai` (one function, action-routed: itinerary/insights/recommendations/assistant-stream). All deployed with `verify_jwt=false` and handle CORS + auth in-function (so the preflight isn't blocked).
- **External services:** Supabase (auth + Postgres + Storage + Edge Functions), OpenRouter (AI, env-driven model), Google Maps/Places (`@vis.gl/react-google-maps`), plus keyless geo APIs (Open-Meteo, Wikipedia, GeoNames optional) and live FX (open.er-api.com) — all now reached via the edge functions above. Everything degrades gracefully if a key/service is missing (curated/localStorage/static-rate fallback).
- **State:** React Context providers nested in `App.tsx`: `AuthProvider › AuthGate › UIProvider › TripsProvider › TripProvider › AppShell`; `PlannerProvider` wraps the Explore screen. Cross-cutting signals use tiny **module-level pub/sub** stores (not context): `lib/ui/saveStatus`, `lib/ui/account`, `lib/ui/unsavedGuard`.
- **Data layer (Supabase, all owner-only RLS `user_id = auth.uid()`):**
  - `profiles` — full_name, username, country, avatar_url, language, timezone, password_changed_at, onboarded
  - `user_preferences` — pace, transport, travelers, family_friendly, with_children, children_ages, **currency** (default KWD), **theme** (default classic), distance_unit, temperature_unit, travel_style, accommodation, food_pref, accessibility, export_*
  - `trips` — name, destination, budget_level, start_date, end_date, **transports** (jsonb: chosen travel mode per inter-city leg, keyed `"fromCity|toCity"`), **preferences** (jsonb: per-trip traveller prefs — travellerType, ages, travelStyle, interests[], accessibility[]; drives personalized place ranking/badges + suggestion tips, NOT account settings. See `lib/trips/preferences.ts` + `lib/places/personalize.ts`)
  - `destinations` — trip_id, name, country, country_code, lat, lng, image_url, arrive, depart, budget_override, position
  - `accommodations` — trip_id, destination_id, type, name, address, checkin, checkout, confirmation, notes, location_url, position
  - `schedule_items` — trip_id, **destination** (= itinerary item's destId/city), day, slot, position, duration_min, data(jsonb place)
  - `saved_places` — trip_id, destination, place_id, data(jsonb)
  - `schedules`, `itinerary_exports` — **reserved** for export history + itinerary versioning (intentionally unused for now; keep, don't drop)
  - Triggers: `handle_new_user` (provisions profile+prefs from signup metadata), `itinera_auto_confirm` (auto-confirms email on signup), `set_updated_at`. RPCs: `get_email_for_username`, `username_available`, `delete_my_account`. Storage bucket `avatars` (public read, owner write). Supabase project id: `nscjjeowzitdthaynlxx`. (Authentication is Supabase Auth — no credentials live in this file.)

## Project map (important files; one line each)
```
app/page.tsx                      Entry → <App/>
app/layout.tsx                    Fonts: Outfit (UI) + DM Serif Display (branding) + Spline mono, metadata
app/globals.css                   Tailwind + theme tokens ([data-theme=formal|girlie|funky|modern]), font vars, keyframes, print CSS
(no app/api — server logic lives in Supabase Edge Functions; see lib/edge.ts)
lib/edge.ts                       Client helper: callFn(name, body) → Supabase Edge Function (+ session token)
Edge Functions (in Supabase, deployed via MCP): fx · geo-countries · geo-cities · geo-geocode · geo-city-image · geo-weather · username-login · maps-routes · ai

components/App.tsx                 Provider nesting + screen switch (dashboard/trips/form/explore/generating/plan/saved/profile/settings); default screen = dashboard
components/screens/Dashboard.tsx                 Home/overview: greeting, stat tiles, continue/active trip, recent trips, quick actions
components/screens/SavedPlaces.tsx               Saved attractions across all trips (grouped by trip→destination) with Open-in-Maps
components/shell/{AppShell,Sidebar,TopBar}.tsx  Shell: grouped sidebar, breadcrumb+save-status, mounts UnsavedChangesDialog; wraps screens in ErrorBoundary
components/trips/TripsDashboard.tsx             Trips grid + New Trip modal (DestinationPicker)
components/screens/RouteBuilder.tsx             "Plan your route": destination cards (dates/hotels/budget/weather), travel connectors, auto-save
components/screens/Generating.tsx, Itinerary.tsx  Loading screen; legacy single-itinerary screen
components/explore/ExploreExperience.tsx        Explore+Plan: per-destination attraction browsing (PlannerProvider)
components/explore/DestinationItinerary.tsx     Destination-grouped plan: nav, collapsible sections, travel cards, per-day AI analysis
components/explore/{DayAnalysis,DaySummary,NearbyOpportunities}.tsx  AI day-score panels + per-destination Places suggestions
components/explore/PlaceCard.tsx, ExploreMap.tsx, CategoryRail/FilterBar/CompareTray  Attraction UI
components/destinations/DestinationPicker.tsx   Country→cities picker (popular, manual entry, validation, reorder)
components/destinations/CityImage.tsx           City photo w/ deep-ink fallback; BudgetPanel/WeatherPanel = detail chips
components/account/{ProfilePage,SettingsPage,ui}.tsx  Profile (identity/security) + Settings (prefs); independent-save cards
components/auth/{AuthScreen,Onboarding,AuthGate,AccountButton}.tsx  Auth flow + top-bar account menu
components/theme/{ThemeApplier,ThemePicker}.tsx Apply <html data-theme> from prefs; 4 mini-app preview cards
components/export/{ExportButton,ItineraryBook,templates}.tsx  Per-destination luxury PDF guide
components/Logo.tsx, icons.tsx, Toast.tsx, ui/UnsavedChangesDialog.tsx, ui/ErrorBoundary.tsx (contains screen crashes; auto-reloads once on stale-deploy ChunkLoadError)
app/global-error.tsx               Branded last-resort fallback for root-layout crashes

lib/store.tsx                     TripProvider: screen nav (routed through unsavedGuard), destinations, budget level
lib/types.ts                      Core domain types (Screen, Destination, Accommodation, ItineraryItem…)
lib/auth/store.tsx                AuthProvider: session/profile/prefs, signUp(auto-signin), changeEmail, uploadAvatar…
lib/trips/store.tsx               TripsProvider: trip list + active trip
lib/ui/store.tsx                  UIProvider: sidebar collapse
lib/ui/{saveStatus,account,unsavedGuard,useUnsavedChanges}.ts  Module signals + unsaved-changes guard
lib/planner/store.tsx             PlannerProvider: per-destination itinerary (destId+day), favorites, focusDestination
lib/planner/{travel,dayAnalysis}.ts  Timeline/route math; per-day analysis
lib/destinations/repository.ts    saveTrip/loadTrip (destinations+accoms+budget+transports), serialized+coalesced
lib/itinerary/repository.ts       Favorites + schedule_items persistence (destId via `destination` col); listAllSaved() aggregates saved places across trips for the Saved Places page
lib/budget/{estimate,useCurrency,rates}.ts  Budget breakdown + CURRENCIES (EUR base → display, default KWD; GCC+EUR+USD) + live FX loader
lib/geo/*                         Countries/cities/geocode/cityImage/weather loaders + cache + popular + validation
lib/weather/{client,codes}.ts     useWeather hook + WMO code→icon
lib/maps/*                        Google Maps service layer (GoogleMap, markers, links, geocode hooks); routes-client dormant
lib/places/*                      Explore place types, Google Places search (usePlaces), curated fallback
lib/ai/*, lib/ai-client.ts        OpenRouter service (streaming, retries) + client helpers
lib/data.ts                       Static seed data: destination coords, transport templates, thumbnails
lib/supabase/client.ts            Supabase singleton (on globalThis, HMR-safe)
```

## Key decisions
- **No router; screen state.** Navigation = `TripProvider.state.screen`; all screen changes go through `unsavedGuard.requestNavigation()` so editable pages can prompt before discarding edits.
- **Module pub/sub for cross-cutting signals** (save status, account menu, unsaved guard) — avoids prop-drilling/context churn.
- **Geo data is API-driven, never stored wholesale.** Only the user's *selected* destinations are persisted. Countries come from the `world-countries` npm package (REST Countries v3.1 was deprecated mid-build). All geo lookups cached in memory + localStorage (`lib/geo/cache`).
- **Itinerary is grouped by destination** (`ItineraryItem.destId` = city name), with continuous global day numbering and auto travel cards between cities. This is the foundation for all itinerary generation. Attractions stay in the city they were browsed in.
- **Full trip plan persists** via `saveTrip/loadTrip`; saves are **serialized + coalesced per trip** (delete+insert) to prevent duplicate rows from overlapping auto-save + explicit save.
- **Everything the user enters persists per-account and reloads (project rule).** Profile + personal info (`profiles`), settings/preferences (`user_preferences`), trips (`trips`), full plan — destinations, hotels, dates, budget level + overrides, **and travel modes** (`destinations`/`accommodations`/`trips.transports`), the day-by-day schedule (`schedule_items`), and saved places (`saved_places`) all save to Supabase under the owner's `user_id` and rehydrate when they return. No user-entered value may live only in React/in-memory state. When adding new user-editable state: persist it via a `lib/*/repository.ts` and restore it in the matching load/hydrate path; if it's keyed, the key must be **stable across reloads** (e.g. travel modes are keyed by city name, never by the ephemeral destination `id`).
- **Loads fail loud, never empty (project rule).** `loadTrip` retries `getSession()` before giving up (a not-yet-hydrated session is not "signed out") and **throws `TripLoadError`** on auth/DB failure instead of returning an empty plan — so a transient hiccup surfaces as a retryable "Couldn't load — Retry" state (`tripLoadError`), never as silent data loss. A genuinely empty trip (query OK, zero rows) still returns empty. Both "open trip" and Retry go through one path: `useTripLoader()`. **Critically, auto-save must never run while `tripLoading || tripLoadError`** — those states hold an intentionally empty `destinations: []`, and saving it would wipe the user's saved plan (`useAutoSaveRoute` guards on this).
- **No sample data in a real trip (project rule).** The store starts with `destinations: []` (no demo content). Opening a trip calls `beginTripLoad()` (sets `tripLoading`, clears any prior plan) → shows a **skeleton** → `hydrateTrip(list)` reflects exactly what loaded; an empty list yields the **empty state**, never sample destinations. `hydrateTrip` must never fall back to `s.destinations`. `INITIAL_DESTINATIONS` in `lib/data.ts` is reserved for a future explicit demo mode only — never wire it into trip state.
- **Currency:** budget rates are EUR internally and converted for display (default **KWD**); options limited to GCC + EUR + USD; manual overrides stored in the base unit. Conversion uses **live FX** (`/api/fx` → `lib/budget/rates.ts`, cached 12h via localStorage), overriding the static reference rates in `estimate.ts` — which remain only as a fallback. `useCurrency()` substitutes the live rate transparently.
- **Theming:** ONE design system, **four colour identities** — `formal` (default · navy/gold/ivory), `girlie` (blush/rose/lavender), `funky` (teal/coral/gold), `modern` (white/charcoal/sage). Only the colour tokens change per `[data-theme]` on `<html>`; typography, spacing, shapes, icons, layout and motion are identical across themes. Defined in `globals.css`; metadata + `normalizeTheme` (with aliases from the old classic/desert/minimal ids) in `lib/theme/themes.ts`; persisted in prefs (`user_preferences.theme`, default `formal`). The picker renders 4 mini-app previews. When adding a theme: add a `[data-theme]` token block + a `THEME_OPTIONS` entry — never restyle components per theme.
- **Auth:** email is auto-confirmed (DB trigger) and signup auto-signs-in; the splash can never hang (timeouts + globalThis Supabase singleton). The no-auth localStorage fallback is **dev-only** — in production a missing Supabase config shows a config notice, never the app (so a misconfigured deploy can't look "logged in"). **`NEXT_PUBLIC_*` are build-time** — they must be set when the deployment builds. Sign-out lives in the **sidebar footer** (and the top-bar account menu), routed through the unsaved-changes guard. **Saving profile/preferences refreshes silently** (`loadProfile(uid, { silent: true })`): a normal refresh would flip `profileLoaded` → `AuthGate` shows the splash → the whole app remounts, bouncing the user off Profile/Settings and dropping the "Saved" toast. Any post-save profile reload must stay silent.
- **Account forms (Profile/Settings) UX:** each editable card uses `SettingCard` (Save disabled until dirty, secondary **Reset changes**, success **toast** via `flash`); `PageHeader dirty` shows a "You have unsaved changes" pill; `useUnsavedChanges(dirty)` drives the discard-guard dialog. Reuse this pattern for any future editable form.
- **In-app routing for directions is disabled** (Google key is referrer-restricted) → "Open in Google Maps" links; Routes proxy/RoutePlanner kept as a dormant premium seam.

## Conventions
- **Standing rule:** commit + push every change to `origin/main`, with trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. **Never** commit `.env.local` (secrets); `.env.example` documents all vars.
- **Verify in the browser** with the Claude_Preview tools after observable changes; check the console. Turbopack dev sometimes shows **stale** "export X doesn't exist" errors mid-edit — the production `npm run build` is the source of truth; `rm -rf .next` + restart the dev server to clear them.
- **Styling:** Tailwind v4 with CSS-var tokens only — `bg-accent text-ink border-line bg-tint`, `var(--brand-deep)` for deep surfaces. **No emojis**; use `lucide-react`. UI = `font-body`/`font-display` (Outfit); serif branding/wordmark = `font-brand` (DM Serif Display). Font tokens are defined in `app/globals.css @theme`; `next/font` loads them in `app/layout.tsx`. (Changing fonts or `@theme` needs a dev-server restart — `rm -rf .next` — to flush Turbopack's font CSS.)
- **Money:** always `formatMoney(amountEUR, currency)` from `lib/budget/estimate`, with `currency` from `useCurrency()` (live FX); never hardcode a symbol or a rate.
- **Persistence:** put it in a `lib/*/repository.ts`; per-user owner-RLS table + localStorage fallback; DB changes via the Supabase MCP `apply_migration`.
- **Async store actions:** use the `stateRef.current` pattern (see `lib/planner/store.tsx`) to avoid stale closures.
- **Editable forms:** call `useUnsavedChanges(dirty)` and route navigation through the store actions so the discard guard works automatically.

## Security posture
- **AI is gated in the `ai` edge function.** It verifies the caller's JWT is a real user (calls `/auth/v1/user`; the anon key is rejected), per-user in-memory rate limit, message caps, generic errors. **OpenRouter key/model are Edge Function secrets** (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) set in Supabase — never on the client. Without them the function returns 503 and the app falls back to built-in behavior.
- **Edge Function secrets (set in Supabase dashboard → Edge Functions → Secrets):** `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` (AI), optional `GEONAMES_USERNAME` (geo-cities), optional `GOOGLE_MAPS_SERVER_API_KEY` (maps-routes). `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are auto-injected. The browser-side `NEXT_PUBLIC_*` (Supabase URL/anon, Google Maps JS key) still belong on Vercel.
- **RLS is owner-only** on all live tables (`trips`/`destinations`/`accommodations`/`schedule_items`/`saved_places`/`profiles`/`user_preferences`). Legacy `favorites`/`itinerary_items` are **locked (default-deny)** — kept for now, not used; drop when convenient. The `avatars` bucket serves via public URL with **no listing policy**.
- **Run the linters after DB/auth changes:** Supabase MCP `get_advisors` (security + performance) and `npm audit`. Don't `npm audit fix --force` (it tries to downgrade Next).
- **Username login is server-side** in the `username-login` edge function: resolves username→email with the auto-injected **service-role key**, verifies the password, returns only session tokens (client calls `setSession`). `get_email_for_username` EXECUTE is **revoked from anon/authenticated** (granted to `service_role` only), so the browser can't enumerate username→email. Failures return one generic message; rate-limited per IP + username.
- **Known/accepted:** `username_available` stays anon-callable (needed for live signup validation; reveals only whether a username is taken, no email). **Manual dashboard steps (not code):** enable Auth → *Leaked password protection* (HIBP) and set the min password length to 12 (the client already enforces 12).
- **MCP is full-admin** and bypasses RLS/app guards — prefer `SELECT` before `DELETE`.

## Current state & next steps
**Working:** auth + onboarding; trips dashboard; route builder (multi-destination, dates, hotels w/ location links, per-destination budget + weather, fully persisted); country→city picker; per-destination attraction browsing; destination-grouped itinerary with **per-day AI analysis** (DaySummary score strip + expandable DayAnalysis with recommendations/warnings + per-destination NearbyOpportunities); luxury per-destination PDF export; Profile + Settings pages; 3-theme selector; live-FX currency (KWD/GCC); unsaved-changes route protection.

**In progress / next:**
- Drag-and-drop reordering of stops within a day (store has `replaceItinerary`/`moveItemToDay`; UI not wired yet).
- Weather-aware scoring in the AI day analysis (currently "Weather: not connected").
- Real weather/activity counts on route-builder cards (some are estimates/placeholders).
- Full AI Assistant chat (currently a button/flash).
- Optional: set `GEONAMES_USERNAME` for "popular cities by population" (else capital + typed search).
- `lib/maps` Routes/Directions seam stays **dormant** (future premium in-app navigation); `schedules`/`itinerary_exports` tables stay reserved.
