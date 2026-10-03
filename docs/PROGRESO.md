# Progreso

| Fase | Estado |
|------|--------|
| 1. Arquitectura + BD + autenticación | **BD: HECHO y probado.** App Expo: login, sesión persistente, rutas por rol, recuperar/crear contraseña, cerrar sesión: **código listo (typecheck OK)**; falta probar contra un Supabase real |
| 2. Cuenta de mamá | **Hecho (parte 1):** dashboard con filtros Hoy/Semana/Mes/Mes anterior/Todo, Cuentas, Máquinas (crear/editar/desactivar/historial). BD `admin_dashboard` probada. Filtro Personalizado, historial con filtros y selector de fecha: hechos |
| 3. Cuenta de John | **Hecho:** Inicio (saldo, total ingresos, total transferencias, último movimiento), Historial (Todos/Ingresos/Transferencias), Mi cuenta (origen del saldo, tocar categoría → detalle). Pendiente: pestaña Comprobantes (Fase 6) y Perfil/Notificaciones |
| 4. Cuenta del hermano | **Hecho en código** (misma UI que John; cada uno solo recibe su cuenta de la BD). Pruebas de aislamiento en `supabase/tests/30_` y `80_` |
| 5. Movimientos + saldos + transferencias | **Hecho:** pestañas de mamá Inicio · Ingresos · Transferencias · Cuentas · Más; formularios Registrar ingreso (con asignación opcional y distinta por hijo), Agregar saldo (Trabajo/Máquina/Otro/Personalizado), Transferir (aviso si deja saldo negativo); detalle de cuenta con origen del saldo y movimientos. Validaciones con pruebas. Pendiente: adjuntar comprobante (Fase 6) |
| 6. Comprobantes | **Hecho:** adjuntar al transferir (elegir archivo o tomar foto; JPG/PNG/PDF ≤ 10 MB), subida a Storage privado + registro; pestaña Comprobantes del hijo; visor con enlace temporal de 2 min. Validación y rutas con pruebas; privacidad probada en BD (`40_`) |
| 7. Edición + eliminación + auditoría | **Hecho:** Historial de mamá con filtros (período incl. Personalizado, tipo, cuenta, máquina, monto) y orden; exportar CSV; detalle de movimiento (editar con motivo, eliminar con confirmación mostrando tipo/monto/destinatario, comprobantes, registro de cambios con valor anterior/nuevo y quién); editar/eliminar ingreso con su reparto; registrar corrección |
| 8. Seguridad + pruebas | **Hecho (salvo prueba con Supabase real):** revisión de amenazas (`docs/SEGURIDAD.md`); corregido hueco: un ayudante ya no puede pedir enlaces para otra persona; límites de datos, auditoría inmutable, invariantes de seguridad en la BD (RLS forzada, sin escritura directa, `search_path`), pruebas estáticas de la app, CI en GitHub Actions |
| 9. Diseño final | **Hecho:** selector de fecha nativo; pantalla Más/Perfil compartida (notificaciones con contador, cambiar contraseña, ayuda, cerrar sesión); Notificaciones (se llenan por trigger); bloqueo opcional con huella/PIN; sesión guardada CIFRADA (SecureStore en trozos); ícono y splash propios; marcar leídas por función (`0011`). Pendiente: notificaciones push reales, pulido visual con tu teléfono |
| 10. Publicación | **Preparada:** `eas.json` (APK), permisos mínimos de Android, guías `docs/PUBLICAR.md`, checklist `docs/PRUEBA_FINAL.md`, política de privacidad, página de invitación. **Falta ejecutar** (requiere tus cuentas): crear proyecto Supabase, compilar el APK con EAS, subir la página |

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
- **Máquinas iniciales** (pedido del dueño): **Wild** y **Multijuegos** vienen creadas y activas (migración `0012`); mamá puede agregar más, editarlas o desactivarlas (Ingresos → Ver máquinas). Cada ingreso se asigna a John, a Mauricio o a ambos al registrarlo; las máquinas no pertenecen a una persona fija. Probado en `85_default_machines.sql`.

---
## PENDIENTE (al cierre del desarrollo)

### Requiere cuentas/acciones del dueño (no se puede hacer desde el entorno de desarrollo)
1. **Crear el proyecto de Supabase** y cargar la base (`supabase/setup_all.sql`), desactivar el registro público, dar de alta a mamá (`provision_admin.sql`) y **desplegar las 2 Edge Functions** (`docs/PUBLICAR.md` §A). El entorno de desarrollo no tiene salida a supabase.com; si se habilita (red + token) puede hacerlo Claude.
2. **Compilar el APK** con EAS (cuenta gratuita de Expo) y subirlo a un enlace de descarga (§B).
3. **Publicar la página de invitación** (`web/invitacion`) en Cloudflare Pages/Netlify y guardar `INVITE_BASE_URL` (§C).
4. **Datos reales:** correo de mamá y de cada integrante.

### Sin verificar (solo probado con simulación/pruebas unitarias)
- Todo el flujo contra **Supabase real**: consultas con relaciones (embeds) de PostgREST, subida a Storage, Edge Functions en el runtime Deno (su lógica sí está probada).
- La app **en un teléfono Android**: enlace de WhatsApp → página → abrir la app, cámara, selector de archivos, huella/PIN, compartir CSV, aspecto visual frente a la imagen de referencia. Usar `docs/PRUEBA_FINAL.md`.
- La integración continua (GitHub Actions) no se ha ejecutado todavía.

### Funciones no implementadas (decisión o fases futuras)
- **Notificaciones push** (el teléfono avisa solo): hoy hay lista dentro de la app que se llena por trigger; falta registrar tokens y enviarlas.
- **Exportar a Excel (.xlsx) y PDF:** hoy solo CSV (Excel lo abre).
- **Versión web para mamá:** la arquitectura lo permite (Expo web) pero no se ha probado ni ajustado el diseño.
- **iOS:** sin configurar (se decidió Android).
- **Restaurar un movimiento eliminado** (hoy se ve en el historial y se puede registrar uno nuevo).
- **Saldo inicial por cuenta:** la columna existe (`opening_balance`) pero no hay pantalla; todas empiezan en $0.
- **Copias de seguridad automáticas:** requieren plan Pro de Supabase (o exportar CSV cada mes).
- **Límite de intentos propio** al canjear invitaciones (hoy se protege por el tamaño del código y el límite de Supabase).
- Miniaturas de comprobantes, modo claro, textos configurables.
