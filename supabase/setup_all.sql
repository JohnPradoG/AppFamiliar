-- AppFamiliar · TODA la base de datos en un solo archivo (migraciones 0001–0012 juntas).
-- Pegar completo en Supabase → SQL Editor → New query → Run. Se ejecuta UNA sola vez.
-- Generado por scripts/build-setup.sh: no editar a mano.

-- ═════════ 0001_schema.sql ═════════
-- AppFamiliar · 0001 · Esquema base
-- Montos en pesos enteros (bigint). El saldo NUNCA se guarda: se calcula desde account_movements.

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete restrict,
  role         text not null check (role in ('admin','user')),
  display_name text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- Solo puede existir UNA administradora.
create unique index profiles_single_admin on public.profiles(role) where role = 'admin';

create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.profiles(id) on delete restrict,
  owner_key       text not null unique check (owner_key in ('john','brother')),
  opening_balance bigint not null default 0,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id)
);

create table public.machines (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  description text,
  active      boolean not null default true,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);
create unique index machines_name_unique on public.machines (lower(btrim(name)));

-- Ingreso de una máquina. NO afecta ningún saldo hasta que se asigna a una cuenta.
create table public.incomes (
  id          uuid primary key default gen_random_uuid(),
  machine_id  uuid not null references public.machines(id),
  income_date date not null,
  amount      bigint not null check (amount > 0),
  description text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now(),
  deleted_by  uuid references public.profiles(id),
  deleted_at  timestamptz,
  status      text generated always as (case when deleted_at is null then 'active' else 'deleted' end) stored
);
create index incomes_machine_date on public.incomes (machine_id, income_date) where deleted_at is null;

-- Libro mayor de cada cuenta. Una fila = un movimiento con signo (+ entra / − sale).
create table public.account_movements (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.accounts(id) on delete restrict,
  kind          text not null check (kind in ('machine_income','credit','transfer','correction')),
  origin        text not null check (origin in ('machine','work','other','custom','transfer','correction')),
  origin_detail text,
  income_id     uuid references public.incomes(id),
  machine_id    uuid references public.machines(id),
  signed_amount bigint not null check (signed_amount <> 0),
  movement_date date not null,
  concept       text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id),
  updated_at    timestamptz not null default now(),
  deleted_by    uuid references public.profiles(id),
  deleted_at    timestamptz,
  -- El signo siempre es coherente con el tipo.
  constraint movement_sign_ok check (
    (kind in ('machine_income','credit') and signed_amount > 0) or
    (kind = 'transfer' and signed_amount < 0) or
    (kind = 'correction')
  ),
  constraint movement_income_link check ((kind = 'machine_income') = (income_id is not null)),
  constraint movement_origin_ok check (
    (kind = 'machine_income' and origin = 'machine') or
    (kind = 'transfer'       and origin = 'transfer') or
    (kind = 'correction'     and origin = 'correction') or
    (kind = 'credit'         and origin in ('machine','work','other','custom'))
  ),
  constraint movement_custom_detail check (origin <> 'custom' or length(btrim(coalesce(origin_detail,''))) > 0)
);
create index movements_account_date on public.account_movements (account_id, movement_date desc) where deleted_at is null;
create unique index movements_one_per_income_account
  on public.account_movements (income_id, account_id) where income_id is not null and deleted_at is null;

create table public.receipts (
  id           uuid primary key default gen_random_uuid(),
  movement_id  uuid not null references public.account_movements(id) on delete restrict,
  storage_path text not null unique,
  mime_type    text not null check (mime_type in ('image/jpeg','image/png','application/pdf')),
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by  uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  deleted_by   uuid references public.profiles(id),
  deleted_at   timestamptz
);
create index receipts_movement on public.receipts (movement_id) where deleted_at is null;

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  body        text not null,
  movement_id uuid references public.account_movements(id),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index notifications_user_unread on public.notifications (user_id, created_at desc);

create table public.audit_logs (
  id         bigint generated always as identity primary key,
  table_name text not null,
  record_id  uuid not null,
  action     text not null check (action in ('insert','update','delete')),  -- delete = borrado lógico
  old_data   jsonb,
  new_data   jsonb,
  reason     text,
  actor_id   uuid,
  at         timestamptz not null default now()
);
create index audit_record on public.audit_logs (table_name, record_id, at desc);

-- Saldo = apertura + suma de movimientos activos. Con security_invoker, RLS aplica al usuario que consulta.
create view public.account_balances with (security_invoker = true) as
select a.id as account_id,
       a.user_id,
       a.owner_key,
       a.opening_balance,
       coalesce(sum(m.signed_amount) filter (where m.deleted_at is null), 0)::bigint as movements_total,
       (a.opening_balance + coalesce(sum(m.signed_amount) filter (where m.deleted_at is null), 0))::bigint as balance
from public.accounts a
left join public.account_movements m on m.account_id = a.id
group by a.id;

-- ═════════ 0002_security_rls.sql ═════════
-- AppFamiliar · 0002 · Seguridad: RLS + permisos mínimos.
-- Regla: los clientes SOLO LEEN tablas (filtrado por RLS). TODA escritura pasa por funciones RPC (0004).

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create function public.owns_account(p_account uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.accounts a where a.id = p_account and a.user_id = auth.uid());
$$;

-- Sin permisos por defecto: ni anónimos ni autenticados escriben directo en ninguna tabla.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant select on public.profiles, public.accounts, public.machines, public.incomes,
                public.account_movements, public.receipts, public.notifications,
                public.audit_logs, public.account_balances to authenticated;
grant update (read_at) on public.notifications to authenticated;  -- solo marcar como leída

alter table public.profiles          enable row level security;
alter table public.accounts          enable row level security;
alter table public.machines          enable row level security;
alter table public.incomes           enable row level security;
alter table public.account_movements enable row level security;
alter table public.receipts          enable row level security;
alter table public.notifications     enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.profiles          force row level security;
alter table public.accounts          force row level security;
alter table public.machines          force row level security;
alter table public.incomes           force row level security;
alter table public.account_movements force row level security;
alter table public.receipts          force row level security;
alter table public.notifications     force row level security;
alter table public.audit_logs        force row level security;

-- Perfiles: cada quien ve el suyo; mamá ve todos.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Cuentas: cada hijo ve SOLO la suya; mamá ve ambas.
create policy accounts_select on public.accounts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Movimientos: el hijo ve solo los activos de su cuenta; mamá ve todos (incluye eliminados).
create policy movements_select on public.account_movements for select to authenticated
  using (public.is_admin() or (deleted_at is null and public.owns_account(account_id)));

-- Ingresos de máquina: SOLO mamá (revelarían cómo se repartió el dinero entre hermanos).
create policy incomes_select on public.incomes for select to authenticated
  using (public.is_admin());

-- Máquinas: mamá todas; un hijo solo el nombre de máquinas que aparecen en SUS movimientos.
create policy machines_select on public.machines for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.account_movements m
               where m.machine_id = machines.id and m.deleted_at is null and public.owns_account(m.account_id))
  );

-- Comprobantes: visibles solo si el movimiento es visible para quien consulta.
create policy receipts_select on public.receipts for select to authenticated
  using (
    public.is_admin()
    or (deleted_at is null and exists (
          select 1 from public.account_movements m
          where m.id = receipts.movement_id and m.deleted_at is null and public.owns_account(m.account_id)))
  );

-- Notificaciones: solo las propias.
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Auditoría: solo mamá.
create policy audit_select on public.audit_logs for select to authenticated
  using (public.is_admin());

-- ═════════ 0003_triggers.sql ═════════
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

-- ═════════ 0004_rpc.sql ═════════
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

-- ═════════ 0005_storage.sql ═════════
-- AppFamiliar · 0005 · Bucket privado "receipts". Ruta: <account_id>/<movement_id>/<archivo>
-- Se omite si no existe el esquema storage (p. ej. pruebas sin Supabase completo).

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage no disponible: se omiten políticas de comprobantes';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('receipts', 'receipts', false, 10485760, array['image/jpeg','image/png','application/pdf'])
  on conflict (id) do update set public = false, file_size_limit = 10485760,
        allowed_mime_types = array['image/jpeg','image/png','application/pdf'];

  -- Leer: mamá, o quien pueda ver (por RLS) una fila de receipts con esa ruta.
  create policy receipts_read on storage.objects for select to authenticated
    using (bucket_id = 'receipts' and (
      public.is_admin()
      or exists (select 1 from public.receipts r where r.storage_path = storage.objects.name)));

  -- Subir / reemplazar / borrar: solo mamá.
  create policy receipts_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'receipts' and public.is_admin());
  create policy receipts_update on storage.objects for update to authenticated
    using (bucket_id = 'receipts' and public.is_admin());
  create policy receipts_delete on storage.objects for delete to authenticated
    using (bucket_id = 'receipts' and public.is_admin());
end $$;

-- ═════════ 0006_admin_dashboard.sql ═════════
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

-- ═════════ 0007_invitations.sql ═════════
-- AppFamiliar · 0007 · Invitaciones de un solo uso. Solo se guarda el HASH del código (nunca el código).
-- Se crean y se canjean únicamente desde Edge Functions (service_role).

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique,
  owner_key    text not null check (owner_key in ('john','brother')),
  kind         text not null check (kind in ('new','reset')),   -- new: primera vez · reset: enlace nuevo para quien ya tiene cuenta
  email        text not null,
  display_name text not null,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  used_at      timestamptz,
  revoked_at   timestamptz
);
create index invitations_pending on public.invitations (owner_key) where used_at is null and revoked_at is null;

alter table public.invitations enable row level security;
alter table public.invitations force row level security;
revoke all on public.invitations from anon, authenticated;
grant select on public.invitations to authenticated;
create policy invitations_select on public.invitations for select to authenticated using (public.is_admin());

-- ¿Ya existe ese correo en Auth? Solo la llama la Edge Function (service_role).
create function public._email_taken(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where lower(email) = lower(p_email));
$$;
revoke all on function public._email_taken(text) from public, anon, authenticated;
grant execute on function public._email_taken(text) to service_role;

-- ═════════ 0008_helper_role.sql ═════════
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

-- ═════════ 0009_flexible_family.sql ═════════
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

-- ═════════ 0010_hardening.sql ═════════
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

-- ═════════ 0011_notifications_rpc.sql ═════════
-- AppFamiliar · 0011 · Marcar notificaciones como leídas por función; los clientes ya no escriben NINGUNA tabla.

create function public.mark_notifications_read() returns void
language sql security definer set search_path = '' as $$
  update public.notifications n set read_at = now()
   where n.user_id = auth.uid() and n.read_at is null
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active);
$$;
revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

revoke update (read_at) on public.notifications from authenticated;
drop policy notifications_mark_read on public.notifications;

-- ═════════ 0012_default_machines.sql ═════════
-- AppFamiliar · 0012 · Máquinas iniciales de la familia: Wild y Multiusos (activas).
-- Mamá puede editarlas, desactivarlas o agregar más desde la app (Ingresos → Ver máquinas).
-- "on conflict do nothing": si ya existen (mismo nombre), no se toca nada.

insert into public.machines (name, description)
values ('Wild', 'Máquina Wild'), ('Multiusos', 'Máquina Multiusos')
on conflict (lower(btrim(name))) do nothing;
