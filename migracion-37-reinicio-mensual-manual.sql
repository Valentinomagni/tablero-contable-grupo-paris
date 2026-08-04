-- ============================================================
-- MIGRACIÓN 37 — Reinicio mensual: diagnóstico y ejecución manual
--
-- URGENTE. Reportado el 04/08/2026: arrancó agosto y el equipo ve sus tareas de julio
-- todavía en "Terminado" en vez de haber vuelto a "Pendiente". Trabajan a mes vencido, así
-- que el 1 de agosto todo eso tenía que estar en cero.
--
-- ------------------------------------------------------------
-- CÓMO FUNCIONA HOY, Y POR QUÉ FALLÓ
-- ------------------------------------------------------------
-- El reinicio lo hace un CRON de Supabase que llama a `reset_recurrentes_seguro()`
-- (migración 24). Esa función archiva el mes que cierra y después reinicia tarjetas, pero
-- SÓLO las que cumplen las DOS condiciones:
--
--     (recurring = true  OR  recur_rule is not null)     ← está marcada como recurrente
--     AND coalesce(reset_policy, 'mensual') = 'mensual'  ← su ciclo es mensual
--
-- De ahí salen las dos únicas causas posibles, y son muy distintas:
--
--   CAUSA A — el cron no corrió. Puede no estar programado, apuntar a un nombre viejo de
--             la v1, o haber fallado. El reinicio es invisible: nadie se entera hasta que
--             alguien ve datos del mes pasado.
--
--   CAUSA B — las tarjetas no están marcadas como recurrentes. Si se cargaron como tareas
--             normales, el reinicio nunca las va a tocar por más que el cron corra todos
--             los meses. En el tablero se reconocen porque NO tienen el ícono de repetición.
--
-- El PASO 1 de abajo distingue una de la otra. No lo saltees: si la causa es B, reiniciar
-- a mano lo arregla este mes y el que viene vuelve a pasar exactamente lo mismo.
--
-- ------------------------------------------------------------
-- POR QUÉ NO ALCANZA CON VOLVER A LLAMAR A LA FUNCIÓN DE LA 24
-- ------------------------------------------------------------
-- `reset_recurrentes_seguro()` calcula el mes que cierra como `now() - 1 día`. Corriendo el
-- 1 de agosto a las 00:05 eso da julio, que es lo correcto. Pero corriéndola A MANO el 4 de
-- agosto da AGOSTO, y entonces archivaría el trabajo de julio bajo la etiqueta "2026-08",
-- pisando el archivo del mes en curso y dejando el histórico mintiendo para siempre.
--
-- Por eso esta migración agrega una función que recibe el mes a cerrar de forma EXPLÍCITA.
--
-- Idempotente: se puede correr las veces que sea.
-- ============================================================


-- ============================================================
-- PASO 1 — DIAGNÓSTICO. Corré esto SOLO y mirá el resultado.
--          No cambia nada. Es lo que dice si la causa es A o B.
-- ============================================================
select
  count(*) filter (where recurring = true or recur_rule is not null)                  as recurrentes,
  count(*) filter (where (recurring = true or recur_rule is not null)
                     and coalesce(reset_policy,'mensual') = 'mensual')                as se_reinician,
  count(*) filter (where not (recurring = true or recur_rule is not null)
                     and status = 'term'
                     and done_at < date_trunc('month', now()))                        as terminadas_mes_pasado_sin_recurrencia,
  count(*)                                                                            as total_no_operativas
from public.cards
where card_type <> 'operativa';

-- CÓMO LEER EL RESULTADO:
--
--   · `se_reinician` es un número ALTO y aun así ves tareas de julio
--        → CAUSA A: el cron no corrió. El PASO 3 lo arregla ahora y el PASO 4 evita que
--          vuelva a fallar en silencio.
--
--   · `terminadas_mes_pasado_sin_recurrencia` es ALTO y `se_reinician` es BAJO
--        → CAUSA B: las tareas no están marcadas como recurrentes. El PASO 3 no las va a
--          tocar. Hay que marcarlas primero — mirá el PASO 2.
--
-- Para ver EXACTAMENTE cuáles son las que quedaron colgadas de julio:
--
--   select owner, title, status, done_at, recurring, recur_rule, reset_policy
--     from public.cards
--    where card_type <> 'operativa' and status = 'term'
--      and done_at < date_trunc('month', now())
--    order by owner, title;


-- ============================================================
-- PASO 2 — SÓLO SI EL DIAGNÓSTICO DIO CAUSA B.
--          Marcar como recurrentes mensuales las tareas que sí lo son.
--
--          NO lo corras a ciegas: primero mirá la lista del PASO 1 y confirmá que TODAS
--          esas tareas son realmente del ciclo mensual. Una tarea de una sola vez marcada
--          como recurrente va a reaparecer todos los meses para siempre, y sacarla después
--          es más trabajo que marcarla bien ahora.
--
--          Está comentado a propósito. Descomentalo cuando estés seguro.
-- ============================================================
-- update public.cards
--    set recurring = true,
--        reset_policy = coalesce(reset_policy, 'mensual')
--  where card_type <> 'operativa'
--    and id in ( ... acá los ids de la lista que revisaste ... );


-- ============================================================
-- PASO 3 — Registro de reinicios, y la función manual con el mes EXPLÍCITO.
--
-- La tabla va ANTES que las funciones porque las dos escriben en ella. El problema de fondo
-- no es que el reinicio falló: es que falla SIN QUE NADIE SE ENTERE. Un cron que falla
-- callado es peor que no tener cron, porque genera confianza en algo que no está pasando.
-- ============================================================
create table if not exists public.reinicios_mensuales (
  mes text primary key,                     -- 'YYYY-MM' del mes que se cerró
  corrido_at timestamptz not null default now(),
  origen text not null,                     -- 'cron' | 'manual'
  archivadas int,
  reseteadas int
);

alter table public.reinicios_mensuales enable row level security;

-- Lectura para todo el equipo: el aviso "el mes no se reinició" le sirve a cualquiera que
-- esté viendo datos raros, no sólo al jefe. No hay policy de escritura porque las únicas que
-- escriben son las funciones, que corren como SECURITY DEFINER y se saltean RLS.
drop policy if exists "reinicios lectura" on public.reinicios_mensuales;
create policy "reinicios lectura" on public.reinicios_mensuales for select
  using (auth.uid() is not null);

-- La tabla arranca VACÍA a propósito. Los reinicios que ya ocurrieron no dejaron rastro, y
-- completarlos ahora sería inventar historia: mejor que diga "no sé" a que mienta.


create or replace function public.reset_mes_manual(mes_a_cerrar text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  archivadas int;
  reseteadas int;
begin
  -- Sólo un jefe. La función corre con permisos plenos (SECURITY DEFINER), así que la
  -- verificación va ACÁ ADENTRO: si dependiera de quién la llama, cualquiera con la clave
  -- publicable —que viaja en el navegador— podría reiniciar el mes de todo el equipo.
  if not public.es_jefe() then
    raise exception 'Solo un jefe puede reiniciar el mes.';
  end if;

  -- El formato importa: `cards_archive.mes` es 'YYYY-MM' en todo el sistema. Un valor con
  -- otro formato no rompe nada hoy y hace que el histórico no cruce nunca más.
  if mes_a_cerrar !~ '^\d{4}-\d{2}$' then
    raise exception 'El mes tiene que venir como YYYY-MM (por ejemplo 2026-07). Llegó: %', mes_a_cerrar;
  end if;

  -- 1) Snapshot inmutable del mes que cierra. El delete previo lo hace idempotente:
  --    correrlo dos veces deja el mismo resultado, no dos copias.
  delete from public.cards_archive where mes = mes_a_cerrar;
  insert into public.cards_archive (owner, mes, card)
    select owner, mes_a_cerrar, to_jsonb(c) from public.cards c where c.card_type <> 'operativa';
  get diagnostics archivadas = row_count;

  -- 2) Reinicio, con las MISMAS condiciones que el reinicio automático de la migración 24.
  --    Se respetan 'mantener' y 'manual': quien eligió que su tarea no se reinicie, no se
  --    reinicia — ni siquiera en un reinicio manual.
  update public.cards c
    set status = 'pend',
        done_at = null,
        proc_at = null,
        checklist = coalesce(
          (select jsonb_agg(jsonb_set(jsonb_set(item, '{done}', 'false'), '{done_at}', 'null'))
           from jsonb_array_elements(c.checklist) item),
          '[]'::jsonb),
        history = c.history || jsonb_build_object(
          'who','Sistema','at', now(),
          'txt','Reinicio mensual manual (' || mes_a_cerrar || ' archivado)')
    where (c.recurring = true or c.recur_rule is not null)
      and coalesce(c.reset_policy, 'mensual') = 'mensual';
  get diagnostics reseteadas = row_count;

  -- 3) Dejar rastro. Sin esto volvemos al problema original: nadie sabe si el mes se
  --    reinició hasta que alguien nota datos raros, y para entonces ya perdió media mañana.
  insert into public.reinicios_mensuales (mes, corrido_at, origen, archivadas, reseteadas)
    values (mes_a_cerrar, now(), 'manual', archivadas, reseteadas)
    on conflict (mes) do update
      set corrido_at = excluded.corrido_at, origen = excluded.origen,
          archivadas = excluded.archivadas, reseteadas = excluded.reseteadas;

  return format('mes %s: %s archivadas, %s tareas reiniciadas', mes_a_cerrar, archivadas, reseteadas);
end;
$$;

-- Igual que las funciones de cron (migración 26): nadie la ejecuta desde el navegador con
-- la clave publicable. Se llama desde el SQL Editor, o desde la app por RPC con la sesión
-- de un jefe — y ahí la verificación de arriba es la que manda.
revoke execute on function public.reset_mes_manual(text) from public, anon;
grant execute on function public.reset_mes_manual(text) to authenticated;


-- ------------------------------------------------------------
-- CORRER EL REINICIO DE JULIO (esto es lo que destraba al equipo hoy)
--
--   select public.reset_mes_manual('2026-07');
--
-- Devuelve algo como: "mes 2026-07: 84 archivadas, 61 tareas reiniciadas".
--
-- Si "tareas reiniciadas" da 0 o un número mucho más chico del esperado, la causa es la B:
-- las tareas no están marcadas como recurrentes. Volvé al PASO 2.
-- ------------------------------------------------------------


-- ============================================================
-- PASO 4 — Que el reinicio AUTOMÁTICO también deje rastro.
--
-- Se recrea `reset_recurrentes_seguro()` idéntica a la de la migración 24, con lo único que
-- le faltaba: registrar que corrió. Así la app puede distinguir "el mes no se reinició" de
-- "el mes se reinició y no reinició nada porque no había nada que reiniciar", que son dos
-- situaciones muy distintas y hoy se ven exactamente igual.
-- ============================================================
create or replace function public.reset_recurrentes_seguro() returns text
language plpgsql security definer set search_path = public as $$
declare
  mes_cerrado text := to_char((now() at time zone 'America/Argentina/Buenos_Aires') - interval '1 day', 'YYYY-MM');
  archivadas int;
  reseteadas int;
begin
  delete from public.cards_archive where mes = mes_cerrado;
  insert into public.cards_archive (owner, mes, card)
    select owner, mes_cerrado, to_jsonb(c) from public.cards c where c.card_type <> 'operativa';
  get diagnostics archivadas = row_count;

  update public.cards c
    set status = 'pend',
        done_at = null,
        proc_at = null,
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

  insert into public.reinicios_mensuales (mes, corrido_at, origen, archivadas, reseteadas)
    values (mes_cerrado, now(), 'cron', archivadas, reseteadas)
    on conflict (mes) do update
      set corrido_at = excluded.corrido_at, origen = excluded.origen,
          archivadas = excluded.archivadas, reseteadas = excluded.reseteadas;

  return format('mes %s: %s archivadas, %s recurrentes reiniciadas', mes_cerrado, archivadas, reseteadas);
end;
$$;

-- Se vuelven a revocar los permisos: `create or replace` los conserva, pero dejarlo explícito
-- evita que un descuido futuro deje la función abierta (migración 26).
revoke execute on function public.reset_recurrentes_seguro() from public, anon, authenticated;


-- ------------------------------------------------------------
-- VERIFICAR QUE EL CRON EXISTE Y APUNTA A LA FUNCIÓN CORRECTA
--
-- Esto es lo que hay que mirar si el diagnóstico dio CAUSA A:
--
--   select jobid, schedule, command, active from cron.job order by jobid;
--
-- Tiene que haber un job activo que ejecute `select public.reset_recurrentes_seguro();`
-- el día 1 de cada mes. Si no está, o apunta a un nombre viejo de la v1, se crea así:
--
--   select cron.schedule('reset-recurrentes', '5 3 1 * *',
--                        $$select public.reset_recurrentes_seguro();$$);
--
-- (3:05 UTC del día 1 = 00:05 hora argentina. Después de medianoche, para que
--  `now() - 1 día` caiga en el mes que cierra.)
-- ------------------------------------------------------------

insert into public.schema_migrations (id, nombre)
  values (37, 'migracion-37-reinicio-mensual-manual.sql')
  on conflict (id) do nothing;
