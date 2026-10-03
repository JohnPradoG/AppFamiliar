# AppFamiliar
App privada para llevar el dinero de la familia (mamá administra; cada hijo ve solo lo suyo). Ver `CLAUDE.md` y `docs/`.

## Atajo: base de datos en un solo paso
En lugar de ejecutar las migraciones una por una, pegar `supabase/setup_all.sql` completo en Supabase → SQL Editor → Run. (Se regenera con las migraciones; `bash supabase/tests/check_setup_all.sh` comprueba que funciona.)

## Puesta en marcha (una sola vez, la hace quien administra el proyecto)
1. Crear proyecto en supabase.com. En **SQL Editor** ejecutar en orden `supabase/migrations/0001 … 0008`.
2. **Authentication → Providers → Email:** desactivar "Allow new users to sign up". En **URL Configuration → Redirect URLs** agregar `appfamiliar://set-password` (solo para "Olvidé mi contraseña").
3. **Mamá:** Authentication → Users → *Invite user* con su correo; ella abre el enlace y crea su contraseña. Luego ejecutar `supabase/seed/provision_admin.sql` (con su correo).
4. **Funciones:** `npx supabase login && npx supabase link --project-ref <ref> && npx supabase functions deploy invite-member && npx supabase functions deploy accept-invite --no-verify-jwt`.
5. **Página de invitación:** editar `APK_URL` en `web/invitacion/index.html` y subir esa carpeta a un hosting estático gratuito (Cloudflare Pages o Netlify: arrastrar la carpeta). Guardar su dirección como secreto: `npx supabase secrets set INVITE_BASE_URL=https://su-pagina.pages.dev`.
6. `cp .env.example .env` (URL y llave anon) · `npm install && npx expo start` y probar en Android con Expo Go.

## Cómo entra la familia (sin enviar contraseñas)
Mamá abre **Más → Invitar a la familia**, escribe nombre y correo de John / del hermano y toca *Crear invitación*. Se abre WhatsApp con **un solo enlace de un solo uso**. La persona lo abre en su Android: (1) descarga e instala la app, (2) toca "Abrir la app y crear mi contraseña" y elige **su propia contraseña**. Mamá no conoce ninguna contraseña. El enlace se gasta al crear la contraseña, vence a los 7 días y, si mamá genera otro para la misma persona, el anterior queda anulado. Si alguien olvida su contraseña, mamá envía un enlace nuevo desde la misma pantalla.

## Ayudante
Mamá puede dar a John (o al hermano) el permiso de **ayudante de invitaciones** desde *Más → Invitar a la familia*. Con él puede enviar y reenviar enlaces, pero no ve dinero ni movimientos de nadie más.

## Pruebas
`npm run typecheck` · `npm test` · `npm run test:db`
