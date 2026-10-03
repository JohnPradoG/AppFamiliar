# Publicar AppFamiliar (Android, sin Play Store)

Todo es gratis. Lo hace **una sola persona** (quien administra el proyecto). Orden recomendado:

## A. Supabase conectado a GitHub (la base y las funciones se cargan solas)
Proyecto: **https://jkysgjmrwsmmhnlhfezl.supabase.co** · Repositorio: `JohnPradoG/AppFamiliar`.

**A.1 — Integración (una sola vez, en el panel):** *Project Settings → Integrations → GitHub*:
- Repositorio: `JohnPradoG/AppFamiliar` · carpeta de Supabase: **`supabase`** · rama de producción: **`ccr-b29f5c1d-yjcyes`** (la única rama que existe; si algún día se crea `main`, cambiar aquí).
- **Deploy to production: activado.** (Las ramas de vista previa/branching requieren plan Pro: dejarlo apagado.)

**A.2 — Qué pasa en cada push a la rama de producción:** Supabase aplica las migraciones nuevas de `supabase/migrations/` y despliega las funciones de `supabase/functions/` (con la verificación de JWT que dicen `supabase/config.toml`).
- **No pegar `setup_all.sql` a mano** si la integración ya lo aplicó: duplicaría todo y daría errores. `setup_all.sql` queda solo como plan B para quien NO use GitHub.
- Las migraciones ya aplicadas **no se editan nunca**; los cambios se agregan como migraciones nuevas.

**A.3 — Comprobar que cargó:** *Database → Migrations* debe listar `0001` … `0013` como aplicadas. Luego, en **SQL Editor**, pegar `supabase/verify_setup.sql` → Run: todas las filas **OK**, excepto "Mamá ya está dada de alta" (hasta el paso A.5). Si algo falla, copiar el mensaje (de *Migrations* o de la tabla de resultados).

**A.4 — Ajustes de autenticación (a mano, una vez):** *Authentication → Sign In / Providers → Email*: desactivar **"Allow new users to sign up"** y **"Confirm email"**. *URL Configuration → Redirect URLs*: agregar `appfamiliar://set-password`.

**A.5 — Mamá:** *Authentication → Users → Add user → Send invitation* con su correo; ella crea su contraseña. Luego, en SQL Editor, ejecutar `supabase/seed/provision_admin.sql` cambiando el correo por el de mamá. Volver a correr `verify_setup.sql`: todo **OK**.

**A.6 — Página de invitación** (sección C) y luego *Edge Functions → Secrets*: agregar `INVITE_BASE_URL` con su dirección (después, redesplegar `invite-member`: basta cualquier push que toque la función, o "Redeploy" en el panel).

> **Plan B sin GitHub:** pegar `supabase/setup_all.sql` en el SQL Editor y pegar a mano `supabase/bundled/*.ts` en *Edge Functions → Via Editor* (en `accept-invite`, desactivar "Verify JWT").
> **Llaves:** la **publishable** (`sb_publishable_…`) y la URL van en la app. La **secret** (`sb_secret_…`) NUNCA se pega en la app, el repositorio ni un chat; se rota en *Project Settings → API Keys*.

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
