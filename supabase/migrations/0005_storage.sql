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
