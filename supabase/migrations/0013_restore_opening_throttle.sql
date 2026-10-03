-- AppFamiliar · 0013 · Restaurar eliminados, saldo inicial por cuenta y límite de intentos al canjear invitaciones.

-- ───────── Restaurar ─────────
create function public.restore_movement(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_m public.account_movements;
begin
  perform public._require_admin();
  perform public._set_reason(p_reason);
  select * into v_m from public.account_movements where id = p_id and deleted_at is not null for update;
  if not found then raise exception 'Movimiento no encontrado o no está eliminado'; end if;
  if v_m.income_id is not null then raise exception 'Este movimiento viene de un ingreso: restaure el ingreso'; end if;
  update public.account_movements set deleted_at = null, deleted_by = null where id = p_id;
end $$;

-- Restaura el ingreso y SOLO las asignaciones que se eliminaron junto con él (no las que se quitaron antes al editar).
create function public.restore_income(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_i public.incomes;
begin
  perform public._require_admin();
  perform public._set_reason(p_reason);
  select * into v_i from public.incomes where id = p_id and deleted_at is not null for update;
  if not found then raise exception 'Ingreso no encontrado o no está eliminado'; end if;
  if not exists (select 1 from public.machines where id = v_i.machine_id) then raise exception 'La máquina ya no existe'; end if;
  update public.incomes set deleted_at = null, deleted_by = null where id = p_id;
  update public.account_movements set deleted_at = null, deleted_by = null
   where income_id = p_id and deleted_at = v_i.deleted_at;
end $$;

-- delete_income marca el ingreso y sus asignaciones con UNA marca de tiempo exacta y única (clock_timestamp),
-- para que restore_income reconozca cuáles se eliminaron juntas (y no reviva las que se quitaron antes al editar).
create or replace function public.delete_income(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_ts timestamptz := clock_timestamp();
begin
  perform public._require_admin();
  perform public._set_reason(p_reason);
  update public.incomes set deleted_at = v_ts, deleted_by = auth.uid() where id = p_id and deleted_at is null;
  if not found then raise exception 'Ingreso no encontrado'; end if;
  update public.account_movements set deleted_at = v_ts, deleted_by = auth.uid() where income_id = p_id and deleted_at is null;
end $$;

-- Avisar al hijo cuando se restaura un movimiento suyo.
create or replace function public._notify_movement() returns trigger
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
  elsif old.deleted_at is not null and new.deleted_at is null then
    v_title := 'Movimiento restaurado';
    v_body := 'Se restauró un movimiento de tu cuenta (' || public._cop(new.signed_amount) || ').';
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

-- ───────── Saldo inicial ─────────
create trigger accounts_audit after update on public.accounts for each row execute function public._audit();

create function public.set_opening_balance(p_account uuid, p_amount bigint, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  perform public._set_reason(p_reason);
  if p_amount is null then raise exception 'Escriba el saldo inicial.'; end if;
  update public.accounts set opening_balance = p_amount where id = p_account;
  if not found then raise exception 'Cuenta no encontrada'; end if;
end $$;

-- ───────── Límite de intentos al canjear invitaciones (solo service_role) ─────────
create table public.invite_failures (
  id bigint generated always as identity primary key,
  at timestamptz not null default now()
);
alter table public.invite_failures enable row level security;
alter table public.invite_failures force row level security;
revoke all on public.invite_failures from anon, authenticated;

revoke all on function public.restore_movement(uuid, text), public.restore_income(uuid, text), public.set_opening_balance(uuid, bigint, text) from public, anon;
grant execute on function public.restore_movement(uuid, text), public.restore_income(uuid, text), public.set_opening_balance(uuid, bigint, text) to authenticated;
