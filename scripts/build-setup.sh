#!/usr/bin/env bash
# Regenera supabase/setup_all.sql (todas las migraciones en un solo archivo para pegar en Supabase).
set -euo pipefail
cd "$(dirname "$0")/.."
last=$(ls supabase/migrations/*.sql | tail -1 | xargs basename | cut -c1-4)
{
  echo "-- AppFamiliar · TODA la base de datos en un solo archivo (migraciones 0001–$last juntas)."
  echo "-- Pegar completo en Supabase → SQL Editor → New query → Run. Se ejecuta UNA sola vez."
  echo "-- Generado por scripts/build-setup.sh: no editar a mano."
  for f in supabase/migrations/*.sql; do echo; echo "-- ═════════ $(basename "$f") ═════════"; cat "$f"; done
} > supabase/setup_all.sql
echo "setup_all.sql regenerado (hasta $last)"
