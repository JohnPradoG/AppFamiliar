-- Dashboard de mamá. Estado heredado de 20_ y 40_: John 355.000, Hermano 100.000, ingreso M1 180.000 (todo a John),
-- transferencia activa de 20.000 a John (6/oct), otra eliminada.
select test.login('mama');
do $$ declare d jsonb; j jsonb; begin
  d := public.admin_dashboard();
  perform test.eq('dash: total máquinas', (d->>'total_machine_income')::bigint, 180000);
  perform test.eq('dash: sin asignar', (d->>'unassigned_income')::bigint, 0);
  perform test.eq('dash: total transferido (ignora eliminadas)', (d->>'total_transferred')::bigint, 20000);
  perform test.eq('dash: saldo administrado', (d->>'managed_balance')::bigint, 455000);
  perform test.eq('dash: 2 cuentas', jsonb_array_length(d->'accounts'), 2);
  select x into j from jsonb_array_elements(d->'accounts') x where x->>'owner_key' = 'john';
  perform test.eq('dash: John saldo', (j->>'balance')::bigint, 355000);
  perform test.eq('dash: John asignado (sin correcciones)', (j->>'assigned')::bigint, 380000);
  perform test.eq('dash: John transferido', (j->>'transferred')::bigint, 20000);
  perform test.eq('dash: máquina M1 total', (d->'machines'->0->>'total')::bigint, 180000);
  -- Filtro de período: solo el 6 de octubre en adelante
  d := public.admin_dashboard('2026-10-06', '2026-10-31');
  perform test.eq('dash período: máquinas 0', (d->>'total_machine_income')::bigint, 0);
  perform test.eq('dash período: transferido 20.000', (d->>'total_transferred')::bigint, 20000);
  perform test.eq('dash período: el saldo no depende del filtro', (d->>'managed_balance')::bigint, 455000);
  -- Reparto parcial deja "sin asignar"
  perform public.register_income((select id from public.machines limit 1), '2026-10-07', 50000, 'parcial',
     jsonb_build_array(jsonb_build_object('account_id', test.id('acc_brother'), 'amount', 20000)));
  d := public.admin_dashboard('2026-10-07', '2026-10-07');
  perform test.eq('dash: ingreso parcial', (d->>'total_machine_income')::bigint, 50000);
  perform test.eq('dash: 30.000 sin asignar', (d->>'unassigned_income')::bigint, 30000);
end $$;
select test.login('john');
do $$ begin
  perform test.denied('John no puede ver el dashboard de mamá', 'select public.admin_dashboard()');
end $$;
select test.login('brother');
do $$ begin
  perform test.denied('Hermano no puede ver el dashboard de mamá', 'select public.admin_dashboard()');
end $$;
reset role;
