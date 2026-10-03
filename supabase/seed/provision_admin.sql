-- Se ejecuta UNA sola vez en el SQL Editor de Supabase, para dar de alta a MAMÁ (la administradora).
-- John y el hermano NO se crean aquí: mamá los invita desde la app (Más → Invitar a la familia).
--
-- Antes: Authentication → Users → "Invite user" con el correo de mamá. Ella abre el enlace que le llega
-- al correo y crea su contraseña. Luego ejecute esto con ese mismo correo.

do $$
declare v_mama uuid := (select id from auth.users where email = 'mama@ejemplo.com');   -- ← cambie el correo
begin
  if v_mama is null then raise exception 'Primero invite a mamá en Authentication → Users'; end if;
  insert into public.profiles (id, role, display_name) values (v_mama, 'admin', 'Mamá') on conflict (id) do nothing;
end $$;
