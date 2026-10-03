-- AppFamiliar · 0004 · Funciones RPC. ÚNICA vía de escritura. Todas exigen ser mamá (admin).

create function public._require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create function public._set_reason(p_reason text) returns void
language plpgsql set search_path = '' as $$
begin
  perform set_config('app.audit_reason', coalesce(p_reason, ''), true);
end $$;

-- ───────── Máquinas ─────────
create function public.create_machine(p_name text, p_description text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public._require_admin();
  insert into public.machines (name, description, created_by, updated_by)
  values (btrim(p_name), p_description, auth.uid(), auth.uid()) returning id into v_id;
  return v_id;
end $$;

create function public.update_machine(p_id uuid, p_name text, p_description text, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  update public.machines set name = btrim(p_name), description = p_description, active = p_active where id = p_id;
  if not found then raise exception 'Máquina no encontrada'; end if;
end $$;

-- ───────── Ingresos de máquina + asignación a cuentas ─────────
-- p_allocations: [{"account_id": "...", "amount": 150000}, ...]. Lo no asignado queda sin afectar ningún saldo.
create function public._sync_allocations(p_income uuid, p_alloc jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_inc public.incomes;
  v_total bigint := 0;
  r record;
begin
  select * into v_inc from public.incomes where id = p_income;

  if jsonb_typeof(p_alloc) <> 'array' then raise exception 'Asignaciones inválidas'; end if;
  if (select count(distinct x->>'account_id') from jsonb_array_elements(p_alloc) x) <> jsonb_array_length(p_alloc) then
    raise exception 'Una cuenta aparece repetida en la asignación';
  end if;

  for r in select (x->>'account_id')::uuid as account_id, (x->>'amount')::bigint as amount from jsonb_array_elements(p_alloc) x loop
    if r.amount is null or r.amount <= 0 then raise exception 'Cada monto asignado debe ser mayor que cero'; end if;
    if not exists (select 1 from public.accounts where id = r.account_id) then raise exception 'Cuenta no encontrada'; end if;
    v_total := v_total + r.amount;
  end loop;
  if v_total > v_inc.amount then
    raise exception 'Lo asignado (%) supera el ingreso (%)', v_total, v_inc.amount;
  end if;

  -- Quitar asignaciones que ya no están.
  update public.account_movements m set deleted_at = now(), deleted_by = auth.uid()
   where m.income_id = p_income and m.deleted_at is null
     and m.account_id not in (select (x->>'account_id')::uuid from jsonb_array_elements(p_alloc) x);

  for r in select (x->>'account_id')::uuid as account_id, (x->>'amount')::bigint as amount from jsonb_array_elements(p_alloc) x loop
    update public.account_movements
       set signed_amount = r.amount, movement_date = v_inc.income_date, concept = v_inc.description, machine_id = v_inc.machine_id
     where income_id = p_income and account_id = r.account_id and deleted_at is null
       and (signed_amount, movement_date, concept) is distinct from (r.amount, v_inc.income_date, v_inc.description);
    if not exists (select 1 from public.account_movements where income_id = p_income and account_id = r.account_id and deleted_at is null) then
      insert into public.account_movements (account_id, kind, origin, income_id, machine_id, signed_amount, movement_date, concept, created_by, updated_by)
      values (r.account_id, 'machine_income', 'machine', p_income, v_inc.machine_id, r.amount, v_inc.income_date, v_inc.description, auth.uid(), auth.uid());
    end if;
  end loop;
end $$;

create function public.register_income(p_machine uuid, p_date date, p_amount bigint,
                                       p_description text default null, p_allocations jsonb default '[]'::jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public._require_admin();
  if p_amount is null or p_amount <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;
  if not exists (select 1 from public.machines where id = p_machine and active) then
    raise exception 'La máquina no existe o está desactivada';
  end if;
  insert into public.incomes (machine_id, income_date, amount, description, created_by, updated_by)
  values (p_machine, p_date, p_amount, p_description, auth.uid(), auth.uid()) returning id into v_id;
  perform public._sync_allocations(v_id, p_allocations);
  return v_id;
end $$;

-- Si p_allocations es null: una asignación que cubría TODO el ingreso sigue al nuevo monto;
-- las demás se conservan y se valida que no superen el nuevo total.
create function public.update_income(p_id uuid, p_date date, p_amount bigint, p_description text,
                                     p_allocations jsonb default null, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.incomes;
  v_alloc jsonb := p_allocations;
begin
  perform public._require_admin();
  perform public._set_reason(p_reason);
  if p_amount is null or p_amount <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;
  select * into v_old from public.incomes where id = p_id and deleted_at is null for update;
  if not found then raise exception 'Ingreso no encontrado'; end if;

  if v_alloc is null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'account_id', m.account_id,
             'amount', case when n.cnt = 1 and m.signed_amount = v_old.amount then p_amount else m.signed_amount end)), '[]'::jsonb)
      into v_alloc
      from public.account_movements m,
           lateral (select count(*) as cnt from public.account_movements x where x.income_id = p_id and x.deleted_at is null) n
     where m.income_id = p_id and m.deleted_at is null;
  end if;

  update public.incomes set income_date = p_date, amount = p_amount, description = p_description where id = p_id;
  perform public._sync_allocations(p_id, v_alloc);
end $$;

create function public.delete_income(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  perform public._set_reason(p_reason);
  update public.incomes set deleted_at = now(), deleted_by = auth.uid() where id = p_id and deleted_at is null;
  if not found then raise exception 'Ingreso no encontrado'; end if;
  update public.account_movements set deleted_at = now(), deleted_by = auth.uid() where income_id = p_id and deleted_at is null;
end $$;

-- ───────── Saldo directo, transferencias y correcciones ─────────
create function public.add_balance(p_account uuid, p_amount bigint, p_date date, p_origin text,
                                   p_origin_detail text default null, p_machine uuid default null,
                                   p_concept text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public._require_admin();
  if p_amount is null or p_amount <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;
  if p_origin not in ('machine','work','other','custom') then raise exception 'Origen inválido'; end if;
  insert into public.account_movements (account_id, kind, origin, origin_detail, machine_id, signed_amount, movement_date, concept, created_by, updated_by)
  values (p_account, 'credit', p_origin, p_origin_detail, p_machine, p_amount, p_date, p_concept, auth.uid(), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Una transferencia no puede dejar la cuenta en negativo (a menos que mamá lo autorice explícitamente).
create function public.register_transfer(p_account uuid, p_amount bigint, p_date date, p_concept text default null,
                                         p_allow_overdraft boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_balance bigint;
begin
  perform public._require_admin();
  if p_amount is null or p_amount <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;
  perform 1 from public.accounts where id = p_account for update;   -- serializa operaciones por cuenta
  if not found then raise exception 'Cuenta no encontrada'; end if;
  select balance into v_balance from public.account_balances where account_id = p_account;
  if v_balance < p_amount and not p_allow_overdraft then
    raise exception 'Saldo insuficiente: la cuenta tiene % y se intenta transferir %', v_balance, p_amount;
  end if;
  insert into public.account_movements (account_id, kind, origin, signed_amount, movement_date, concept, created_by, updated_by)
  values (p_account, 'transfer', 'transfer', -p_amount, p_date, p_concept, auth.uid(), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- p_signed_amount: positivo suma, negativo resta.
create function public.register_correction(p_account uuid, p_signed_amount bigint, p_date date, p_concept text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public._require_admin();
  if p_signed_amount is null or p_signed_amount = 0 then raise exception 'El monto no puede ser cero'; end if;
  if length(btrim(coalesce(p_concept,''))) = 0 then raise exception 'Una corrección necesita una explicación'; end if;
  insert into public.account_movements (account_id, kind, origin, signed_amount, movement_date, concept, created_by, updated_by)
  values (p_account, 'correction', 'correction', p_signed_amount, p_date, p_concept, auth.uid(), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- ───────── Editar / eliminar (lógico) ─────────
-- p_amount: magnitud positiva (saldo agregado y transferencia); con signo (corrección).
-- Los movimientos que vienen de un ingreso se editan con update_income.
create function public.update_movement(p_id uuid, p_amount bigint, p_date date, p_concept text, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_m public.account_movements;
begin
  perform public._require_admin();
  perform public._set_reason(p_reason);
  select * into v_m from public.account_movements where id = p_id and deleted_at is null for update;
  if not found then raise exception 'Movimiento no encontrado'; end if;
  if v_m.income_id is not null then raise exception 'Este movimiento viene de un ingreso: edite el ingreso'; end if;
  if p_amount is null or p_amount = 0 or (v_m.kind <> 'correction' and p_amount < 0) then
    raise exception 'Monto inválido';
  end if;
  update public.account_movements
     set signed_amount = case v_m.kind when 'transfer' then -p_amount else p_amount end,
         movement_date = p_date, concept = p_concept
   where id = p_id;
end $$;

create function public.delete_movement(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_m public.account_movements;
begin
  perform public._require_admin();
  perform public._set_reason(p_reason);
  select * into v_m from public.account_movements where id = p_id and deleted_at is null for update;
  if not found then raise exception 'Movimiento no encontrado'; end if;
  if v_m.income_id is not null then raise exception 'Este movimiento viene de un ingreso: edite o elimine el ingreso'; end if;
  update public.account_movements set deleted_at = now(), deleted_by = auth.uid() where id = p_id;
end $$;

-- ───────── Comprobantes ─────────
-- El archivo se sube a Storage en la ruta  <account_id>/<movement_id>/<archivo>  y luego se registra aquí.
create function public.attach_receipt(p_movement uuid, p_path text, p_mime text, p_size bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_m public.account_movements; v_id uuid;
begin
  perform public._require_admin();
  select * into v_m from public.account_movements where id = p_movement and deleted_at is null;
  if not found then raise exception 'Movimiento no encontrado'; end if;
  if p_path not like v_m.account_id::text || '/' || v_m.id::text || '/%' then
    raise exception 'La ruta del comprobante no corresponde al movimiento';
  end if;
  insert into public.receipts (movement_id, storage_path, mime_type, size_bytes, uploaded_by)
  values (p_movement, p_path, p_mime, p_size, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create function public.delete_receipt(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  perform public._set_reason(p_reason);
  update public.receipts set deleted_at = now(), deleted_by = auth.uid() where id = p_id and deleted_at is null;
  if not found then raise exception 'Comprobante no encontrado'; end if;
end $$;

-- ───────── Lectura agregada ─────────
-- Resumen de UNA cuenta. Mamá puede pedir cualquiera; un hijo solo la suya.
create function public.account_summary(p_account uuid, p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not (public.is_admin() or public.owns_account(p_account)) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'account_id', a.id,
    'balance', (select balance from public.account_balances b where b.account_id = a.id),
    'opening_balance', a.opening_balance,
    'total_income',    coalesce((select sum(m.signed_amount) from public.account_movements m
                                  where m.account_id = a.id and m.deleted_at is null and m.signed_amount > 0 and m.kind <> 'correction'
                                    and (p_from is null or m.movement_date >= p_from) and (p_to is null or m.movement_date <= p_to)), 0),
    'total_received',  coalesce((select -sum(m.signed_amount) from public.account_movements m
                                  where m.account_id = a.id and m.deleted_at is null and m.kind = 'transfer'
                                    and (p_from is null or m.movement_date >= p_from) and (p_to is null or m.movement_date <= p_to)), 0),
    'by_origin',       coalesce((select jsonb_agg(jsonb_build_object('origin', o.origin, 'total', o.total) order by o.origin)
                                   from (select m.origin, sum(m.signed_amount) as total from public.account_movements m
                                          where m.account_id = a.id and m.deleted_at is null
                                          group by m.origin) o), '[]'::jsonb),
    'last_movement',   (select jsonb_build_object('id', m.id, 'kind', m.kind, 'signed_amount', m.signed_amount, 'movement_date', m.movement_date)
                          from public.account_movements m where m.account_id = a.id and m.deleted_at is null
                         order by m.movement_date desc, m.created_at desc limit 1)
  ) into v_result
  from public.accounts a where a.id = p_account;

  return v_result;
end $$;

-- Permisos de ejecución: solo usuarios autenticados (cada función valida el rol por dentro).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
