-- AppFamiliar · 0012 · Máquinas iniciales de la familia: Wild y Multiusos (activas).
-- Mamá puede editarlas, desactivarlas o agregar más desde la app (Ingresos → Ver máquinas).
-- "on conflict do nothing": si ya existen (mismo nombre), no se toca nada.

insert into public.machines (name, description)
values ('Wild', 'Máquina Wild'), ('Multiusos', 'Máquina Multiusos')
on conflict (lower(btrim(name))) do nothing;
