#!/usr/bin/env bash
# ===== One-shot Vercel env setup + deploy =====
# Pushes the variables from your local .env.local to Vercel (Production + Preview)
# and deploys. NEXT_PUBLIC_* are read at BUILD time, so this rebuilds the app.
#
# This script contains NO secrets — it reads them from .env.local at run time.
#
# Usage (from the project root):
#   bash scripts/deploy-to-vercel.sh
# The first run will prompt you to `vercel login` and `vercel link` (pick your
# scope + the Itinera project). Subsequent runs reuse that.

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE — copy .env.example to .env.local and fill it in first."; exit 1; }

VERCEL="npx --yes vercel@latest"

# 1) Authenticate (interactive, first time only) + link this folder to your project.
$VERCEL whoami >/dev/null 2>&1 || $VERCEL login
$VERCEL link

# 2) Variables to publish. NEXT_PUBLIC_* are client/build-time; the rest are server-only.
KEYS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
  OPENROUTER_API_KEY
  OPENROUTER_MODEL
  SUPABASE_SERVICE_ROLE_KEY
)

read_val() { sed -nE "s/^$1=//p" "$ENV_FILE" | head -1 | sed -E 's/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/'; }

for k in "${KEYS[@]}"; do
  v="$(read_val "$k")"
  if [ -z "$v" ]; then
    echo "• $k not set in .env.local — skipping (add it there and re-run if you need it)"
    continue
  fi
  for target in production preview; do
    $VERCEL env rm "$k" "$target" -y >/dev/null 2>&1 || true
    printf '%s' "$v" | $VERCEL env add "$k" "$target" >/dev/null
  done
  echo "✓ $k → production + preview"
done

# 3) Build + deploy to production (bakes in the NEXT_PUBLIC_* vars).
echo "Deploying to production…"
$VERCEL --prod
echo "Done. Visit the printed URL — logged-out users should now see the login page."
