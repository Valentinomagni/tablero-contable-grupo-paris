-- Migración 17 — Centinela para tareas huérfanas
-- Perfil especial "Sin asignar": cuando se elimina un empleado, sus cards/objectives
-- quedan con owner = este id en lugar de perderse. El jefe las reasigna después.
-- Pegar en: Supabase Dashboard → SQL Editor → Run.
insert into public.profiles (id, name, role, email, puesto, ficha)
values ('00000000-0000-0000-0000-000000000000', 'Sin asignar', 'empleado', 'sin-asignar@interno', 'Reasignar', '')
on conflict (id) do nothing;
