-- ============================================================
-- Migración 25 — Materializar ocurrencias del mes por cron (propuesta P2)
-- Correr COMPLETO en Supabase → SQL Editor.
--
-- PROBLEMA: hoy las ocurrencias de una tarea recurrente se crean cuando alguien abre
-- la card ese mes. Si nadie la abre el día 1, el calendario/arqueo de principio de mes
-- queda vacío. Esta función las materializa para todas las cards recurrentes.
--
-- Idempotente: usa on conflict (card_id, fecha) do nothing → correrla varias veces no duplica.
-- Interpreta recur_rule (misma semántica que src/lib/recurrencia.ts):
--   { tipo:'diaria' } | { tipo:'semanal', dias:[0..6] (0=dom..6=sab) } | { tipo:'mensual', diaMes:N }
-- SECURITY DEFINER: corre con permisos plenos (el cron no tiene sesión de usuario).
-- ============================================================

create or replace function public.materializar_mes_recurrentes(p_year int default null, p_month int default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  tz text := 'America/Argentina/Buenos_Aires';
  y int := coalesce(p_year, extract(year from (now() at time zone tz))::int);
  m int := coalesce(p_month, extract(month from (now() at time zone tz))::int);
  primero date := make_date(y, m, 1);
  ultimo date := (primero + interval '1 month' - interval '1 day')::date;
  total int := 0;
  filas int;
  c record;
  d date;
  tipo text;
begin
  for c in select id, owner, recur_rule from public.cards where recur_rule is not null loop
    tipo := c.recur_rule->>'tipo';
    for d in select generate_series(primero, ultimo, interval '1 day')::date loop
      if tipo = 'diaria'
         or (tipo = 'semanal' and (c.recur_rule->'dias') @> to_jsonb(extract(dow from d)::int))
         or (tipo = 'mensual' and extract(day from d)::int = (c.recur_rule->>'diaMes')::int)
      then
        insert into public.task_occurrences (card_id, owner, fecha)
        values (c.id, c.owner, d)
        on conflict (card_id, fecha) do nothing;
        get diagnostics filas = row_count;
        total := total + filas;
      end if;
    end loop;
  end loop;
  return format('%s ocurrencias nuevas materializadas para %s-%s', total, y, lpad(m::text, 2, '0'));
end;
$$;

-- ============================================================
-- PROBAR (una vez, sin esperar al cron):
--   select public.materializar_mes_recurrentes();   -- mes actual
-- Debe devolver "N ocurrencias nuevas materializadas…". Volvé a correrla: la 2da vez → 0 (idempotente).
--
-- PROGRAMAR (opcional): Supabase → Integrations → Cron → Create job
--   nombre: materializar-mes ; schedule: 5 0 1 * *  (día 1 a las 00:05)
--   comando: select public.materializar_mes_recurrentes();
-- ============================================================
