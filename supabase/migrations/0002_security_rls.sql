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
