-- =====================================================================
-- MIGRACIÓN 2: vencimientos + tareas recurrentes mensuales
-- Pegar todo en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- 1. Columnas nuevas
alter table public.cards add column if not exists due_date date;
alter table public.cards add column if not exists recurring boolean not null default false;

-- 2. Función que "regenera" las tareas recurrentes:
--    vuelven a Pendiente, checklist desmarcada, y el vencimiento avanza un mes
create or replace function public.reset_recurring()
returns void language sql security definer set search_path = public as $$
  update cards set
    status = 'pend',
    done_at = null,
    checklist = coalesce(
      (select jsonb_agg(i || '{"done":false,"done_at":null}'::jsonb)
         from jsonb_array_elements(checklist) i),
      '[]'::jsonb),
    due_date = case when due_date is not null
                    then (due_date + interval '1 month')::date
                    else null end
  where recurring;
$$;

-- 3. Programarla para el día 1 de cada mes a las 03:00 UTC (~00:00 Argentina)
create extension if not exists pg_cron;
select cron.schedule('reset-recurrentes', '0 3 1 * *', 'select public.reset_recurring()');

-- 4. Confirmación: debería mostrar una fila con el job "reset-recurrentes"
select jobname, schedule, active from cron.job;
