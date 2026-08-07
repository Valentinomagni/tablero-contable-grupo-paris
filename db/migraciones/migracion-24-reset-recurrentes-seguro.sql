-- ============================================================
-- Migración 24 — Reset mensual de recurrentes SEGURO (no pierde historial)
-- (spec 21 items 4 y 8). Correr COMPLETO en Supabase → SQL Editor.
--
-- CONTEXTO: existe un cron job `reset-recurrentes` (Integrations → Cron → Jobs) que
-- heredamos de la v1. El riesgo: si resetea las tareas recurrentes al cambiar de mes
-- SIN archivar antes y SIN respetar el "ciclo de vida" de cada tarjeta, borra evidencia.
--
-- Esta función lo hace bien:
--   1) ARCHIVA el snapshot del mes que cierra en cards_archive (evidencia inmutable).
--   2) Resetea SOLO las tarjetas con reset_policy = 'mensual' (default). Las de
--      'mantener' y 'manual' quedan intactas.
--   3) No toca task_occurrences (el cumplimiento diario/arqueo ya es inmutable por fecha).
-- SECURITY DEFINER: corre con permisos plenos (el cron no tiene rol 'jefe').
-- ============================================================

create or replace function public.reset_recurrentes_seguro() returns text
language plpgsql security definer set search_path = public as $$
declare
  mes_cerrado text := to_char((now() at time zone 'America/Argentina/Buenos_Aires') - interval '1 day', 'YYYY-MM');
  archivadas int;
  reseteadas int;
begin
  -- 1) Snapshot inmutable del mes que cierra (idempotente: borra lo previo de ese mes)
  delete from public.cards_archive where mes = mes_cerrado;
  insert into public.cards_archive (owner, mes, card)
    select owner, mes_cerrado, to_jsonb(c) from public.cards c where c.card_type <> 'operativa';
  get diagnostics archivadas = row_count;

  -- 2) Reset SOLO de las recurrentes con ciclo 'mensual' (respeta 'mantener' / 'manual')
  update public.cards c
    set status = 'pend',
        done_at = null,
        checklist = coalesce(
          (select jsonb_agg(jsonb_set(jsonb_set(item, '{done}', 'false'), '{done_at}', 'null'))
           from jsonb_array_elements(c.checklist) item),
          '[]'::jsonb),
        history = c.history || jsonb_build_object(
          'who','Sistema','at', now(),
          'txt','Reinicio mensual automático (' || mes_cerrado || ' archivado)')
    where (c.recurring = true or c.recur_rule is not null)
      and coalesce(c.reset_policy, 'mensual') = 'mensual';
  get diagnostics reseteadas = row_count;

  return format('mes %s: %s archivadas, %s recurrentes reiniciadas', mes_cerrado, archivadas, reseteadas);
end;
$$;

-- ============================================================
-- PASO MANUAL EN EL DASHBOARD (una vez):
-- Supabase → Integrations → Cron → Jobs → editar el job "reset-recurrentes"
-- y reemplazar su comando SQL por:      select public.reset_recurrentes_seguro();
-- Dejar el schedule que ya tiene (mensual, día 1). Con esto, cada cambio de mes:
-- archiva el mes anterior y reinicia solo lo que corresponde, sin perder historial.
--
-- Verificación manual (corré esto una vez para probar sin esperar al cron):
--   select public.reset_recurrentes_seguro();
--   -- luego mirá el Historial de un empleado: el mes cerrado debe aparecer archivado.
-- ============================================================
