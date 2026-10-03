-- AppFamiliar · 0003 · Triggers: marca de modificación, auditoría y notificaciones.
-- Viven en triggers (no en la app) para que NINGUNA vía de escritura se salte el registro.

create function public._touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger machines_touch  before update on public.machines          for each row execute function public._touch();
create trigger incomes_touch   before update on public.incomes           for each row execute function public._touch();
create trigger movements_touch before update on public.account_movements for each row execute function public._touch();

create function public._audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_action text;
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
begin
  v_action := lower(tg_op);
  if tg_op = 'UPDATE' and (v_old->>'deleted_at') is null and (v_new->>'deleted_at') is not null then
    v_action := 'delete';
  end if;
  insert into public.audit_logs (table_name, record_id, action, old_data, new_data, reason, actor_id)
  values (tg_table_name, coalesce((v_new->>'id'), (v_old->>'id'))::uuid, v_action, v_old, v_new,
          nullif(current_setting('app.audit_reason', true), ''), auth.uid());
  return coalesce(new, old);
end $$;

create trigger machines_audit  after insert or update or delete on public.machines          for each row execute function public._audit();
create trigger incomes_audit   after insert or update or delete on public.incomes           for each row execute function public._audit();
create trigger movements_audit after insert or update or delete on public.account_movements for each row execute function public._audit();
create trigger receipts_audit  after insert or update or delete on public.receipts          for each row execute function public._audit();

create function public._cop(p_amount bigint) returns text
language sql immutable set search_path = '' as $$
  select '$' || replace(to_char(abs(p_amount), 'FM999,999,999,999'), ',', '.');
$$;

create function public._notify_movement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_title text;
  v_body text;
begin
  select a.user_id into v_user from public.accounts a where a.id = new.account_id;

  if tg_op = 'INSERT' then
    v_title := 'Tu saldo fue actualizado';
    v_body := case new.kind
      when 'transfer'       then 'Mamá registró una transferencia de ' || public._cop(new.signed_amount) || ' a tu cuenta.'
      when 'credit'         then 'Mamá agregó ' || public._cop(new.signed_amount) || ' a tu cuenta.'
      when 'machine_income' then 'Mamá te asignó ' || public._cop(new.signed_amount) || ' de ingresos de máquina.'
      else 'Mamá registró una corrección de ' || public._cop(new.signed_amount) || ' en tu cuenta.'
    end;
  elsif old.deleted_at is null and new.deleted_at is not null then
    v_title := 'Movimiento eliminado';
    v_body := 'Se eliminó un movimiento de tu cuenta (' || public._cop(old.signed_amount) || ').';
  elsif old.signed_amount is distinct from new.signed_amount
     or old.movement_date is distinct from new.movement_date
     or old.concept is distinct from new.concept then
    v_title := 'Movimiento modificado';
    v_body := 'Se modificó un movimiento de tu cuenta.';
  else
    return new;
  end if;

  insert into public.notifications (user_id, title, body, movement_id) values (v_user, v_title, v_body, new.id);
  return new;
end $$;

create trigger movements_notify after insert or update on public.account_movements
  for each row execute function public._notify_movement();
