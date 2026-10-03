-- La migración 0012 corrige nombres de versiones anteriores ("Multiusos" / "Multijuegos") a "Máquina Multijuegos", sin duplicar.
reset role;
-- Simula una instalación hecha con la versión anterior: la máquina se llamaba "Multijuegos".
update public.machines set name = 'Multijuegos', description = 'versión anterior' where name = 'Máquina Multijuegos';
\ir ../migrations/0012_default_machines.sql
do $$ begin
  perform test.eq('ya no queda "Multijuegos" a secas', (select count(*) from public.machines where lower(name) = 'multijuegos'), 0);
  perform test.eq('queda "Máquina Multijuegos" una sola vez', (select count(*) from public.machines where name = 'Máquina Multijuegos'), 1);
  perform test.eq('Wild no se duplicó', (select count(*) from public.machines where lower(name) = 'wild'), 1);
end $$;
-- Y desde "Multiusos" (primera versión)
update public.machines set name = 'Multiusos' where name = 'Máquina Multijuegos';
\ir ../migrations/0012_default_machines.sql
do $$ begin
  perform test.eq('desde "Multiusos" también se corrige', (select count(*) from public.machines where name = 'Máquina Multijuegos'), 1);
  perform test.eq('y no queda "Multiusos"', (select count(*) from public.machines where lower(name) = 'multiusos'), 0);
end $$;
