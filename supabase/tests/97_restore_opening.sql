-- Restaurar eliminados y saldo inicial. Deja los saldos como estaban al final.
select test.login('mama');
do $$ declare v_tr uuid; v_bal bigint; v_inc uuid; v_m uuid; v_j bigint; v_alloc_a uuid; begin
  v_j := test.bal('john');

  -- Movimiento suelto: eliminar y restaurar
  v_tr := public.register_transfer(test.id('acc_john'), 1000, '2026-10-13', 'a restaurar');
  perform test.eq('antes: baja 1.000', test.bal('john'), v_j - 1000);
  perform public.delete_movement(v_tr, 'error');
  perform test.eq('eliminado: saldo vuelve', test.bal('john'), v_j);
  perform public.restore_movement(v_tr, 'era correcto');
  perform test.eq('restaurado: baja de nuevo', test.bal('john'), v_j - 1000);
  perform test.eq('auditoría registra la restauración', (select count(*) from public.audit_logs where record_id = v_tr and action = 'update' and reason = 'era correcto' and old_data->>'deleted_at' is not null and new_data->>'deleted_at' is null), 1);
  perform test.denied('no se restaura lo que no está eliminado', format('select public.restore_movement(%L)', v_tr));
  perform public.delete_movement(v_tr);   -- limpieza

  -- Ingreso con dos asignaciones; una se quita al editar, luego se elimina todo y se restaura
  select id into v_m from public.machines where name = 'Wild';
  v_inc := public.register_income(v_m, '2026-10-13', 10000, 'rest', jsonb_build_array(
     jsonb_build_object('account_id', test.id('acc_john'), 'amount', 6000), jsonb_build_object('account_id', test.id('acc_brother'), 'amount', 4000)));
  perform public.update_income(v_inc, '2026-10-13', 10000, 'rest', jsonb_build_array(jsonb_build_object('account_id', test.id('acc_john'), 'amount', 6000)));  -- quita a Mauricio
  perform test.eq('antes de eliminar: John +6.000', test.bal('john'), v_j + 6000);
  perform public.delete_income(v_inc, 'duplicado');
  perform test.eq('ingreso eliminado: John vuelve', test.bal('john'), v_j);
  perform test.denied('un movimiento de ingreso no se restaura suelto', format('select public.restore_movement(%L)', (select id from public.account_movements where income_id = v_inc and account_id = test.id('acc_john'))));
  perform public.restore_income(v_inc, 'era correcto');
  perform test.eq('ingreso restaurado: John +6.000', test.bal('john'), v_j + 6000);
  perform test.eq('NO revive la asignación que se quitó antes al editar', (select count(*) from public.account_movements where income_id = v_inc and account_id = test.id('acc_brother') and deleted_at is null), 0);
  perform test.eq('el ingreso vuelve a contar en el dashboard', (select count(*) from public.incomes where id = v_inc and deleted_at is null), 1);
  perform public.delete_income(v_inc, 'limpieza');
  perform test.eq('John restablecido', test.bal('john'), v_j);

  -- Saldo inicial
  perform public.set_opening_balance(test.id('acc_john'), 50000, 'saldo previo');
  perform test.eq('saldo inicial suma al saldo', test.bal('john'), v_j + 50000);
  perform test.eq('el resumen muestra el saldo inicial', (public.account_summary(test.id('acc_john'))->>'opening_balance')::bigint, 50000);
  perform test.eq('el origen del saldo + inicial = saldo', (select coalesce(sum((x->>'total')::bigint),0)::bigint from jsonb_array_elements(public.account_summary(test.id('acc_john'))->'by_origin') x) + 50000, test.bal('john'));
  perform test.eq('auditoría del saldo inicial', (select count(*) from public.audit_logs where table_name = 'accounts' and reason = 'saldo previo'), 1);
  perform test.denied('saldo inicial absurdo', format('select public.set_opening_balance(%L, 10000000000000)', test.id('acc_john')));
  perform public.set_opening_balance(test.id('acc_john'), 0, 'limpieza');
  perform test.eq('saldo inicial en 0 de nuevo', test.bal('john'), v_j);
end $$;
-- Un hijo no restaura ni cambia saldos iniciales; no ve el intento fallido tabla de límite
select test.login('john');
do $$ begin
  perform test.denied('John no restaura', 'select public.restore_movement(gen_random_uuid())');
  perform test.denied('John no restaura ingresos', 'select public.restore_income(gen_random_uuid())');
  perform test.denied('John no cambia saldos iniciales', format('select public.set_opening_balance(%L, 999)', test.id('acc_john')));
  perform test.denied('John no lee invite_failures', 'select * from public.invite_failures');
end $$;
select test.login('mama');
do $$ begin perform test.denied('ni mamá lee invite_failures (solo service_role)', 'select * from public.invite_failures'); end $$;
reset role;
