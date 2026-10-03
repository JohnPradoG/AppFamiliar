-- Se ejecuta UNA vez en el SQL Editor de Supabase, después de crear 3 usuarios en
-- Authentication → Users (con "Auto confirm"). Cambie los correos por los reales.
-- Los roles NUNCA se toman de metadatos de registro (el registro público está desactivado).

do $$
declare
  v_mama uuid    := (select id from auth.users where email = 'mama@ejemplo.com');
  v_john uuid    := (select id from auth.users where email = 'john@ejemplo.com');
  v_brother uuid := (select id from auth.users where email = 'hermano@ejemplo.com');
begin
  if v_mama is null or v_john is null or v_brother is null then
    raise exception 'Falta crear algún usuario en Authentication → Users';
  end if;
  insert into public.profiles (id, role, display_name) values
    (v_mama,    'admin', 'Mamá'),
    (v_john,    'user',  'John'),
    (v_brother, 'user',  'Hermano')
  on conflict (id) do nothing;
  insert into public.accounts (user_id, owner_key, created_by) values
    (v_john,    'john',    v_mama),
    (v_brother, 'brother', v_mama)
  on conflict (user_id) do nothing;
end $$;
