# Deploying Itinera (Vercel)

The app reads its config from environment variables. **`NEXT_PUBLIC_*` variables
are inlined at build time**, so they must be set *before* a build and a new
deploy must run after changing them. If they're missing, production shows
"Sign-in isn't available" instead of the app (a deliberate safeguard).

## Environment variables

| Variable | Required? | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | `https://nscjjeowzitdthaynlxx.supabase.co` (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | public anon key (safe in client; RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ for username login | **server-only secret** — Supabase → Project Settings → API → `service_role`. Never `NEXT_PUBLIC`. Email login works without it. |
| `OPENROUTER_API_KEY` | for AI features | server-only |
| `OPENROUTER_MODEL` | optional | e.g. `qwen/qwen3-next-80b-a3b-instruct:free` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | for maps/places | referrer-restrict it |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | optional | `DEMO_MAP_ID` works |

## Option A — one command (uses your local `.env.local`)

```bash
bash scripts/deploy-to-vercel.sh
```

First run prompts `vercel login` + `vercel link`; then it pushes every variable
found in `.env.local` to Production + Preview and deploys. (No secrets are stored
in the repo — the script reads `.env.local` at run time.)

## Option B — Vercel dashboard

1. Project → **Settings → Environment Variables** → add the vars above (scope
   **Production**, and **Preview** if you use preview URLs).
2. **Deployments → ⋯ → Redeploy** (rebuild picks up the new vars).

## After deploy
Logged-out visitors see the login/signup page; signed-in users get the app with
sign-out in the sidebar footer. Without `SUPABASE_SERVICE_ROLE_KEY`, email login
works and username login reports unavailable until the key is added.
