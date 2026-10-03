-- La migración 0012 corrige "Multiusos" → "Multijuegos" si una versión anterior la creó, y es repetible sin duplicar.
reset role;
insert into public.machines (name, description) values ('Multiusos', 'versión anterior');
\ir ../migrations/0012_default_machines.sql
do $$ begin
  perform test.eq('ya no queda "Multiusos"', (select count(*) from public.machines where lower(name) = 'multiusos'), 0);
  perform test.eq('Multijuegos existe una sola vez', (select count(*) from public.machines where lower(name) = 'multijuegos'), 1);
  perform test.eq('Wild no se duplicó', (select count(*) from public.machines where lower(name) = 'wild'), 1);
end $$;
