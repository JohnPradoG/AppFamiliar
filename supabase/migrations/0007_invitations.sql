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
