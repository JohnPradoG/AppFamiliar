#!/usr/bin/env bash
# Prueba de humo VISUAL: compila la app web contra un Supabase simulado, entra como mamá y como John y recorre pantallas.
# Capturas en $SHOT_DIR (por defecto /tmp/appfamiliar-smoke). Requiere Chromium (CHROME_PATH) y `npm i` (playwright-core).
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${SHOT_DIR:-/tmp/appfamiliar-smoke}"; mkdir -p "$OUT"
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=anon npx expo export --platform web --clear --output-dir "$OUT/web" >/dev/null
node scripts/smoke/mock-supabase.js >"$OUT/mock.log" 2>&1 & M=$!
WEB_DIR="$OUT/web" node scripts/smoke/static-server.js >"$OUT/static.log" 2>&1 & W=$!
trap 'kill $M $W 2>/dev/null || true' EXIT
sleep 2
SHOT_DIR="$OUT" node scripts/smoke/tour.js
echo "Capturas en $OUT"
