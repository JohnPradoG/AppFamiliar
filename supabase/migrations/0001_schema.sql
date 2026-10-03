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
