# Progreso

| Fase | Estado |
|------|--------|
| 1. Arquitectura + BD + autenticación | **BD: HECHO y probado.** App Expo: login, sesión persistente, rutas por rol, recuperar/crear contraseña, cerrar sesión: **código listo (typecheck OK)**; falta probar contra un Supabase real |
| 2. Cuenta de mamá | **Hecho (parte 1):** dashboard con filtros Hoy/Semana/Mes/Mes anterior/Todo, Cuentas, Máquinas (crear/editar/desactivar/historial). BD `admin_dashboard` probada. Pendiente: filtro "Personalizado"; Historial global con filtros (Fase 7); selector de fecha visual (Fase 9) |
| 3. Cuenta de John | **Hecho:** Inicio (saldo, total ingresos, total transferencias, último movimiento), Historial (Todos/Ingresos/Transferencias), Mi cuenta (origen del saldo, tocar categoría → detalle). Pendiente: pestaña Comprobantes (Fase 6) y Perfil/Notificaciones |
| 4. Cuenta del hermano | **Hecho en código** (misma UI que John; cada uno solo recibe su cuenta de la BD). Pruebas de aislamiento en `supabase/tests/30_` y `80_` |
| 5. Movimientos + saldos + transferencias | **Hecho:** pestañas de mamá Inicio · Ingresos · Transferencias · Cuentas · Más; formularios Registrar ingreso (con asignación opcional y distinta por hijo), Agregar saldo (Trabajo/Máquina/Otro/Personalizado), Transferir (aviso si deja saldo negativo); detalle de cuenta con origen del saldo y movimientos. Validaciones con pruebas. Pendiente: adjuntar comprobante (Fase 6) |
| 6. Comprobantes | **Hecho:** adjuntar al transferir (elegir archivo o tomar foto; JPG/PNG/PDF ≤ 10 MB), subida a Storage privado + registro; pestaña Comprobantes del hijo; visor con enlace temporal de 2 min. Validación y rutas con pruebas; privacidad probada en BD (`40_`) |
| 7. Edición + eliminación + auditoría | **En BD hecho** (triggers + RPCs). Falta UI |
| 8. Seguridad + pruebas | 60+ pruebas de BD/RLS ya corren; falta pruebas de la app |
| 9. Diseño final | pendiente |
| 10. Publicación | pendiente |

## Cómo probar la BD
`bash supabase/tests/run.sh` — levanta Postgres 16 temporal, aplica `supabase/migrations/*`, corre los 8 casos del encargo y reglas extra (sobregiro, soft delete, auditoría, comprobantes, Storage, notificaciones).

## Decisión pendiente del dueño
Ver `docs/ARQUITECTURA.md` §A.3 "Decisiones que debes confirmar".

## Decisiones tomadas con el dueño
- Plataforma: **Android** (Expo; versión web posible después).
- Registro: **mamá invita desde la app** (Más → Invitar a la familia) y comparte por WhatsApp **un solo enlace de un solo uso** (página con descarga del APK + botón que abre la app con la invitación). Cada quien crea SU contraseña; nadie la envía. Código de 128 bits (en la BD solo su hash), vence en 7 días, se anula al generar otro. Edge Functions `invite-member` (solo mamá) y `accept-invite` (pública, un solo uso). Limitación de Android: un APK instalado por fuera de la tienda no recibe datos del enlace tras instalar, por eso la página tiene el paso 2 (y el código manual como respaldo).
- Diseño: seguir `docs/diseno/referencia-pantallas.jpg`.
- Rol **ayudante de invitaciones** (decisión del dueño): mamá le da permiso a John (Más → Invitar a la familia → interruptor). Puede enviar/reenviar invitaciones y ver quién se registró; NO ve dashboard, saldos ni movimientos de nadie más. No es administrador (privacidad entre hermanos intacta). Probado en `supabase/tests/70_helper.sql`. Nota: quien administra el proyecto de Supabase puede ver todo desde el panel técnico; eso es independiente de la app.
- **Familia flexible** (decisión del dueño): el hermano se llama **Mauricio**; mamá puede incluir o quitar personas. Cada persona nueva = cuenta privada propia (clave generada desde el nombre). "Quitar" desactiva (RLS: la persona deja de ver todo) y conserva el historial; se puede reactivar y renombrar. Pedir confirmación si hay saldo. Migración `0009`, pruebas `90_members.sql`. Una persona quitada no cuenta en el dashboard ni en el saldo administrado.
