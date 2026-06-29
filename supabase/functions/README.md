# Supabase Edge Functions

All of Itinera's server logic runs here (there are no Next.js API routes). The
browser calls these via `lib/edge.ts` → `callFn(name, body)`.

| Function | Auth | Secret needed | Purpose |
|---|---|---|---|
| `fx` | public | — | Live EUR-base exchange rates (open.er-api.com) |
| `geo-countries` | public | — | Country reference data (`world-countries`) |
| `geo-cities` | public | optional `GEONAMES_USERNAME` | City search (GeoNames → Open-Meteo) |
| `geo-geocode` | public | — | Geocode a typed city (Open-Meteo → Nominatim) |
| `geo-city-image` | public | — | City photo (Wikipedia page images) |
| `geo-weather` | public | — | Forecast / seasonal averages (Open-Meteo) |
| `username-login` | public | — (uses auto-injected service role) | Resolve username→email + return session tokens |
| `maps-routes` | public | `GOOGLE_MAPS_SERVER_API_KEY` (dormant) | Google Routes proxy |
| `ai` | **real user JWT** | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | itinerary / insights / recommendations / assistant (stream) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically — never set them as secrets.

## Deploy

All functions are deployed with **JWT verification disabled** (they handle CORS +
auth in-function so the browser preflight isn't blocked):

```bash
supabase functions deploy <name> --no-verify-jwt
# e.g.
supabase functions deploy ai --no-verify-jwt
supabase functions deploy fx --no-verify-jwt
```

## Secrets

```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-... OPENROUTER_MODEL=qwen/qwen3-next-80b-a3b-instruct:free
supabase secrets set GEONAMES_USERNAME=your_geonames_user      # optional
supabase secrets set GOOGLE_MAPS_SERVER_API_KEY=AIza...        # optional (maps-routes)
```

Until `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` are set, `ai` returns 503 and the
app falls back to its built-in (non-AI) behavior.
