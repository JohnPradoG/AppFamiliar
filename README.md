# AppFamiliar
App privada para llevar el dinero de la familia (mamá administra; cada hijo ve solo lo suyo). Ver `CLAUDE.md` y `docs/`.

## Puesta en marcha (una sola vez, la hace quien administra el proyecto)
1. Crear proyecto en supabase.com. En **SQL Editor** ejecutar en orden `supabase/migrations/0001 … 0006`.
2. **Authentication → Providers → Email:** desactivar "Allow new users to sign up". En **URL Configuration → Redirect URLs** agregar `appfamiliar://set-password`. En Email, subir la validez del enlace (OTP expiry) a 86400 s.
3. **Mamá:** Authentication → Users → *Invite user* con su correo; ella abre el enlace y crea su contraseña. Luego ejecutar `supabase/seed/provision_admin.sql` (con su correo).
4. **Función de invitaciones:** `npx supabase login && npx supabase link --project-ref <ref> && npx supabase functions deploy invite-member`.
5. `cp .env.example .env` y poner URL, llave anon y (opcional) el enlace de descarga del APK.
6. `npm install && npx expo start` y probar en Android con Expo Go.

## Cómo entra la familia (sin enviar contraseñas)
Mamá abre **Más → Invitar a la familia**, escribe nombre y correo de John / del hermano y toca *Crear invitación*. Se abre WhatsApp con un mensaje con el enlace de descarga del APK y un enlace de un solo uso. La persona instala la app, abre el enlace y **crea su propia contraseña**. Mamá no conoce ninguna contraseña. Si alguien la olvida, mamá envía un enlace nuevo desde la misma pantalla (o la persona usa "Olvidé mi contraseña").

## Pruebas
`npm run typecheck` · `npm test` · `npm run test:db`
