@AGENTS.md

# Itinera — project context

## Project overview
Itinera is a premium AI-assisted travel planner. Users sign in, create trips, pick countries/cities, build a multi-destination route (dates, hotels, budget, weather), browse real attractions per destination, and get a destination-grouped day-by-day itinerary they can export as a luxury PDF guide. Tagline: "Every journey, perfectly planned."

## Architecture
- **Stack:** Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind CSS v4 (CSS-variable tokens). Icons: `lucide-react`. No router — a single page (`app/page.tsx` → `components/App.tsx`) swaps "screens" via `TripProvider.state.screen`.
- **External services:** Supabase (auth + Postgres + Storage), OpenRouter (AI, env-driven model), Google Maps/Places (`@vis.gl/react-google-maps`), plus keyless geo APIs (Open-Meteo, Wikipedia, GeoNames optional) proxied through `app/api/geo/*`. Everything degrades gracefully if a key is missing (curated/localStorage fallback).
- **State:** React Context providers nested in `App.tsx`: `AuthProvider › AuthGate › UIProvider › TripsProvider › TripProvider › AppShell`; `PlannerProvider` wraps the Explore screen. Cross-cutting signals use tiny **module-level pub/sub** stores (not context): `lib/ui/saveStatus`, `lib/ui/account`, `lib/ui/unsavedGuard`.
- **Data layer (Supabase, all owner-only RLS `user_id = auth.uid()`):**
  - `profiles` — full_name, username, country, avatar_url, language, timezone, password_changed_at, onboarded
  - `user_preferences` — pace, transport, travelers, family_friendly, with_children, children_ages, **currency** (default KWD), **theme** (default classic), distance_unit, temperature_unit, travel_style, accommodation, food_pref, accessibility, export_*
  - `trips` — name, destination, budget_level
  - `destinations` — trip_id, name, country, country_code, lat, lng, image_url, arrive, depart, budget_override, position
  - `accommodations` — trip_id, destination_id, type, name, address, checkin, checkout, confirmation, notes, location_url, position
  - `schedule_items` — trip_id, **destination** (= itinerary item's destId/city), day, slot, position, duration_min, data(jsonb place)
  - `saved_places` — trip_id, destination, place_id, data(jsonb)
  - `schedules`, `itinerary_exports` — exist but currently unused
  - Triggers: `handle_new_user` (provisions profile+prefs from signup metadata), `itinera_auto_confirm` (auto-confirms email on signup), `set_updated_at`. RPCs: `get_email_for_username`, `username_available`, `delete_my_account`. Storage bucket `avatars` (public read, owner write). Supabase project id: `nscjjeowzitdthaynlxx`.

## Project map (important files; one line each)
```
app/page.tsx                      Entry → <App/>
app/layout.tsx                    Fonts (Bricolage/Lora/Jakarta/Spline), metadata
app/globals.css                   Tailwind + theme tokens ([data-theme=classic|desert|minimal]), keyframes, print CSS
app/api/ai/*/route.ts             OpenRouter proxies: assistant, itinerary, recommendations, insights
app/api/geo/countries/route.ts    Country list from `world-countries` pkg (REST Countries v3.1 is dead)
app/api/geo/cities/route.ts       Cities: GeoNames (if GEONAMES_USERNAME) else Open-Meteo
app/api/geo/geocode/route.ts      Manual-city geocode: Open-Meteo → Nominatim fallback
app/api/geo/city-image/route.ts   City photo via Wikipedia page images
app/api/geo/weather/route.ts      Open-Meteo forecast (≤16d) else seasonal averages
app/api/maps/routes/route.ts      Dormant Google Routes proxy (in-app routing disabled)

components/App.tsx                 Provider nesting + screen switch (trips/form/explore/generating/plan/profile/settings)
components/shell/{AppShell,Sidebar,TopBar}.tsx  Shell: grouped sidebar, breadcrumb+save-status, mounts UnsavedChangesDialog
components/trips/TripsDashboard.tsx             Trips grid + New Trip modal (DestinationPicker)
components/screens/RouteBuilder.tsx             "Plan your route": destination cards (dates/hotels/budget/weather), travel connectors, auto-save
components/screens/Generating.tsx, Itinerary.tsx  Loading screen; legacy single-itinerary screen
components/explore/ExploreExperience.tsx        Explore+Plan: per-destination attraction browsing (PlannerProvider)
components/explore/DestinationItinerary.tsx     Destination-grouped plan: nav, collapsible sections, travel cards
components/explore/PlaceCard.tsx, ExploreMap.tsx, CategoryRail/FilterBar/CompareTray  Attraction UI
components/destinations/DestinationPicker.tsx   Country→cities picker (popular, manual entry, validation, reorder)
components/destinations/CityImage.tsx           City photo w/ deep-ink fallback; BudgetPanel/WeatherPanel = detail chips
components/account/{ProfilePage,SettingsPage,ui}.tsx  Profile (identity/security) + Settings (prefs); independent-save cards
components/auth/{AuthScreen,Onboarding,AuthGate,AccountButton}.tsx  Auth flow + top-bar account menu
components/theme/{ThemeApplier,ThemePicker}.tsx Apply <html data-theme> from prefs; 3 preview cards
components/export/{ExportButton,ItineraryBook,templates}.tsx  Per-destination luxury PDF guide
components/Logo.tsx, icons.tsx, Toast.tsx, ui/UnsavedChangesDialog.tsx

lib/store.tsx                     TripProvider: screen nav (routed through unsavedGuard), destinations, budget level
lib/types.ts                      Core domain types (Screen, Destination, Accommodation, ItineraryItem…)
lib/auth/store.tsx                AuthProvider: session/profile/prefs, signUp(auto-signin), changeEmail, uploadAvatar…
lib/trips/store.tsx               TripsProvider: trip list + active trip
lib/ui/store.tsx                  UIProvider: sidebar collapse
lib/ui/{saveStatus,account,unsavedGuard,useUnsavedChanges}.ts  Module signals + unsaved-changes guard
lib/planner/store.tsx             PlannerProvider: per-destination itinerary (destId+day), favorites, focusDestination
lib/planner/{travel,dayAnalysis}.ts  Timeline/route math; per-day analysis
lib/destinations/repository.ts    saveTrip/loadTrip (destinations+accoms+budget), serialized+coalesced
lib/itinerary/repository.ts       Favorites + schedule_items persistence (destId via `destination` col)
lib/budget/{estimate,useCurrency}.ts  Budget breakdown + CURRENCIES (EUR base → display, default KWD; GCC+EUR+USD)
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
- **Currency:** budget rates are EUR internally and converted for display (default **KWD**); options limited to GCC + EUR + USD; manual overrides stored in the base unit.
- **Theming:** one luxury palette expanded to 3 themes via `[data-theme]` on `<html>`; persisted in prefs; smooth transition.
- **Auth:** email is auto-confirmed (DB trigger) and signup auto-signs-in; the splash can never hang (timeouts + globalThis Supabase singleton).
- **In-app routing for directions is disabled** (Google key is referrer-restricted) → "Open in Google Maps" links; Routes proxy/RoutePlanner kept as a dormant premium seam.

## Conventions
- **Standing rule:** commit + push every change to `origin/main`, with trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. **Never** commit `.env.local` (secrets); `.env.example` documents all vars.
- **Verify in the browser** with the Claude_Preview tools after observable changes; check the console. Turbopack dev sometimes shows **stale** "export X doesn't exist" errors mid-edit — the production `npm run build` is the source of truth; `rm -rf .next` + restart the dev server to clear them.
- **Styling:** Tailwind v4 with CSS-var tokens only — `bg-accent text-ink border-line bg-tint`, `var(--brand-deep)` for deep surfaces. **No emojis**; use `lucide-react`. Serif wordmark = `font-brand` (Lora); display = `font-display` (Bricolage).
- **Money:** always `formatMoney(amountEUR, currency)` from `lib/budget/estimate`; never hardcode a symbol.
- **Persistence:** put it in a `lib/*/repository.ts`; per-user owner-RLS table + localStorage fallback; DB changes via the Supabase MCP `apply_migration`.
- **Async store actions:** use the `stateRef.current` pattern (see `lib/planner/store.tsx`) to avoid stale closures.
- **Editable forms:** call `useUnsavedChanges(dirty)` and route navigation through the store actions so the discard guard works automatically.

## Current state & next steps
**Working:** auth + onboarding; trips dashboard; route builder (multi-destination, dates, hotels w/ location links, per-destination budget + weather, fully persisted); country→city picker; per-destination attraction browsing; destination-grouped itinerary (nav, collapsible sections, travel cards); luxury per-destination PDF export; Profile + Settings pages; 3-theme selector; KWD/GCC currency; unsaved-changes route protection.

**In progress / next:**
- Re-add drag-reorder within a day and a per-destination AI day-score panel (removed when the planner was regrouped by destination); `lib/planner/dayAnalysis.ts` + `components/explore/{DayAnalysis,DaySummary,NearbyOpportunities}.tsx` are now orphaned.
- Real weather/activity counts on route-builder cards (some are estimates/placeholders).
- Full AI Assistant chat (currently a button/flash).
- Optional: set `GEONAMES_USERNAME` for "popular cities by population" (else capital + typed search).
- `schedules` / `itinerary_exports` tables are unused; `lib/maps` Routes/Directions seam is dormant.
