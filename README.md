# AppFamiliar
App privada para llevar el dinero de la familia (mamá administra; cada hijo ve solo lo suyo). Ver `CLAUDE.md` y `docs/`.

## Ejecutar
1. Crear proyecto en supabase.com; en SQL Editor ejecutar en orden `supabase/migrations/0001…0005`.
2. Authentication → desactivar "Allow new users to sign up". Invitar a los 3 correos (Users → Invite) y luego ejecutar `supabase/seed/provision_family.sql` (con los correos reales).
3. `cp .env.example .env` y poner URL y llave anon.
4. `npm install && npx expo start` y abrir con Expo Go en Android.

## Pruebas
`npm run typecheck` · `npm run test:db`
