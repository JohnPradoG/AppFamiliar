-- AppFamiliar · 0010 · Endurecimiento: límites de datos, auditoría inmutable e indicador "soy yo" para ayudantes.

-- Límites razonables (defensa en profundidad frente a errores de digitación o peticiones manipuladas).
alter table public.incomes           add constraint incomes_amount_cap      check (amount <= 1000000000000);
alter table public.account_movements add constraint movements_amount_cap    check (abs(signed_amount) <= 1000000000000);
alter table public.accounts          add constraint accounts_opening_cap    check (abs(opening_balance) <= 1000000000000);
alter table public.account_movements add constraint movements_text_len      check (length(coalesce(concept, '')) <= 500 and length(coalesce(origin_detail, '')) <= 200);
alter table public.incomes           add constraint incomes_text_len        check (length(coalesce(description, '')) <= 500);
alter table public.machines          add constraint machines_text_len       check (length(name) <= 80 and length(coalesce(description, '')) <= 500);
alter table public.profiles          add constraint profiles_name_len       check (length(btrim(display_name)) between 1 and 60);

-- Funciones nuevas: sin permiso de ejecución para nadie por defecto (cada migración concede lo que necesite).
alter default privileges in schema public revoke execute on functions from public, anon;

-- La auditoría es de solo-agregar: nadie (ni por error) puede modificarla o borrarla.
create function public._audit_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'El registro de auditoría no se puede modificar ni borrar';
end $$;
revoke all on function public._audit_immutable() from public, anon, authenticated;
create trigger audit_logs_immutable before update or delete on public.audit_logs for each row execute function public._audit_immutable();
create trigger audit_logs_no_truncate before truncate on public.audit_logs for each statement execute function public._audit_immutable();

-- family_status: agrega is_me (para que cada persona vea qué tarjeta es la suya sin exponer ids).
create or replace function public.family_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or public.is_helper()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'owner_key', a.owner_key, 'display_name', p.display_name, 'is_helper', p.is_helper, 'active', p.active,
             'is_me', p.id = auth.uid(),
             'user_id', case when public.is_admin() then p.id end) order by p.display_name)
      from public.accounts a join public.profiles p on p.id = a.user_id), '[]'::jsonb);
end $$;
