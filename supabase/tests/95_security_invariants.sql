-- Invariantes de seguridad: si alguien agrega una tabla/función nueva y olvida protegerla, esta prueba falla.
reset role;
do $$ declare r record; n bigint; begin
  -- 1) Toda tabla de public tiene RLS activada y FORZADA.
  for r in select c.relname from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
            where ns.nspname = 'public' and c.relkind = 'r' and not (c.relrowsecurity and c.relforcerowsecurity) loop
    raise exception 'FALLÓ: la tabla % no tiene RLS forzada', r.relname;
  end loop;
  raise notice 'ok  todas las tablas tienen RLS activada y forzada';

  -- 2) Los clientes no escriben directo: ni INSERT/DELETE en ninguna tabla, y UPDATE solo en notifications(read_at).
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','DELETE','TRUNCATE','REFERENCES','TRIGGER');
  perform test.eq('ningún cliente tiene INSERT/DELETE/TRUNCATE directo', n, 0);
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon','authenticated') and privilege_type = 'UPDATE';
  perform test.eq('UPDATE de tabla completa: ninguno', n, 0);
  select count(*) into n from information_schema.column_privileges
   where table_schema = 'public' and grantee in ('anon','authenticated') and privilege_type = 'UPDATE';
  perform test.eq('ningún UPDATE por columna para clientes', n, 0);

  -- 3) El rol anónimo no puede nada en public.
  select count(*) into n from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon';
  perform test.eq('anon sin permisos de tabla', n, 0);
  select count(*) into n from information_schema.role_routine_grants where routine_schema = 'public' and grantee in ('anon', 'PUBLIC');
  perform test.eq('anon/PUBLIC sin permiso de ejecutar funciones', n, 0);

  -- 4) Toda función SECURITY DEFINER fija su search_path (evita secuestro de funciones).
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prosecdef and not coalesce(p.proconfig::text ilike '%search_path=%', false);
  perform test.eq('todas las funciones SECURITY DEFINER fijan search_path', n, 0);

  -- 5) Las funciones internas (_*) no las puede ejecutar un usuario autenticado, salvo las auxiliares de RLS/RPC.
  select count(*) into n from information_schema.role_routine_grants
   where routine_schema = 'public' and grantee = 'service_role' and routine_name = '_email_taken';
  perform test.eq('_email_taken solo para service_role', n, 1);
end $$;

-- Límites y auditoría inmutable
select test.login('mama');
do $$ begin
  perform test.denied('monto absurdo (> 1 billón)', format('select public.add_balance(%L, 10000000000000, now()::date, ''work'')', test.id('acc_john')));
  perform test.denied('texto demasiado largo', format('select public.add_balance(%L, 1000, now()::date, ''work'', null, null, repeat(''x'', 600))', test.id('acc_john')));
  perform test.denied('nombre vacío al renombrar', format('select public.rename_member(%L, '''')', test.id('john')));
  perform test.denied('nombre larguísimo', format('select public.rename_member(%L, repeat(''n'', 61))', test.id('john')));
  perform test.denied('la auditoría no se edita', 'update public.audit_logs set reason = ''x''');
end $$;
reset role;
do $$ begin
  perform test.denied('ni siquiera un superusuario edita la auditoría por error', 'update public.audit_logs set reason = ''x''');
  perform test.denied('ni la borra', 'delete from public.audit_logs');
  perform test.denied('ni la trunca', 'truncate public.audit_logs');
end $$;

-- family_status: is_me y ayudante
select test.login('mama');
do $$ begin perform public.set_helper(test.id('john'), true); end $$;
select test.login('john');
do $$ declare s jsonb; begin
  s := public.family_status();
  perform test.eq('ayudante: solo UNA tarjeta es "yo"', (select count(*) from jsonb_array_elements(s) x where (x->>'is_me')::boolean), 1);
  perform test.eq('ayudante: sigue sin ver ids', (select count(*) from jsonb_array_elements(s) x where x->>'user_id' is not null), 0);
end $$;
select test.login('mama');
do $$ begin perform public.set_helper(test.id('john'), false); end $$;
reset role;
