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
