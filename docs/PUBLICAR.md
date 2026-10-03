# Publicar AppFamiliar (Android, sin Play Store)

Todo es gratis. Lo hace **una sola persona** (quien administra el proyecto). Orden recomendado:

## A. Supabase (todo desde el panel, sin instalar nada · ~10 minutos)
Proyecto ya creado: **https://jkysgjmrwsmmhnlhfezl.supabase.co** (Project URL y llave *publishable*, que son públicas por diseño y van en la app).

1. **SQL Editor → New query:** abrir `supabase/setup_all.sql`, copiar TODO, pegar y tocar **Run**. Debe terminar sin errores (si sale un error, copiar el mensaje). Esto crea tablas, seguridad y las máquinas **Wild** y **Máquina Multijuegos**.
   **Comprobar:** en otra consulta nueva pegar `supabase/verify_setup.sql` → Run. Todas las filas deben decir **OK**, excepto "Mamá ya está dada de alta" (última), que dirá FALLA hasta el paso 4. Si otra dice FALLA, copiar la tabla completa de resultados.
2. **Authentication → Sign In / Providers → Email:** desactivar **"Allow new users to sign up"** y **"Confirm email"** (las cuentas se crean solo por invitación).
3. **Authentication → URL Configuration → Redirect URLs:** agregar `appfamiliar://set-password` (solo lo usa "Olvidé mi contraseña").
4. **Mamá:** Authentication → Users → *Add user → Send invitation* con su correo; ella abre el enlace que le llega y crea su contraseña. Luego, en SQL Editor, ejecutar `supabase/seed/provision_admin.sql` cambiando el correo por el de mamá.
5. **Funciones de invitación:** *Edge Functions → Deploy a new function → Via Editor*.
   - Nombre `invite-member`: pegar TODO `supabase/bundled/invite-member.ts` → Deploy. (Dejar activada la verificación de JWT.)
   - Nombre `accept-invite`: pegar TODO `supabase/bundled/accept-invite.ts` → Deploy → en sus ajustes **desactivar "Verify JWT"** (es pública a propósito: la protege el código de un solo uso).
   - Supabase les inyecta solas la URL y la llave secreta; no hay que copiarlas.
6. **Página de invitación** (sección C) y luego en *Edge Functions → Secrets* agregar `INVITE_BASE_URL` con su dirección y volver a desplegar `invite-member`.

> **Llaves:** la **publishable** (`sb_publishable_…`) y la URL van en la app. La **secret** (`sb_secret_…`) NUNCA se pega en la app, en el repositorio ni en un chat: solo vive dentro de Supabase. Si alguna vez se expone, se rota en *Project Settings → API Keys*.
> Los archivos de `supabase/bundled/` se regeneran con `npm run functions:bundle` si cambia el código de las funciones. El paquete `@supabase/server` no hace falta: las funciones usan `supabase-js`, que ya funciona.

## B. Compilar la app (APK)
1. Cuenta gratuita en expo.dev. En el proyecto: `npm install` y `npx eas-cli login` y `npx eas-cli init`.
2. Variables públicas para la compilación:
   ```
   npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://jkysgjmrwsmmhnlhfezl.supabase.co --visibility plaintext --environment preview --environment production
   npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <la llave publishable sb_publishable_…> --visibility plaintext --environment preview --environment production
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
