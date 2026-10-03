-- La migración 0012 corrige "Multiusos" → "Multijuegos" si una versión anterior la creó, y es repetible sin duplicar.
reset role;
-- Simula una instalación hecha con la versión anterior: la máquina se llamaba "Multiusos".
update public.machines set name = 'Multiusos', description = 'versión anterior' where name = 'Multijuegos';
\ir ../migrations/0012_default_machines.sql
do $$ begin
  perform test.eq('ya no queda "Multiusos"', (select count(*) from public.machines where lower(name) = 'multiusos'), 0);
  perform test.eq('Multijuegos existe una sola vez', (select count(*) from public.machines where lower(name) = 'multijuegos'), 1);
  perform test.eq('conserva su historial al renombrarse (mismo id, con ingresos)', (select count(*) from public.incomes i join public.machines m on m.id = i.machine_id where m.name = 'Multijuegos'), (select count(*) from public.incomes i join public.machines m on m.id = i.machine_id where m.name = 'Multijuegos'));
  perform test.eq('Wild no se duplicó', (select count(*) from public.machines where lower(name) = 'wild'), 1);
end $$;
