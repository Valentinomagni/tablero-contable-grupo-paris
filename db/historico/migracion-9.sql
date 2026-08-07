-- =====================================================================
-- MIGRACIÓN 9: dependencias inversas ("quién depende de mis tareas")
-- Pegar todo en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- Un empleado no ve tarjetas ajenas, pero SÍ necesita saber quién está
-- esperando por sus tareas (título, estado y responsable, nada más).
create or replace function public.reverse_deps(ids uuid[])
returns table(id uuid, title text, status text, owner_name text, dep_id uuid)
language sql security definer stable set search_path = public as $$
  select c.id, c.title, c.status, p.name, d.value::uuid
    from cards c
    join profiles p on p.id = c.owner
    cross join lateral jsonb_array_elements_text(c.deps) d
   where d.value::uuid = any(ids);
$$;

select 'ok' as resultado;
