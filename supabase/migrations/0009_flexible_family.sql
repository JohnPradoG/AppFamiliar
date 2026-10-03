-- AppFamiliar · 0009 · Familia flexible: cualquier número de hijos con nombre propio; mamá puede renombrar y quitar (desactivar).
-- "Quitar" NUNCA borra dinero: corta el acceso de la persona y conserva todo su historial (mamá lo sigue viendo y puede reactivarla).

-- La clave ya no es fija (john/brother): es un identificador corto generado desde el nombre.
alter table public.accounts    drop constraint accounts_owner_key_check;
alter table public.invitations drop constraint invitations_owner_key_check;
alter table public.accounts    add constraint accounts_owner_key_format    check (owner_key ~ '^[a-z0-9][a-z0-9-]{0,39}$');
alter table public.invitations add constraint invitations_owner_key_format check (owner_key ~ '^[a-z0-9][a-z0-9-]{0,39}$');

alter table public.profiles add column active boolean not null default true;

-- Una persona desactivada no ve NADA (ni su perfil, cuenta, movimientos, comprobantes ni notificaciones).
create or replace function public.owns_account(p_account uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.accounts a join public.profiles p on p.id = a.user_id
                  where a.id = p_account and a.user_id = auth.uid() and p.active);
$$;
create or replace function public.is_helper() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'user' and p.is_helper and p.active);
$$;

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ((id = auth.uid() and active) or public.is_admin());
drop policy accounts_select on public.accounts;
create policy accounts_select on public.accounts for select to authenticated
  using ((user_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active)) or public.is_admin());
drop policy notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active));
drop policy notifications_mark_read on public.notifications;
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active))
  with check (user_id = auth.uid());

create function public.rename_member(p_user uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Escriba el nombre.'; end if;
  update public.profiles set display_name = btrim(p_name) where id = p_user and role = 'user';
  if not found then raise exception 'Usuario no encontrado'; end if;
end $$;

-- Quitar (p_active = false) o reactivar. Si la cuenta tiene saldo, hay que confirmar (p_force).
create function public.set_member_active(p_user uuid, p_active boolean, p_force boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare v_balance bigint;
begin
  perform public._require_admin();
  if not exists (select 1 from public.profiles where id = p_user and role = 'user') then raise exception 'Usuario no encontrado'; end if;
  if not p_active and not p_force then
    select b.balance into v_balance from public.account_balances b where b.user_id = p_user;
    if coalesce(v_balance, 0) <> 0 then
      raise exception 'Saldo pendiente: la cuenta tiene % . Confirme para quitarla igualmente.', v_balance;
    end if;
  end if;
  update public.profiles set active = p_active, is_helper = case when p_active then is_helper else false end where id = p_user;
end $$;

-- Estado de la familia SIN dinero (mamá y ayudantes).
create or replace function public.family_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or public.is_helper()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'owner_key', a.owner_key, 'display_name', p.display_name, 'is_helper', p.is_helper, 'active', p.active,
             'user_id', case when public.is_admin() then p.id end) order by p.display_name)
      from public.accounts a join public.profiles p on p.id = a.user_id), '[]'::jsonb);
end $$;

-- Dashboard: solo cuentas activas.
create or replace function public.admin_dashboard(p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_inc bigint; v_alloc bigint;
begin
  perform public._require_admin();

  select coalesce(sum(i.amount), 0) into v_inc from public.incomes i
   where i.deleted_at is null and (p_from is null or i.income_date >= p_from) and (p_to is null or i.income_date <= p_to);
  select coalesce(sum(m.signed_amount), 0) into v_alloc from public.account_movements m
    join public.incomes i on i.id = m.income_id and i.deleted_at is null
   where m.deleted_at is null and (p_from is null or i.income_date >= p_from) and (p_to is null or i.income_date <= p_to);

  return jsonb_build_object(
    'total_machine_income', v_inc,
    'unassigned_income', v_inc - v_alloc,
    'total_transferred', coalesce((select -sum(m.signed_amount) from public.account_movements m
        where m.kind = 'transfer' and m.deleted_at is null
          and (p_from is null or m.movement_date >= p_from) and (p_to is null or m.movement_date <= p_to)), 0),
    'managed_balance', coalesce((select sum(b.balance) from public.account_balances b join public.profiles p on p.id = b.user_id where p.active), 0),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'account_id', a.id, 'owner_key', a.owner_key, 'display_name', p.display_name,
               'balance', b.balance,
               'assigned', coalesce((select sum(m.signed_amount) from public.account_movements m
                    where m.account_id = a.id and m.deleted_at is null and m.signed_amount > 0 and m.kind <> 'correction'
                      and (p_from is null or m.movement_date >= p_from) and (p_to is null or m.movement_date <= p_to)), 0),
               'transferred', coalesce((select -sum(m.signed_amount) from public.account_movements m
                    where m.account_id = a.id and m.deleted_at is null and m.kind = 'transfer'
                      and (p_from is null or m.movement_date >= p_from) and (p_to is null or m.movement_date <= p_to)), 0))
             order by p.display_name)
      from public.accounts a join public.profiles p on p.id = a.user_id join public.account_balances b on b.account_id = a.id
     where p.active), '[]'::jsonb),
    'machines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', ma.id, 'name', ma.name, 'description', ma.description, 'active', ma.active,
               'total', coalesce((select sum(i.amount) from public.incomes i
                    where i.machine_id = ma.id and i.deleted_at is null
                      and (p_from is null or i.income_date >= p_from) and (p_to is null or i.income_date <= p_to)), 0))
             order by ma.active desc, lower(ma.name))
      from public.machines ma), '[]'::jsonb)
  );
end $$;


revoke all on function public.rename_member(uuid, text), public.set_member_active(uuid, boolean, boolean) from public, anon;
grant execute on function public.rename_member(uuid, text), public.set_member_active(uuid, boolean, boolean) to authenticated;
