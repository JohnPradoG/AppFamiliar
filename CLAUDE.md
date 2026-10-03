# AppFamiliar

App móvil privada para llevar el control del dinero familiar. Hoy: mamá=admin, John (quien pidió la app) y Mauricio (su hermano). La familia es flexible: mamá puede agregar/quitar personas.

**Leer primero (no pedir al usuario que repita el encargo):**
- `docs/ENCARGO.md` — requerimiento original completo (fuente de verdad).
- `docs/ARQUITECTURA.md` — decisiones técnicas A–H.
- `docs/PROGRESO.md` — fase actual y qué falta. Actualizar al terminar cada fase.

## Reglas inamovibles
- Prioridad absoluta: saldos correctos + privacidad real entre hermanos (RLS en Postgres, no solo UI).
- Saldo = `SUM` de `account_movements` activos. Nunca guardar un saldo editable.
- Movimientos con soft delete + auditoría. Montos en pesos enteros (`bigint`), sin decimales.
- Trabajar por fases (ver ARQUITECTURA §H); no generar todo de una vez; no romper fases anteriores.
- Idioma de UI y docs: español. Rama de desarrollo: `ccr-b29f5c1d-yjcyes`.
- Pruebas de BD: `bash supabase/tests/run.sh` (Postgres 16 local).
- **Supabase está enlazado a este repositorio (GitHub → rama de producción `ccr-b29f5c1d-yjcyes`):** cada push a esa rama APLICA las migraciones y despliega las funciones en la base REAL. Por eso: las migraciones ya aplicadas NUNCA se editan (solo se agregan nuevas, con el siguiente número); toda migración se prueba antes con `bash supabase/tests/run.sh`; y después de cambiar migraciones se regenera `bash scripts/build-setup.sh` y `node scripts/bundle-functions.mjs`. Ver `docs/PUBLICAR.md` §A.

