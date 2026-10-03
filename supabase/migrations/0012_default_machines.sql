-- AppFamiliar · 0012 · Máquinas iniciales de la familia: Wild y Máquina Multijuegos (activas).
-- Mamá puede editarlas, desactivarlas o agregar más desde la app (Ingresos → Ver máquinas).
-- Es seguro repetirla: si ya existen (mismo nombre), no se toca nada.

-- Versiones anteriores de esta migración la crearon como "Multiusos" o "Multijuegos": se corrige el nombre (conserva su historial).
update public.machines
   set name = 'Máquina Multijuegos', description = 'Máquina Multijuegos'
 where lower(btrim(name)) in ('multiusos', 'multijuegos')
   and not exists (select 1 from public.machines where lower(btrim(name)) = lower('Máquina Multijuegos'));

insert into public.machines (name, description)
values ('Wild', 'Máquina Wild'), ('Máquina Multijuegos', 'Máquina Multijuegos')
on conflict (lower(btrim(name))) do nothing;
