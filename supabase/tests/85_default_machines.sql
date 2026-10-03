-- Máquinas iniciales Wild y Multiusos, con opción de agregar más.
select test.login('mama');
do $$ declare w uuid; mu uuid; n uuid; begin
  perform test.eq('Wild existe y está activa', (select count(*) from public.machines where name = 'Wild' and active), 1);
  perform test.eq('Multiusos existe y está activa', (select count(*) from public.machines where name = 'Multiusos' and active), 1);

  -- Se pueden usar de inmediato: ingreso de Wild asignado a Mauricio y de Multiusos a John (montos independientes)
  select id into w from public.machines where name = 'Wild';
  select id into mu from public.machines where name = 'Multiusos';
  perform public.register_income(w, '2026-10-12', 40000, 'Wild', jsonb_build_array(jsonb_build_object('account_id', test.id('acc_brother'), 'amount', 40000)));
  perform public.register_income(mu, '2026-10-12', 25000, 'Multiusos', jsonb_build_array(jsonb_build_object('account_id', test.id('acc_john'), 'amount', 25000)));
  perform test.eq('ingresos por máquina: Wild', (select sum(amount)::bigint from public.incomes where machine_id = w and deleted_at is null), 40000);
  perform test.eq('ingresos por máquina: Multiusos', (select sum(amount)::bigint from public.incomes where machine_id = mu and deleted_at is null), 25000);

  -- Se pueden agregar más y desactivar
  n := public.create_machine('Máquina Nueva', null);
  perform test.eq('se puede crear otra máquina activa', (select count(*) from public.machines where id = n and active), 1);
  perform test.denied('no se duplican nombres (sin importar mayúsculas)', 'select public.create_machine(''  wild '', null)');
  perform public.update_machine(n, 'Máquina Nueva', null, false);
  perform test.denied('una máquina desactivada no admite ingresos nuevos', format('select public.register_income(%L, now()::date, 1000)', n));
  perform public.update_machine(w, 'Wild', 'Máquina Wild', false);
  perform test.eq('Wild desactivada conserva sus ingresos', (select count(*) from public.incomes where machine_id = w and deleted_at is null), 1);
  perform public.update_machine(w, 'Wild', 'Máquina Wild', true);
end $$;
select test.login('john');
do $$ begin
  perform test.denied('un hijo no crea máquinas', 'select public.create_machine(''X'', null)');
  perform test.eq('John solo ve el nombre de las máquinas de SUS movimientos (Máquina 1 y Multiusos)', (select count(*) from public.machines), 2);
end $$;
select test.login('brother');
do $$ begin
  perform test.eq('Mauricio solo ve Wild y Máquina 1 (la de su reparto parcial)', (select count(*) from public.machines), 2);
  perform test.eq('Mauricio NO ve Multiusos', (select count(*) from public.machines where name = 'Multiusos'), 0);
end $$;
select test.login('mama');
-- Limpieza: se eliminan los ingresos de prueba para no alterar los saldos que esperan las pruebas siguientes.
do $$ begin
  perform public.delete_income(i.id, 'limpieza de prueba') from public.incomes i where i.description in ('Wild', 'Multiusos') and i.deleted_at is null;
  perform test.eq('limpieza: John vuelve a 355.000', test.bal('john'), 355000);
  perform test.eq('limpieza: Mauricio vuelve a 165.000', test.bal('brother'), 165000);
end $$;
reset role;
