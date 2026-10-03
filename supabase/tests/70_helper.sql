-- Ayudante de invitaciones: puede ver el estado de registro, pero NADA de dinero.
select test.login('john');
do $$ begin
  perform test.denied('sin permiso, John no ve el estado de la familia', 'select public.family_status()');
  perform test.denied('John no puede darse el permiso', format('select public.set_helper(%L, true)', test.id('john')));
  perform test.denied('John no puede editar su perfil directo', 'update public.profiles set is_helper = true');
end $$;
select test.login('brother');
do $$ begin
  perform test.denied('el hermano no puede darse el permiso', format('select public.set_helper(%L, true)', test.id('brother')));
end $$;

select test.login('mama');
do $$ begin
  perform public.set_helper(test.id('john'), true);
  perform test.denied('mamá no puede hacerse ayudante (es admin)', format('select public.set_helper(%L, true)', test.id('mama')));
  perform test.eq('auditoría registra el permiso', (select count(*) from public.audit_logs where table_name = 'profiles' and action = 'update' and (new_data->>'is_helper')::boolean), 1);
  perform test.eq('mamá ve user_id en family_status', (select count(*) from jsonb_array_elements(public.family_status()) x where x->>'user_id' is not null), 2);
end $$;

select test.login('john');
do $$ declare s jsonb; begin
  s := public.family_status();
  perform test.eq('ayudante ve a los 2 miembros', jsonb_array_length(s), 2);
  perform test.eq('ayudante NO recibe ids de usuario', (select count(*) from jsonb_array_elements(s) x where x->>'user_id' is not null), 0);
  perform test.eq('family_status no trae dinero', (select count(*) from jsonb_array_elements(s) x where x ? 'balance'), 0);
  -- sigue sin ver nada ajeno
  perform test.eq('ayudante: sigue viendo solo su cuenta', (select count(*) from public.accounts), 1);
  perform test.eq('ayudante: no ve saldo del hermano', (select count(*) from public.account_balances where owner_key = 'brother'), 0);
  perform test.eq('ayudante: sin movimientos del hermano', (select count(*) from public.account_movements where account_id = test.id('acc_brother')), 0);
  perform test.eq('ayudante: no ve invitaciones', (select count(*) from public.invitations), 0);
  perform test.eq('ayudante: no ve perfiles ajenos', (select count(*) from public.profiles where id <> test.id('john')), 0);
  perform test.denied('ayudante no ve dashboard de mamá', 'select public.admin_dashboard()');
  perform test.denied('ayudante no ve resumen de la cuenta del hermano', format('select public.account_summary(%L)', test.id('acc_brother')));
  perform test.denied('ayudante no registra dinero', format('select public.add_balance(%L, 1000, now()::date, ''other'')', test.id('acc_john')));
  perform test.denied('ayudante no quita permisos', format('select public.set_helper(%L, false)', test.id('john')));
end $$;
select test.login('brother');
do $$ begin
  perform test.denied('el hermano (sin permiso) no ve el estado de la familia', 'select public.family_status()');
end $$;
select test.login('mama');
do $$ begin
  perform public.set_helper(test.id('john'), false);
end $$;
select test.login('john');
do $$ begin
  perform test.denied('al quitar el permiso, se pierde el acceso', 'select public.family_status()');
end $$;
reset role;
