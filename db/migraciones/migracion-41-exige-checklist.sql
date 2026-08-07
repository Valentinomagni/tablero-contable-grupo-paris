-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 41
--  Tareas que no se pueden cerrar con el checklist a medias.
--  Correr en Supabase -> SQL Editor. No toca ningún dato existente.
-- ============================================================================
--
--  QUÉ HABILITA
--
--  Al crear o editar una tarea aparece una casilla: "no se puede cerrar con pasos sin tildar".
--  Si la marcás, esa tarea no pasa a Terminada mientras queden ítems del checklist sin hacer,
--  ni desde el tablero, ni desde el cierre rápido de Mi día, ni arrastrándola.
--
--  POR QUÉ ES UNA CASILLA POR TAREA Y NO UNA REGLA PARA TODAS
--
--  La opción simple era: cualquier tarea con ítems sin tildar no se cierra. Se descartó por un
--  motivo concreto. Mucha gente usa el checklist como notas sueltas —"preguntar a Ana",
--  "revisar el mail de ayer"— y una regla global haría que borren los ítems para poder cerrar.
--  O sea: se perdería exactamente el dato que el checklist venía a guardar, y encima en
--  silencio.
--
--  Con la casilla, quien arma una conciliación de IVA decide que ahí los pasos son
--  obligatorios, y quien anota recordatorios en una tarea suelta no queda trabado.
--
--  Y sigue el patrón que la app ya tiene: `requiere_resultado` hace lo mismo para los arqueos
--  —marca una tarea como "acá no se cierra de cualquier manera"— y ya está probado. Inventar
--  un segundo mecanismo para el mismo problema sería duplicar.
--
--  ESTO NO CAMBIA NINGUNA TAREA EXISTENTE. La columna arranca en `false` para todas, así que
--  hasta que marques la primera casilla, nada se comporta distinto.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) La columna
--
--    `not null default false`: el default importa. Sin él, las tareas viejas quedarían en
--    `null` y habría que preguntarse en cada lugar del código si `null` significa "no exige"
--    o "no sé". Ante la duda, no bloquear — pero es mejor que la duda no exista.
-- ------------------------------------------------------------

alter table public.cards
  add column if not exists exige_checklist boolean not null default false;

comment on column public.cards.exige_checklist is
  'Si es true, la tarea no puede pasar a status=term mientras queden items del checklist sin done. Ver src/lib/checklist-gate.ts';

-- ------------------------------------------------------------
-- 2) Verificación — corré esto y mirá el resultado
--
--    La primera tiene que devolver la columna con default false.
--    La segunda, cuántas tareas la tienen activada (al principio: 0).
-- ------------------------------------------------------------

-- select column_name, data_type, column_default, is_nullable
--   from information_schema.columns
--  where table_name = 'cards' and column_name = 'exige_checklist';

-- select count(*) as tareas_que_lo_exigen from public.cards where exige_checklist = true;

-- ------------------------------------------------------------
-- 3) Registro
-- ------------------------------------------------------------

insert into public.schema_migrations (id, nombre)
  values (41, 'migracion-41-exige-checklist.sql')
  on conflict (id) do nothing;
