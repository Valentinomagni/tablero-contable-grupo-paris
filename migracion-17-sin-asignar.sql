-- ⚠ OBSOLETA (16/07): este INSERT falla porque profiles.id tiene FK a auth.users.
-- El centinela ahora lo crea la edge function eliminar-usuario (v2) como auth user real.
-- No hace falta correr este archivo.
-- Migración 17 — Centinela para tareas huérfanas
-- Perfil especial "Sin asignar": cuando se elimina un empleado, sus cards/objectives
-- quedan con owner = este id en lugar de perderse. El jefe las reasigna después.
-- Pegar en: Supabase Dashboard → SQL Editor → Run.
insert into public.profiles (id, name, role, email, puesto, ficha)
values ('00000000-0000-0000-0000-000000000000', 'Sin asignar', 'empleado', 'sin-asignar@interno', 'Reasignar', '')
on conflict (id) do nothing;
