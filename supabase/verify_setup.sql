-- AppFamiliar · VERIFICACIÓN. Pegar en Supabase → SQL Editor → Run, DESPUÉS de cargar setup_all.sql.
-- Solo lee: no cambia nada. Devuelve una fila por comprobación con OK o FALLA.

with checks(orden, comprobacion, ok) as (
  values
  (1, 'Existen las 10 tablas de la app',
      (select count(*) = 10 from information_schema.tables where table_schema = 'public'
        and table_name in ('profiles','accounts','machines','incomes','account_movements','receipts','notifications','audit_logs','invitations','invite_failures'))),
  (2, 'Seguridad (RLS) activada y forzada en TODAS las tablas',
      not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relkind = 'r' and not (c.relrowsecurity and c.relforcerowsecurity))),
  (3, 'Los usuarios no pueden escribir directo en ninguna tabla',
      not exists (select 1 from information_schema.role_table_grants
                   where table_schema = 'public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE'))),
  (4, 'Usuarios anónimos sin ningún permiso',
      not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon')),
  (5, 'Funciones de la app creadas (registrar ingresos, transferir, editar, restaurar…)',
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in ('register_income','add_balance','register_transfer','register_correction','update_movement','delete_movement',
          'update_income','delete_income','restore_movement','restore_income','attach_receipt','account_summary','admin_dashboard','family_status',
          'set_helper','rename_member','set_member_active','set_opening_balance','mark_notifications_read','create_machine','update_machine')) = 21),
  (6, 'Funciones SECURITY DEFINER con search_path fijo',
      not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.prosecdef and not coalesce(p.proconfig::text ilike '%search_path=%', false))),
  (7, 'Máquinas iniciales: Wild y Máquina Multijuegos (activas)',
      (select count(*) = 2 from public.machines where name in ('Wild','Máquina Multijuegos') and active)),
  (8, 'Bucket privado de comprobantes "receipts" (no público)',
      exists (select 1 from storage.buckets where id = 'receipts' and public = false)),
  (9, 'Auditoría protegida (nadie la edita ni la borra)',
      (select count(*) = 2 from pg_trigger t join pg_class c on c.oid = t.tgrelid
        where c.relname = 'audit_logs' and t.tgname in ('audit_logs_immutable','audit_logs_no_truncate'))),
  (10, 'Solo puede existir UNA administradora',
      exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'profiles_single_admin')),
  (12, 'Ninguna función de la app está abierta a usuarios anónimos',
      not exists (select 1 from information_schema.role_routine_grants where routine_schema = 'public' and grantee in ('anon','PUBLIC'))),
  (11, 'Mamá ya está dada de alta (corra provision_admin.sql)',
      (select count(*) = 1 from public.profiles where role = 'admin'))
)
select orden as n,
       case when ok then 'OK   ' else 'FALLA' end as resultado,
       comprobacion
  from checks
 order by case when orden = 11 then 99 else orden end;   -- la de mamá va al final
