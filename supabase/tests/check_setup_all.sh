#!/usr/bin/env bash
# Comprueba que setup_all.sql (lo que se pega en Supabase) funciona igual que las migraciones por separado.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
sed -e 's#"\$HERE"/../migrations/\*.sql#"$HERE"/../setup_all.sql#' "$HERE/run.sh" > "$HERE/.run_all.sh"
HERE="$HERE" bash "$HERE/.run_all.sh"; rm -f "$HERE/.run_all.sh"
