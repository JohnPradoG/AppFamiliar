-- CASOS 1–5 (saldos). Todo lo hace mamá; los saldos se leen con la vista account_balances.
select test.login('mama');
do $$ begin
  perform test.eq('Caso 0: John empieza en $0', test.bal('john'), 0);

  -- Caso 1
  perform public.add_balance(test.id('acc_john'), 200000, '2026-10-03', 'work', null, null, 'Trabajo');
  perform test.eq('Caso 1: John $200.000', test.bal('john'), 200000);

  -- Caso 2
  perform public.create_machine('Máquina 1', 'Primera máquina');
  perform public.register_income((select id from public.machines where name = 'Máquina 1'), '2026-10-03', 150000, 'Ingreso M1',
     jsonb_build_array(jsonb_build_object('account_id', test.id('acc_john'), 'amount', 150000)));
  perform test.eq('Caso 2: John $350.000', test.bal('john'), 350000);

  -- Caso 3
  perform public.add_balance(test.id('acc_brother'), 100000, '2026-10-03', 'other', null, null, 'Para el hermano');
  perform test.eq('Caso 3: John sigue en $350.000', test.bal('john'), 350000);
  perform test.eq('Caso 3: Hermano $100.000', test.bal('brother'), 100000);

  -- Caso 4
  perform public.register_transfer(test.id('acc_john'), 50000, '2026-10-03', 'Transferencia personal');
  perform test.eq('Caso 4: John $300.000', test.bal('john'), 300000);

  -- Caso 5: el ingreso pasa de 150.000 a 180.000 (la asignación completa sigue al ingreso)
  perform public.update_income((select id from public.incomes limit 1), '2026-10-03', 180000, 'Ingreso M1', null, 'Corrección de monto');
  perform test.eq('Caso 5: John $330.000 tras editar ingreso', test.bal('john'), 330000);
  perform test.eq('Caso 5: Hermano no cambia', test.bal('brother'), 100000);
end $$;
