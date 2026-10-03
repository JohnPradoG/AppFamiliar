-- El desglose "origen del saldo" SIEMPRE debe sumar el saldo (para John y para el hermano), con cualquier mezcla de movimientos.
select test.login('mama');
do $$ begin
  perform public.add_balance(test.id('acc_brother'), 70000, '2026-10-08', 'custom', 'Venta de bicicleta');
  perform public.register_transfer(test.id('acc_brother'), 30000, '2026-10-09', 'Transferencia');
  perform public.register_correction(test.id('acc_brother'), 5000, '2026-10-09', 'Ajuste');
end $$;
select test.login('john');
do $$ declare s jsonb; begin
  s := public.account_summary(test.id('acc_john'));
  perform test.eq('John: origen del saldo suma el saldo',
    (select coalesce(sum((x->>'total')::bigint), 0)::bigint from jsonb_array_elements(s->'by_origin') x) + (s->>'opening_balance')::bigint, (s->>'balance')::bigint);
  perform test.eq('John: total_income no cuenta correcciones ni transferencias',
    (s->>'total_income')::bigint, (select sum(signed_amount)::bigint from public.account_movements where signed_amount > 0 and kind <> 'correction'));
end $$;
select test.login('brother');
do $$ declare s jsonb; begin
  s := public.account_summary(test.id('acc_brother'));
  perform test.eq('Hermano: origen del saldo suma el saldo',
    (select coalesce(sum((x->>'total')::bigint), 0)::bigint from jsonb_array_elements(s->'by_origin') x) + (s->>'opening_balance')::bigint, (s->>'balance')::bigint);
  perform test.eq('Hermano: saldo esperado (100.000+20.000 de reparto +70.000 −30.000 +5.000)', (s->>'balance')::bigint, 165000);
  perform test.eq('Hermano: la etiqueta personalizada llega al hijo', (select count(*) from public.account_movements where origin_detail = 'Venta de bicicleta'), 1);
  perform test.eq('Hermano: ve sus 4+ movimientos y ninguno de John', (select count(*) from public.account_movements where account_id <> test.id('acc_brother')), 0);
end $$;
reset role;
