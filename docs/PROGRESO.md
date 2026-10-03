# Progreso

| Fase | Estado |
|------|--------|
| 1. Arquitectura + BD + autenticación | **BD y seguridad: HECHO y probado.** Falta: app Expo con login (siguiente paso) |
| 2. Cuenta de mamá | pendiente |
| 3. Cuenta de John | pendiente |
| 4. Cuenta del hermano | pendiente (misma UI que John) |
| 5. Movimientos + saldos + transferencias | **Lógica en BD ya hecha** (RPCs). Falta UI |
| 6. Comprobantes | **Bucket + políticas en BD hechas.** Falta subida desde la app |
| 7. Edición + eliminación + auditoría | **En BD hecho** (triggers + RPCs). Falta UI |
| 8. Seguridad + pruebas | 60+ pruebas de BD/RLS ya corren; falta pruebas de la app |
| 9. Diseño final | pendiente |
| 10. Publicación | pendiente |

## Cómo probar la BD
`bash supabase/tests/run.sh` — levanta Postgres 16 temporal, aplica `supabase/migrations/*`, corre los 8 casos del encargo y reglas extra (sobregiro, soft delete, auditoría, comprobantes, Storage, notificaciones).

## Decisión pendiente del dueño
Ver `docs/ARQUITECTURA.md` §A.3 "Decisiones que debes confirmar".
