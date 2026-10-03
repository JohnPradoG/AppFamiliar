create schema test;
grant usage on schema test to authenticated;
create table test.ids (name text primary key, id uuid not null);
grant select on test.ids to authenticated;
create function test.id(p text) returns uuid language sql stable as $$ select id from test.ids where name = p $$;
create function test.eq(p_label text, p_actual bigint, p_expected bigint) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then raise exception 'FALLÓ: % → esperado %, obtenido %', p_label, p_expected, p_actual; end if;
  raise notice 'ok  %', p_label;
end $$;
-- Ejecuta sql y exige que FALLE (permiso denegado, RLS o regla de negocio).
create function test.denied(p_label text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then raise notice 'ok  % (bloqueado: %)', p_label, sqlerrm; return; end;
  raise exception 'FALLÓ: % → la operación NO fue bloqueada', p_label;
end $$;
create function test.login(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', test.id(p_name)::text, false);
  set role authenticated;
end $$;
grant execute on all functions in schema test to authenticated;

-- Usuarios: provisionado igual que supabase/seed/provision_family.sql
insert into auth.users (email) values ('mama@t'), ('john@t'), ('hermano@t');
insert into test.ids select 'mama', id from auth.users where email = 'mama@t';
insert into test.ids select 'john', id from auth.users where email = 'john@t';
insert into test.ids select 'brother', id from auth.users where email = 'hermano@t';
insert into public.profiles (id, role, display_name) values
  (test.id('mama'), 'admin', 'Mamá'), (test.id('john'), 'user', 'John'), (test.id('brother'), 'user', 'Hermano');
insert into public.accounts (user_id, owner_key, created_by) values
  (test.id('john'), 'john', test.id('mama')), (test.id('brother'), 'brother', test.id('mama'));
insert into test.ids select 'acc_john', id from public.accounts where owner_key = 'john';
insert into test.ids select 'acc_brother', id from public.accounts where owner_key = 'brother';
-- Segunda administradora debe ser imposible.
do $$ begin
  insert into auth.users (email) values ('otra@t');
  begin insert into public.profiles (id, role, display_name) select id, 'admin', 'Otra' from auth.users where email='otra@t';
        raise exception 'FALLÓ: se permitió una segunda admin';
  exception when unique_violation then raise notice 'ok  solo puede existir una administradora'; end;
end $$;
create function test.bal(p_key text) returns bigint language sql stable as
  $$ select balance from public.account_balances where owner_key = p_key $$;
grant execute on function test.bal(text) to authenticated;
