-- CASO 6: John NO ve nada del hermano.
select test.login('john');
do $$
declare v_n bigint;
begin
  perform test.eq('Caso 6: John ve solo 1 cuenta', (select count(*) from public.accounts), 1);
  perform test.eq('Caso 6: John ve solo su saldo', (select count(*) from public.account_balances), 1);
  perform test.eq('Caso 6: saldo de John', test.bal('john'), 330000);
  perform test.eq('Caso 6: nada del hermano en balances', (select count(*) from public.account_balances where owner_key='brother'), 0);
  perform test.eq('Caso 6: movimientos solo de John', (select count(*) from public.account_movements where account_id <> test.id('acc_john')), 0);
  perform test.eq('Caso 6: John ve sus movimientos', (select count(*) from public.account_movements), 3);
  perform test.eq('Caso 6: un solo perfil visible (el suyo)', (select count(*) from public.profiles), 1);
  perform test.eq('Caso 6: no ve ingresos de máquina', (select count(*) from public.incomes), 0);
  perform test.eq('Caso 6: no ve auditoría', (select count(*) from public.audit_logs), 0);
  perform test.eq('Caso 6: ve el nombre de SU máquina', (select count(*) from public.machines), 1);
  perform test.eq('Caso 6: notificaciones propias', (select count(*) from public.notifications where user_id <> test.id('john')), 0);
  perform test.denied('Caso 6: pedir resumen de la cuenta del hermano', format('select public.account_summary(%L)', test.id('acc_brother')));
  perform test.eq('Caso 6: filtrando por cuenta del hermano → 0 filas', (select count(*) from public.account_movements where account_id = test.id('acc_brother')), 0);
  perform test.eq('Caso 6: resumen propio funciona', (public.account_summary(test.id('acc_john'))->>'balance')::bigint, 330000);
  -- Escrituras directas y RPC de mamá: bloqueadas.
  perform test.denied('John no puede insertar movimientos', format('insert into public.account_movements(account_id,kind,origin,signed_amount,movement_date) values (%L,''credit'',''other'',1000,now())', test.id('acc_john')));
  perform test.denied('John no puede editar movimientos', 'update public.account_movements set signed_amount = 999999999');
  perform test.denied('John no puede borrar movimientos', 'delete from public.account_movements');
  perform test.denied('John no puede cambiarse el rol', format('update public.profiles set role=''admin'' where id=%L', test.id('john')));
  perform test.denied('John no puede cambiar su saldo inicial', 'update public.accounts set opening_balance = 1000000');
  perform test.denied('John no puede llamar add_balance', format('select public.add_balance(%L,1000,now()::date,''other'')', test.id('acc_john')));
  perform test.denied('John no puede llamar register_transfer', format('select public.register_transfer(%L,1000,now()::date)', test.id('acc_john')));
  perform test.denied('John no puede llamar update_income', 'select public.update_income(gen_random_uuid(), now()::date, 1, null)');
  perform test.denied('John no puede reescribir notificaciones', 'update public.notifications set body = ''x''');
  perform test.denied('John no puede marcar leídas por tabla (solo por función)', 'update public.notifications set read_at = now()');
end $$;

-- CASO 7: el hermano NO ve nada de John.
select test.login('brother');
do $$ begin
  perform test.eq('Caso 7: Hermano ve solo 1 cuenta', (select count(*) from public.accounts), 1);
  perform test.eq('Caso 7: saldo del hermano', test.bal('brother'), 100000);
  perform test.eq('Caso 7: nada de John en balances', (select count(*) from public.account_balances where owner_key='john'), 0);
  perform test.eq('Caso 7: movimientos solo del hermano', (select count(*) from public.account_movements where account_id <> test.id('acc_brother')), 0);
  perform test.eq('Caso 7: ve su movimiento', (select count(*) from public.account_movements), 1);
  perform test.eq('Caso 7: no ve la máquina de John', (select count(*) from public.machines), 0);
  perform test.eq('Caso 7: no ve ingresos', (select count(*) from public.incomes), 0);
  perform test.eq('Caso 7: no ve el perfil de John', (select count(*) from public.profiles where id = test.id('john')), 0);
  perform test.denied('Caso 7: resumen de la cuenta de John', format('select public.account_summary(%L)', test.id('acc_john')));
  perform test.denied('Hermano no puede editar nada', 'update public.account_movements set signed_amount = 1');
  perform test.denied('Hermano no puede llamar delete_movement', 'select public.delete_movement(gen_random_uuid())');
end $$;

-- CASO 8: mamá ve ambas cuentas.
select test.login('mama');
do $$ begin
  perform test.eq('Caso 8: mamá ve 2 cuentas', (select count(*) from public.accounts), 2);
  perform test.eq('Caso 8: saldo de John', test.bal('john'), 330000);
  perform test.eq('Caso 8: saldo del hermano', test.bal('brother'), 100000);
  perform test.eq('Caso 8: mamá ve todos los movimientos', (select count(*) from public.account_movements), 4);
  perform test.eq('Caso 8: mamá ve ingresos', (select count(*) from public.incomes), 1);
end $$;
