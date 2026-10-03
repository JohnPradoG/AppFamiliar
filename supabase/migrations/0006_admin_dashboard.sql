-- AppFamiliar · 0006 · Métricas del dashboard de mamá (solo admin). Fechas inclusivas; null = sin límite.

create function public.admin_dashboard(p_from date default null, p_to date default null) returns jsonb
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
    'managed_balance', coalesce((select sum(balance) from public.account_balances), 0),
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
             order by a.owner_key desc)
      from public.accounts a join public.profiles p on p.id = a.user_id join public.account_balances b on b.account_id = a.id), '[]'::jsonb),
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

revoke all on function public.admin_dashboard(date, date) from public, anon;
grant execute on function public.admin_dashboard(date, date) to authenticated;
