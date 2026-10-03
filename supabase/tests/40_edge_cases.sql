-- Reglas adicionales: borrado lógico, auditoría, notificaciones, sobregiro, reparto parcial, comprobantes.
select test.login('mama');
do $$
declare v_tr uuid; v_inc uuid; v_m2 uuid; v_credit uuid; v_rec uuid;
begin
  -- Sobregiro bloqueado, autorizado explícito permitido.
  perform test.denied('Transferir más que el saldo', format('select public.register_transfer(%L, 9999999, now()::date)', test.id('acc_john')));
  perform test.eq('saldo intacto tras intento fallido', test.bal('john'), 330000);

  -- Editar transferencia: 50.000 → 80.000 baja el saldo en 30.000
  select id into v_tr from public.account_movements where kind = 'transfer';
  perform public.update_movement(v_tr, 80000, '2026-10-03', 'Transferencia personal', 'Error de digitación');
  perform test.eq('editar transferencia 50k→80k: John 300.000', test.bal('john'), 300000);
  perform test.eq('auditoría guarda valor anterior', (select (old_data->>'signed_amount')::bigint from public.audit_logs
     where record_id = v_tr and action = 'update' order by id desc limit 1), -50000);
  perform test.eq('auditoría guarda valor nuevo', (select (new_data->>'signed_amount')::bigint from public.audit_logs
     where record_id = v_tr and action = 'update' order by id desc limit 1), -80000);
  perform test.eq('auditoría guarda quién', (select count(*) from public.audit_logs where record_id = v_tr and actor_id = test.id('mama')), 2);
  perform test.eq('auditoría guarda el motivo', (select count(*) from public.audit_logs where record_id = v_tr and reason = 'Error de digitación'), 1);

  -- Eliminar (lógico) la transferencia: el saldo se recupera y la fila sigue existiendo.
  perform public.delete_movement(v_tr, 'Se registró por error');
  perform test.eq('eliminar transferencia: John 380.000', test.bal('john'), 380000);
  perform test.eq('borrado lógico: la fila sigue para mamá', (select count(*) from public.account_movements where id = v_tr and deleted_at is not null), 1);
  perform test.eq('auditoría registra el borrado', (select count(*) from public.audit_logs where record_id = v_tr and action = 'delete'), 1);

  -- Reparto parcial: ingreso 100.000 → 60.000 John / 30.000 Hermano; 10.000 sin asignar.
  select id into v_m2 from public.machines limit 1;
  v_inc := public.register_income(v_m2, '2026-10-04', 100000, 'Reparto',
    jsonb_build_array(jsonb_build_object('account_id', test.id('acc_john'), 'amount', 60000),
                      jsonb_build_object('account_id', test.id('acc_brother'), 'amount', 30000)));
  perform test.eq('reparto: John +60.000', test.bal('john'), 440000);
  perform test.eq('reparto: Hermano +30.000', test.bal('brother'), 130000);
  perform test.denied('no se puede asignar más que el ingreso',
    format('select public.update_income(%L, ''2026-10-04'', 100000, null, %L::jsonb)', v_inc,
           jsonb_build_array(jsonb_build_object('account_id', test.id('acc_john'), 'amount', 90000),
                             jsonb_build_object('account_id', test.id('acc_brother'), 'amount', 30000))::text));
  perform test.denied('no se puede repetir una cuenta en la asignación',
    format('select public.update_income(%L, ''2026-10-04'', 100000, null, %L::jsonb)', v_inc,
           jsonb_build_array(jsonb_build_object('account_id', test.id('acc_john'), 'amount', 10000),
                             jsonb_build_object('account_id', test.id('acc_john'), 'amount', 10000))::text));
  -- Reasignar todo a John (quita al hermano)
  perform public.update_income(v_inc, '2026-10-04', 100000, 'Reparto',
    jsonb_build_array(jsonb_build_object('account_id', test.id('acc_john'), 'amount', 100000)));
  perform test.eq('reasignar: John 480.000', test.bal('john'), 480000);
  perform test.eq('reasignar: Hermano vuelve a 100.000', test.bal('brother'), 100000);
  -- Editar sin allocations con reparto parcial (no cubre todo) conserva montos
  perform public.update_income(v_inc, '2026-10-04', 120000, 'Reparto', null);
  perform test.eq('editar monto con asignación total: sigue al ingreso', test.bal('john'), 500000);
  -- Eliminar el ingreso elimina sus asignaciones
  perform public.delete_income(v_inc, 'Duplicado');
  perform test.eq('eliminar ingreso: John 380.000', test.bal('john'), 380000);
  perform test.denied('movimiento de ingreso no se edita suelto',
    format('select public.update_movement(%L, 1, now()::date, null)', (select id from public.account_movements where income_id is not null and deleted_at is null limit 1)));

  -- Corrección identificable
  v_credit := public.register_correction(test.id('acc_john'), -5000, '2026-10-05', 'Ajuste por error previo');
  perform test.eq('corrección negativa', test.bal('john'), 375000);
  perform test.denied('corrección sin explicación', format('select public.register_correction(%L, 100, now()::date, '''')', test.id('acc_john')));

  -- Validaciones de monto
  perform test.denied('monto cero', format('select public.add_balance(%L, 0, now()::date, ''work'')', test.id('acc_john')));
  perform test.denied('monto negativo', format('select public.add_balance(%L, -5, now()::date, ''work'')', test.id('acc_john')));
  perform test.denied('origen personalizado sin detalle', format('select public.add_balance(%L, 5, now()::date, ''custom'')', test.id('acc_john')));
  perform test.denied('mamá tampoco escribe directo en las tablas', 'update public.account_movements set signed_amount = 1');

  -- Resumen de origen del saldo de John
  perform test.eq('resumen: saldo', (public.account_summary(test.id('acc_john'))->>'balance')::bigint, 375000);
end $$;

-- Comprobantes: John ve el suyo; Hermano no.
do $$ declare v_tr uuid; v_path text; begin
  v_tr := public.register_transfer(test.id('acc_john'), 20000, '2026-10-06', 'Con comprobante');
  v_path := test.id('acc_john') || '/' || v_tr || '/comprobante.pdf';
  perform public.attach_receipt(v_tr, v_path, 'application/pdf', 1234);
  perform test.denied('ruta de comprobante de otra cuenta', format('select public.attach_receipt(%L, %L, ''application/pdf'', 10)', v_tr, test.id('acc_brother') || '/' || v_tr || '/x.pdf'));
  perform test.denied('tipo de archivo no permitido', format('select public.attach_receipt(%L, %L, ''text/html'', 10)', v_tr, test.id('acc_john') || '/' || v_tr || '/y.html'));
  create temp table IF NOT EXISTS _p(path text); delete from _p; insert into _p values (v_path);
end $$;
reset role;
insert into storage.objects (bucket_id, name) select 'receipts', path from _p;

select test.login('john');
do $$ begin
  perform test.eq('John ve su comprobante', (select count(*) from public.receipts), 1);
  perform test.eq('John lee el archivo en Storage', (select count(*) from storage.objects where bucket_id='receipts'), 1);
  perform test.eq('John ve su notificación de transferencia', (select count(*) from public.notifications where body like 'Mamá registró una transferencia de $20.000 a tu cuenta.'), 1);
  perform test.denied('John no puede subir archivos', 'insert into storage.objects(bucket_id,name) values (''receipts'',''x/y/z.pdf'')');
  perform test.denied('John no puede borrar comprobantes', 'delete from public.receipts');
end $$;
select test.login('brother');
do $$ begin
  perform test.eq('Hermano NO ve el comprobante', (select count(*) from public.receipts), 0);
  perform test.eq('Hermano NO lee el archivo', (select count(*) from storage.objects where bucket_id='receipts'), 0);
  perform test.eq('Hermano no recibió notificaciones de John', (select count(*) from public.notifications where body like '%$20.000%'), 0);
end $$;

-- John no ve movimientos eliminados.
select test.login('john');
do $$ begin
  perform test.eq('John no ve movimientos eliminados', (select count(*) from public.account_movements where deleted_at is not null), 0);
end $$;
update public.notifications set read_at = now() where read_at is null;
do $$ begin
  perform test.eq('John marcó sus notificaciones como leídas', (select count(*) from public.notifications where read_at is null), 0);
end $$;
reset role;
