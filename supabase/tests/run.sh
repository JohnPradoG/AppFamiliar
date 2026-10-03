#!/usr/bin/env bash
# Pruebas de la base de datos con Postgres 16 local (sin Supabase). Uso: bash supabase/tests/run.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN=/usr/lib/postgresql/16/bin
DIR="$(mktemp -d)"; PORT=54329
chmod 755 "$DIR"
if [ "$(id -u)" = 0 ]; then
  id postgres >/dev/null 2>&1 || useradd -m postgres
  chown postgres "$DIR"; RUN=(su postgres -c)
else RUN=(bash -c); fi
run() { "${RUN[@]}" "$1"; }
run "$PGBIN/initdb -D $DIR/data -A trust >/dev/null"
run "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log -w start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null" || true; rm -rf "$DIR"' EXIT
PSQL=(psql -h "$DIR" -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -d postgres -c "create database app" >/dev/null
for f in "$HERE/00_supabase_mock.sql" "$HERE"/../migrations/*.sql "$HERE"/[1-9]*.sql; do
  echo ">> $(basename "$f")"; "${PSQL[@]}" -d app -f "$f"
done
echo ">> verify_setup.sql (la verificación que ejecuta el dueño en Supabase)"
FALLAS=$("${PSQL[@]}" -d app -At -F'|' -f "$HERE/../verify_setup.sql" | grep '^[0-9]*|FALLA' | grep -v '^11|' || true)
if [ -n "$FALLAS" ]; then echo "verify_setup.sql tiene fallas:"; echo "$FALLAS"; exit 1; fi
echo "TODAS LAS PRUEBAS PASARON"
