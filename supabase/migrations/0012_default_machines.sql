-- AppFamiliar · 0012 · Máquinas iniciales de la familia: Wild y Multijuegos (activas).
-- Mamá puede editarlas, desactivarlas o agregar más desde la app (Ingresos → Ver máquinas).
-- Es seguro repetirla: si ya existen (mismo nombre), no se toca nada.

-- Si una versión anterior de esta migración creó "Multiusos" por error, se corrige el nombre (conserva su historial).
update public.machines
   set name = 'Multijuegos', description = 'Máquina Multijuegos'
 where lower(btrim(name)) = 'multiusos'
   and not exists (select 1 from public.machines where lower(btrim(name)) = 'multijuegos');

insert into public.machines (name, description)
values ('Wild', 'Máquina Wild'), ('Multijuegos', 'Máquina Multijuegos')
on conflict (lower(btrim(name))) do nothing;
