-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 46
--  Que una tarea semanal vuelva CADA SEMANA, no una vez por mes.
--  Correr en Supabase -> SQL Editor. No borra ningún dato.
-- ============================================================================
--
--  ESTO CIERRA EL REPORTE DE YANI, MATHI Y ENZO
--
--  "Al completar una tarea con recurrencia semanal (ej. los jueves), el sistema la mantiene en
--  Finalizada de forma permanente y no crea la nueva ocurrencia."
--
--  LA CAUSA REAL, confirmada con el historial de corridas del cron:
--
--  El único proceso de recurrencias que existía era el reinicio MENSUAL, y mira
--  `where recurring` —el tilde de "se repite todos los meses"—. **No sabe nada de `recur_rule`**,
--  que es donde vive la recurrencia diaria y la semanal.
--
--  O sea: nunca hubo nada que mirara las semanales. No es que fallaba: no existía. Y el
--  historial lo confirma — `reset-recurrentes` no aparece ni una sola vez en las últimas 20
--  corridas, ni siquiera el 1 de agosto, cuando le tocaba.
--
--  QUÉ HACE ESTA MIGRACIÓN
--
--  Un proceso que corre todos los días a las 00:10 de Argentina y, para cada tarea recurrente
--  cuyo día llegó:
--
--    1. Guarda en `task_occurrences` que el ciclo anterior se completó. **Primero esto.**
--    2. Devuelve la tarjeta a Pendiente, con el vencimiento del ciclo nuevo.
--    3. Deja en el historial que fue un ciclo nuevo, NO una reapertura.
--
--  El orden del 1 y el 2 no es casual: si el update fallara, el registro del ciclo cumplido ya
--  quedó. Al revés, un fallo dejaría el ciclo cerrado sin ninguna evidencia de que se hizo.
--
--  Y NO SE DUPLICA LA TARJETA, que es lo que pide el punto 1.2 del reporte: es la misma tarjeta
--  cambiando de estado. Un solo contenedor por tarea, su historial completo en un solo lugar.
-- ============================================================================


-- ============================================================================
--  1) Primero, limpiar un job duplicado que dejó la migración 45
-- ============================================================================
--
--  La 45 hizo `cron.unschedule('materializar-mes')` y programó uno con ese nombre. Pero el job
--  que existía de antes se llama **`materializar`**, sin el sufijo. El unschedule no encontró
--  nada, y quedaron los dos programados: el viejo a las 00:05 UTC (que en Argentina son las
--  21:05 del último día del mes anterior, o sea el mes equivocado) y el nuevo a la hora correcta.
--
--  No es destructivo —la función es idempotente— pero es trabajo duplicado y, sobre todo, es
--  una configuración que nadie va a entender dentro de seis meses.

do $$
begin
  perform cron.unschedule('materializar');
exception when others then
  null;  -- No existía. Puede pasar si esta migración se corre dos veces.
end $$;


-- ============================================================================
--  2) El motor del ciclo diario
-- ============================================================================

create or replace function public.ciclo_recurrente_diario()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  dow int := extract(dow from hoy)::int;   -- 0=domingo .. 6=sábado, igual que en el front
  reactivadas int := 0;
  registradas int := 0;
  c record;
  proximo date;
begin
  -- Las tareas recurrentes TERMINADAS a las que hoy les toca volver.
  --
  -- La interpretación de la regla es la misma que en `materializar_mes_recurrentes` (migración
  -- 25) y que en `src/lib/recurrencia-ciclo.ts`. Las tres tienen que coincidir: si una dijera
  -- que hoy es día de la tarea y otra que no, la tarea se materializaría un día y volvería otro.
  for c in
    select id, owner, due_date, recur_rule, checklist, history
      from public.cards
     where status = 'term'
       and recur_rule is not null
       and coalesce(card_type, 'normal') <> 'operativa'
       and (
            recur_rule->>'tipo' = 'diaria'
         or (recur_rule->>'tipo' = 'semanal'
             and (recur_rule->'dias') @> to_jsonb(dow))
         or (recur_rule->>'tipo' = 'mensual'
             -- El día 31 en un mes de 30 cae el último día, para no saltear el mes entero.
             and extract(day from hoy)::int = least(
                   (recur_rule->>'diaMes')::int,
                   extract(day from (date_trunc('month', hoy) + interval '1 month - 1 day'))::int))
       )
  loop
    -- 1) El ciclo que se cierra queda registrado ANTES de tocar la tarjeta.
    --
    --    `done = true` porque la tarjeta estaba en `term`: el ciclo anterior se completó. La
    --    fecha es la del vencimiento que tenía, no la de hoy — es el día que le correspondía.
    --
    --    `on conflict do nothing`: si ya había una ocurrencia de ese día (por ejemplo porque la
    --    materialización la creó), no se pisa lo que la persona haya cargado ahí.
    insert into public.task_occurrences (card_id, owner, fecha, done, done_at)
      values (c.id, c.owner, coalesce(c.due_date, hoy - 1), true, now())
      on conflict (card_id, fecha) do nothing;
    registradas := registradas + coalesce((select 1 where found), 0);

    -- 2) El vencimiento del ciclo nuevo.
    proximo := case
      when c.recur_rule->>'tipo' = 'diaria' then hoy + 1
      when c.recur_rule->>'tipo' = 'mensual' then
        least(
          (date_trunc('month', hoy) + interval '1 month')::date
            + ((c.recur_rule->>'diaMes')::int - 1),
          (date_trunc('month', hoy) + interval '2 month - 1 day')::date)
      else
        -- Semanal: el próximo día marcado, mirando los siete que vienen.
        (select d::date
           from generate_series(hoy + 1, hoy + 7, interval '1 day') d
          where (c.recur_rule->'dias') @> to_jsonb(extract(dow from d)::int)
          order by d limit 1)
    end;

    -- 3) La tarjeta vuelve a Pendiente. Es la MISMA tarjeta: no se duplica nada.
    update public.cards
       set status = 'pend',
           done_at = null,
           due_date = proximo,
           -- Destildar los pasos, conservando el texto de cada uno.
           checklist = coalesce(
             (select jsonb_agg(i || '{"done":false,"done_at":null}'::jsonb)
                from jsonb_array_elements(coalesce(checklist, '[]'::jsonb)) i),
             '[]'::jsonb),
           -- El texto DEBE decir "ciclo" y no "reabrió": `src/lib/retrabajo.ts` cuenta las
           -- reaperturas leyendo el historial, y ese índice se le muestra al jefe. Si el
           -- reinicio automático usara el texto de reapertura, una tarea diaria inflaría el
           -- retrabajo unos 20 puntos por mes ella sola, y el equipo aparecería rehaciendo
           -- trabajo que nunca rehízo.
           history = coalesce(history, '[]'::jsonb) || jsonb_build_object(
             'who', 'Sistema',
             'at', now(),
             'txt', 'Nuevo ciclo de la recurrencia'
           )
     where id = c.id;

    reactivadas := reactivadas + 1;
  end loop;

  return format('%s: %s tareas reactivadas, %s ciclos registrados', hoy, reactivadas, registradas);
end;
$$;

-- Sólo la corre el cron. Nadie más tiene por qué reactivar tareas por HTTP.
--
-- `from public` y no sólo `from anon`: en PostgreSQL toda función se crea con EXECUTE otorgado a
-- PUBLIC, y todos los roles heredan de ahí. Revocarle a `anon` sin revocarle a `PUBLIC` no le
-- saca nada — eso ya pasó con `archivar_mes` en la migración 26, donde la línea estaba escrita y
-- no protegía nada.
revoke execute on function public.ciclo_recurrente_diario() from public, anon, authenticated;


-- ============================================================================
--  3) Programarlo
-- ============================================================================
--
--  HORARIO EN UTC. `10 3 * * *` son las 00:10 de Argentina (UTC-3). Escribir `10 0 * * *` lo
--  pondría a las 21:10 del día anterior, que reactivaría las tareas un día antes — el error que
--  ya cometió el job de materialización y que se arregla en el punto 1.

do $$
begin
  perform cron.unschedule('ciclo-recurrente');
exception when others then
  null;
end $$;

select cron.schedule(
  'ciclo-recurrente',
  '10 3 * * *',
  $$select public.ciclo_recurrente_diario()$$
);


-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) Los jobs, que ahora tienen que ser cuatro y sin duplicados:
--
--       select jobname, schedule, active from cron.job order by jobname;
--
--     Esperado: ciclo-recurrente (10 3 * * *), materializar-mes (15 3 1 * *),
--               reset-recurrentes (5 3 1 * *), snapshot-diario (40 2 * * *).
--     **Si sigue apareciendo `materializar` a secas, el punto 1 no corrió.**
--
--  2) Probarlo sin esperar a mañana. Devuelve un texto con lo que hizo y es seguro repetirlo:
--
--       select public.ciclo_recurrente_diario();
--
--     Si hoy no le toca a ninguna tarea, va a decir "0 tareas reactivadas". Eso también es un
--     resultado correcto: significa que corrió y no había nada que hacer.
--
--  3) La prueba de verdad, la que contesta lo que reportó el equipo: tomá una tarea semanal de
--     los jueves, marcala Terminada, y el jueves siguiente a la mañana tiene que estar en
--     Pendiente con el vencimiento corrido. En su historial va a decir "Nuevo ciclo de la
--     recurrencia", y **no** va a contar como reapertura en el índice de retrabajo.
--
--  4) Y de acá en adelante, si algo no vuelve, la respuesta está en una consulta y no en una
--     suposición:
--
--       select j.jobname, r.status, r.start_time, r.return_message
--         from cron.job_run_details r join cron.job j on j.jobid = r.jobid
--        where j.jobname = 'ciclo-recurrente'
--        order by r.start_time desc limit 10;

insert into public.schema_migrations (id, nombre)
  values (46, 'migracion-46-ciclo-recurrente-diario.sql')
  on conflict (id) do nothing;
