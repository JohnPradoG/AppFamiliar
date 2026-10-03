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
