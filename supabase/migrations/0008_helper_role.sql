-- AppFamiliar · 0008 · "Ayudante de invitaciones": un hijo con permiso para enviar/reenviar invitaciones.
-- NO es administrador: no ve dashboard, saldos, movimientos ni comprobantes de nadie más. Solo mamá otorga o quita el permiso.

alter table public.profiles add column is_helper boolean not null default false;
create trigger profiles_audit after insert or update or delete on public.profiles for each row execute function public._audit();

create function public.is_helper() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'user' and p.is_helper);
$$;

create function public.set_helper(p_user uuid, p_value boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  update public.profiles set is_helper = p_value where id = p_user and role = 'user';
  if not found then raise exception 'Usuario no encontrado'; end if;
end $$;

-- Estado de registro de la familia SIN dinero: lo único que ve un ayudante.
create function public.family_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or public.is_helper()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'owner_key', a.owner_key, 'display_name', p.display_name, 'is_helper', p.is_helper,
             'user_id', case when public.is_admin() then p.id end) order by a.owner_key desc)
      from public.accounts a join public.profiles p on p.id = a.user_id), '[]'::jsonb);
end $$;

revoke all on function public.is_helper(), public.set_helper(uuid, boolean), public.family_status() from public, anon;
grant execute on function public.is_helper(), public.set_helper(uuid, boolean), public.family_status() to authenticated;
