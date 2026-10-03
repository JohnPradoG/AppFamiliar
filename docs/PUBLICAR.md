# Publicar AppFamiliar (Android, sin Play Store)

Todo es gratis. Lo hace **una sola persona** (quien administra el proyecto). Orden recomendado:

## A. Supabase (base de datos y autenticación)
1. Crear cuenta en supabase.com y un proyecto ("appfamiliar", región cercana, **guardar la contraseña de la base**). Activar verificación en dos pasos en esa cuenta.
2. **SQL Editor → New query:** pegar `supabase/setup_all.sql` completo → Run. (Ya crea las máquinas **Wild** y **Máquina Multijuegos**.)
3. **Authentication → Providers → Email:** desactivar "Allow new users to sign up" y "Confirm email" (las cuentas las crea la invitación).
4. **Authentication → URL Configuration → Redirect URLs:** agregar `appfamiliar://set-password` (solo lo usa "Olvidé mi contraseña").
5. **Mamá:** Authentication → Users → *Invite user* con su correo; ella abre el enlace y crea su contraseña. Luego, en SQL Editor, ejecutar `supabase/seed/provision_admin.sql` con ese correo.
6. **Funciones de invitación** (desde un computador con Node): 
   ```
   npx supabase login
   npx supabase link --project-ref <REF>          # el REF está en Project Settings → General
   npx supabase functions deploy invite-member
   npx supabase functions deploy accept-invite --no-verify-jwt
   ```
7. Copiar **Project URL** y la llave **anon / publishable** (Project Settings → API). *Nunca* la `service_role`.

## B. Compilar la app (APK)
1. Cuenta gratuita en expo.dev. En el proyecto: `npm install` y `npx eas-cli login` y `npx eas-cli init`.
2. Variables públicas para la compilación:
   ```
   npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co --visibility plaintext --environment preview --environment production
   npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon> --visibility plaintext --environment preview --environment production
   ```
3. `npx eas-cli build -p android --profile preview` → al terminar da un enlace para **descargar el APK**.
4. Subir el APK a un lugar con enlace directo (Google Drive "cualquiera con el enlace", o GitHub Releases) y copiar ese enlace.

## C. Página de invitación (un solo enlace para la familia)
1. Editar `web/invitacion/index.html`: poner el enlace del APK en `APK_URL`.
2. Subir la carpeta `web/invitacion` a Cloudflare Pages o Netlify (arrastrar la carpeta). Copiar su dirección, p. ej. `https://appfamiliar.pages.dev`.
3. Guardarla en Supabase: `npx supabase secrets set INVITE_BASE_URL=https://appfamiliar.pages.dev` y volver a desplegar `invite-member`.

## D. Primera prueba (con el teléfono de mamá)
1. Instalar el APK (Android pide permitir "instalar apps de esta fuente": es normal).
2. Mamá entra con su correo y contraseña → **Más → Invitar a la familia** → agrega a John y a Mauricio (nombre + correo) → envía por WhatsApp.
3. Cada uno abre su enlace, instala si falta, toca "Abrir la app y crear mi contraseña".
4. Seguir **docs/PRUEBA_FINAL.md**.

## E. Mantenimiento
- **Respaldo:** el plan gratuito de Supabase no hace copias automáticas. Cada mes: Historial → *Exportar a Excel (CSV)* y guardarlo, o pasar al plan Pro (~25 USD/mes) que sí las incluye.
- **Pausa por inactividad:** un proyecto gratuito sin uso por 7 días se pausa; se reactiva con un clic en el panel.
- **Actualizar la app:** subir `version` en `app.json`, nueva compilación y compartir el nuevo APK. Cambios de base de datos: nueva migración en `supabase/migrations/` + `npm run setup:build`.
- **Si alguien pierde el teléfono:** mamá lo quita en Más → Invitar a la familia → *Quitar* (pierde el acceso al instante), o cambia su contraseña con un enlace nuevo; luego lo reactiva.
