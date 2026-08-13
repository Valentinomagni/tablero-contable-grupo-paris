-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 45
--  El motor de recurrencias existía y nunca estuvo enchufado.
--  Correr en Supabase -> SQL Editor. URGENTE: hoy el reinicio mensual está roto.
-- ============================================================================
--
--  ESTO RESUELVE LO QUE REPORTARON YANI, MATHI Y ENZO
--
--  El reporte dice: "las tareas programadas no se generan; una tarea semanal de los jueves
--  queda en Finalizada para siempre". Y concluye que falta implementar el scheduler.
--
--  **El scheduler existe. Nunca estuvo conectado.** Eso es lo que encontró la revisión, y
--  cambia por completo el tamaño del arreglo: no hay que construir un motor, hay que apuntar el
--  cron a la función correcta.
--
--  LO QUE HABÍA, EN ORDEN CRONOLÓGICO
--
--   1. La versión 1 programó:  cron.schedule('reset-recurrentes', '0 3 1 * *',
--                                            'select public.reset_recurring()')
--      Esa función sólo mira `where recurring` — el tilde de "mensual". **No sabe nada de
--      `recur_rule`**, que es donde viven las recurrencias diaria y semanal. Por eso una tarea
--      de los jueves nunca volvió: ningún proceso la miraba.
--
--   2. La migración 24 escribió `reset_recurrentes_seguro()`, que sí filtra
--      `(recurring = true or recur_rule is not null)` y respeta `reset_policy`.
--      **Y nadie apuntó el cron a ella.**
--
--   3. Las migraciones 29 y 37 la mejoraron dos veces más. El cron siguió apuntando a la vieja.
--
--   4. La migración 37 escribió la línea correcta del cron… **dentro de un comentario**
--      (línea 264, empieza con `--`). Quedó como instrucción para alguien, y nadie la corrió.
--
--   5. Y la migración 43 borró `reset_recurring()` por ser destructiva y estar abierta a
--      internet. **Efecto colateral: desde entonces el cron mensual apunta a una función que ya
--      no existe y falla entero.** Eso es responsabilidad de quien escribió la 43 y se arregla acá.
--
--  O sea: tres migraciones escribieron el motor bueno, una lo documentó, y el cron nunca se
--  movió. Es el mismo patrón de todo este proyecto —algo que parece estar hecho y no está
--  conectado— pero esta vez le costó tiempo de trabajo real a cuatro personas.
--
--  LO QUE NO ARREGLA ESTA MIGRACIÓN, Y HAY QUE DECIRLO
--
--  El reinicio mensual devuelve una tarea recurrente a Pendiente el día 1. Eso cubre las
--  MENSUALES. Las **diarias y semanales** necesitan además que se materialicen sus ocurrencias,
--  y eso lo hace `materializar_mes_recurrentes()`, que también se programa acá.
--
--  Pero el comportamiento que pide el punto 1.2 del reporte —que una tarea semanal de los
--  jueves vuelva a Pendiente CADA jueves, no una vez por mes— **todavía no existe en ninguna
--  función**. Se construye en la migración 46, con su propia lógica y sus tests.
-- ============================================================================


-- ------------------------------------------------------------
-- 1) Sacar el cron viejo, que apunta a una función borrada
--
--    `cron.unschedule` por nombre. Si no existe, no falla: por eso el bloque.
-- ------------------------------------------------------------

do $$
begin
  perform cron.unschedule('reset-recurrentes');
exception when others then
  -- No estaba programado. No es un error: puede pasar si esta migración se corre dos veces.
  null;
end $$;


-- ------------------------------------------------------------
-- 2) Programar el bueno
--
--    HORARIO EN UTC, y esto ya se equivocó una vez en este proyecto. pg_cron corre en UTC:
--    `5 3 1 * *` son las 00:05 del día 1 en Argentina (UTC-3). Escribir `5 0 1 * *` lo pondría
--    a las 21:05 del último día del mes ANTERIOR, que es justo lo que no se quiere.
--
--    Y va después de medianoche a propósito: la función usa `now() - 1 día` para saber qué mes
--    cierra, así que tiene que correr cuando el mes nuevo ya empezó.
-- ------------------------------------------------------------

select cron.schedule(
  'reset-recurrentes',
  '5 3 1 * *',
  $$select public.reset_recurrentes_seguro()$$
);


-- ------------------------------------------------------------
-- 3) Materializar las ocurrencias del mes que arranca
--
--    Esto es lo que hace que una tarea con `recur_rule` (diaria o semanal) tenga sus filas en
--    `task_occurrences` para el mes nuevo. Sin esto, el calendario y la grilla de arqueo
--    aparecen vacíos hasta que alguien abre la tarjeta a mano.
--
--    Diez minutos después del reinicio, para que no se pisen.
-- ------------------------------------------------------------

do $$
begin
  perform cron.unschedule('materializar-mes');
exception when others then
  null;
end $$;

select cron.schedule(
  'materializar-mes',
  '15 3 1 * *',
  $$select public.materializar_mes_recurrentes(
      extract(year  from (now() at time zone 'America/Argentina/Buenos_Aires'))::int,
      extract(month from (now() at time zone 'America/Argentina/Buenos_Aires'))::int)$$
);


-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) Los dos jobs, con su horario y a qué apuntan:
--
--       select jobname, schedule, active, command from cron.job order by jobname;
--
--     Esperado: `reset-recurrentes` -> '5 3 1 * *' -> reset_recurrentes_seguro()
--               `materializar-mes`  -> '15 3 1 * *'
--               `snapshot-diario`   -> '40 2 * * *' (el de la v1, ese está bien)
--
--  2) Si corrieron o fallaron, y cuándo. **Esta es la consulta que había que mirar hace meses:**
--
--       select j.jobname, r.status, r.start_time, r.return_message
--         from cron.job_run_details r join cron.job j on j.jobid = r.jobid
--        order by r.start_time desc limit 20;
--
--     Si aparece `failed` con "function public.reset_recurring() does not exist", ése es el
--     error que esta migración viene a cerrar.
--
--  3) Probar el reinicio sin esperar al día 1, sobre un mes ya cerrado (es idempotente y
--     devuelve un texto con lo que hizo):
--
--       select public.reset_recurrentes_seguro();

insert into public.schema_migrations (id, nombre)
  values (45, 'migracion-45-cron-recurrencias.sql')
  on conflict (id) do nothing;
