-- Familia flexible: renombrar, quitar (desactivar) y reactivar. El estado final deja todo activo.
select test.login('john');
do $$ begin
  perform test.denied('John no puede renombrar', format('select public.rename_member(%L, ''X'')', test.id('brother')));
  perform test.denied('John no puede quitar a nadie', format('select public.set_member_active(%L, false, true)', test.id('brother')));
end $$;

select test.login('mama');
do $$ begin
  perform public.rename_member(test.id('brother'), '  Mauricio ');
  perform test.eq('renombrado a Mauricio', (select count(*) from public.profiles where id = test.id('brother') and display_name = 'Mauricio'), 1);
  perform test.denied('nombre vacío', format('select public.rename_member(%L, '' '')', test.id('brother')));
  perform test.denied('mamá no se quita a sí misma', format('select public.set_member_active(%L, false, true)', test.id('mama')));
  -- Mauricio tiene saldo: pide confirmación
  perform test.denied('quitar con saldo exige confirmar', format('select public.set_member_active(%L, false)', test.id('brother')));
  perform test.eq('sigue activo si no se confirmó', (select count(*) from public.profiles where id = test.id('brother') and active), 1);
end $$;

-- Con saldo 0 se quita sin confirmar: se prueba con un tercer hijo recién agregado.
reset role;
insert into auth.users (email) values ('tercero@t');
insert into test.ids select 'third', id from auth.users where email = 'tercero@t';
insert into public.profiles (id, role, display_name) values (test.id('third'), 'user', 'Camila');
insert into public.accounts (user_id, owner_key, created_by) values (test.id('third'), 'camila', test.id('mama'));
insert into test.ids select 'acc_third', id from public.accounts where owner_key = 'camila';
select test.login('mama');
do $$ begin
  perform test.eq('ahora hay 3 cuentas activas', (select count(*) from jsonb_array_elements(public.admin_dashboard()->'accounts')), 3);
  perform public.add_balance(test.id('acc_third'), 10000, '2026-10-10', 'work');
  perform test.eq('Camila es independiente: 10.000', (select balance from public.account_balances where owner_key = 'camila'), 10000);
  perform test.eq('John no cambia al agregar a Camila', test.bal('john'), 355000);
end $$;
select test.login('third');
do $$ begin
  perform test.eq('Camila solo ve su cuenta', (select count(*) from public.accounts), 1);
  perform test.eq('Camila no ve a John', (select count(*) from public.account_movements where account_id = test.id('acc_john')), 0);
end $$;

-- Quitar a Mauricio (con confirmación)
select test.login('mama');
do $$ begin
  perform public.set_member_active(test.id('brother'), false, true);
  perform test.eq('dashboard excluye a quien fue quitado', (select count(*) from jsonb_array_elements(public.admin_dashboard()->'accounts')), 2);
  perform test.eq('saldo administrado excluye cuentas quitadas', (public.admin_dashboard()->>'managed_balance')::bigint, 355000 + 10000);
  perform test.eq('mamá conserva el historial de Mauricio', (select (count(*) >= 5)::int from public.account_movements where account_id = test.id('acc_brother')), 1);
  perform test.eq('family_status lo muestra como inactivo', (select count(*) from jsonb_array_elements(public.family_status()) x where (x->>'active')::boolean = false), 1);
end $$;
select test.login('brother');
do $$ begin
  perform test.eq('quitado: no ve su cuenta', (select count(*) from public.accounts), 0);
  perform test.eq('quitado: no ve su perfil', (select count(*) from public.profiles), 0);
  perform test.eq('quitado: no ve movimientos', (select count(*) from public.account_movements), 0);
  perform test.eq('quitado: no ve saldo', (select count(*) from public.account_balances), 0);
  perform test.eq('quitado: no ve notificaciones', (select count(*) from public.notifications), 0);
  perform test.eq('quitado: no ve comprobantes', (select count(*) from public.receipts), 0);
  perform test.denied('quitado: no puede pedir su resumen', format('select public.account_summary(%L)', test.id('acc_brother')));
end $$;
-- Reactivar
select test.login('mama');
do $$ begin
  perform public.set_member_active(test.id('brother'), true);
  perform test.eq('reactivado: dashboard vuelve a 3', (select count(*) from jsonb_array_elements(public.admin_dashboard()->'accounts')), 3);
end $$;
select test.login('brother');
do $$ begin
  perform test.eq('reactivado: ve su cuenta de nuevo', (select count(*) from public.accounts), 1);
  perform test.eq('reactivado: su saldo intacto', test.bal('brother'), 165000);
end $$;
reset role;
