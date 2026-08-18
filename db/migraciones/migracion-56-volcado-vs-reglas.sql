-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 56
--  El trigger de reglas de estado NO puede abortar el reinicio mensual.
--  Correr en Supabase -> SQL Editor. Se puede correr dos veces.
-- ============================================================================
--
--  UN CHOQUE ENTRE DOS MIGRACIONES DE ESTA MISMA TANDA, ENCONTRADO LEYENDO Y NO PROBANDO.
--
--  La 51 hace que el trabajo adelantado no desaparezca: cuando un mes futuro pasa a ser el
--  vigente, `volcar_periodo_a_cards` vuelca sobre `cards` lo que se había hecho por adelantado.
--  Si alguien adelantó una tarea y la dejó terminada, ese volcado escribe `status = 'term'`.
--
--  La 53 agrega el trigger que impide cerrar una tarea sin pasar por "En proceso".
--
--  JUNTAS SE ROMPEN, y de la peor manera posible. El orden dentro del reinicio es:
--
--     1. archivar el mes que termina
--     2. reiniciar las recurrentes  -> todas quedan en 'pend'
--     3. volcar lo adelantado       -> intenta escribir 'term' sobre una fila recién puesta en 'pend'
--
--  El paso 3 dispara la REGLA 1 del trigger: `old.status = 'pend'` y `new.status = 'term'`.
--  Y como una excepción en plpgsql aborta la TRANSACCIÓN ENTERA, no se pierde sólo el volcado:
--  **se cae el reinicio mensual completo**. El primer día 1 en que alguien haya adelantado una
--  tarea terminada, el cron falla y el equipo arranca el mes con las tareas del mes anterior.
--
--  Es exactamente el incidente del 04/08 otra vez, y este proyecto ya sabe lo que cuesta: media
--  mañana de gente mirando datos viejos sin entender por qué.
--
--  POR QUÉ NO ALCANZA LA GUARDA QUE YA TIENE EL TRIGGER
--
--  La 53 se protege de `sync_compartidas` con `pg_trigger_depth() > 1`. Acá no sirve:
--  `volcar_periodo_a_cards` es una función común llamada desde otra función común, no un
--  trigger, así que la profundidad es 0. Hace falta otra señal.
--
--  LA SEÑAL: UNA MARCA DE TRANSACCIÓN
--
--  El volcado avisa "esto que estoy escribiendo ya se validó" con un parámetro local a la
--  transacción, y el trigger lo respeta.
--
--  Y NO ES UNA EXCEPCIÓN DE CONVENIENCIA, que es lo que habría que sospechar de un `if` que
--  saltea una regla. El estado que se vuelca se validó cuando la persona marcó esa tarea como
--  terminada en el mes futuro: ahí corrió `bloqueoDeTransicion` de `transicion.ts`, con la tarea
--  en "En proceso" y el checklist completo. El volcado no es una decisión nueva, es la copia de
--  una vieja — el mismo razonamiento por el que se exceptúa a `sync_compartidas`.
--
--  `set_config(..., true)` la hace LOCAL a la transacción: se limpia sola al terminar, y una
--  conexión reusada del pool no arrastra el permiso a la operación siguiente. Con `false` sería
--  un agujero: cualquier update posterior en esa misma conexión saltearía las dos reglas.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) El volcado avisa
--
--    Idéntica a la de la migración 51 salvo el `set_config` de la primera línea. Va completa
--    porque `create or replace function` no admite parches.
-- ------------------------------------------------------------

create or replace function public.volcar_periodo_a_cards(mes_que_arranca text)
returns int language plpgsql security definer set search_path = public as $$
declare
  volcadas int;
begin
  if mes_que_arranca !~ '^\d{4}-\d{2}$' then
    return 0;
  end if;

  -- LA MARCA. Local a la transacción (`true`): se limpia sola al terminar y no viaja a la
  -- operación siguiente de una conexión reusada del pool.
  perform set_config('tablero.volcando_periodo', 'on', true);

  -- Los siete campos de estado, los mismos que declara CAMPOS_ESTADO en
  -- src/lib/periodo-escritura.ts. Si alguna vez se agrega uno allá, tiene que aparecer acá.
  update public.cards c
     set status    = p.status,
         checklist = p.checklist,
         comments  = p.comments,
         history   = p.history,
         done_at   = p.done_at,
         proc_at   = p.proc_at,
         due_date  = p.due_date
    from public.card_periodos p
   where p.card_id = c.id
     and p.periodo = mes_que_arranca
     and p.aplicado_at is null
     and c.card_type <> 'operativa';
  get diagnostics volcadas = row_count;

  update public.card_periodos
     set aplicado_at = now()
   where periodo = mes_que_arranca
     and aplicado_at is null;

  -- Se apaga en cuanto termina el volcado y NO se deja hasta el fin de la transacción: el
  -- reinicio sigue haciendo cosas después de llamar acá, y ninguna de ellas tiene por qué
  -- saltearse las reglas.
  perform set_config('tablero.volcando_periodo', 'off', true);

  return volcadas;
end;
$$;

revoke all on function public.volcar_periodo_a_cards(text) from public, anon;

-- ------------------------------------------------------------
-- 2) El trigger la respeta
--
--    Idéntico al de la migración 53 salvo el bloque nuevo. Va completo por lo mismo.
-- ------------------------------------------------------------

create or replace function public.cards_validar_estado() returns trigger
language plpgsql set search_path = public as $$
declare
  sin_marcar int;
begin
  -- Sólo interesa lo que AVANZA hacia terminado. Reabrir siempre se puede.
  -- `is distinct from` y no `<>`: con `new.status` en null, `<>` da null y la validación
  -- seguiría de largo sobre una fila que no va a terminado.
  if new.status is distinct from 'term' or old.status = 'term' then
    return new;
  end if;

  -- Lo que escribe otro trigger no se revalida (migración 53): `sync_compartidas` copia el
  -- estado a las tarjetas espejo de una tarea compartida, y esas hermanas están en Pendiente
  -- con el checklist sin tildar. Sin esta guarda, quien hizo todo bien no puede cerrar.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- LO NUEVO DE ESTA MIGRACIÓN. El volcado del trabajo adelantado tampoco se revalida: ese
  -- estado ya pasó por la regla cuando la persona cerró la tarea en el mes futuro. Sin esto, el
  -- reinicio mensual entero aborta el primer día 1 en que alguien haya adelantado algo.
  --
  -- `current_setting(..., true)` devuelve null si el parámetro no existe, en vez de lanzar
  -- error: en una transacción normal nadie lo definió, y ahí la regla tiene que correr.
  if coalesce(current_setting('tablero.volcando_periodo', true), 'off') = 'on' then
    return new;
  end if;

  -- REGLA 1: no se salta "En proceso".
  if old.status = 'pend' then
    raise exception 'regla_estado: Antes de terminarla, pasala a En proceso.';
  end if;

  -- REGLA 2: el checklist va completo. Sin checklist no hay nada que completar.
  -- El chequeo de `jsonb_typeof` y la comparación por texto evitan que una fila con forma rara
  -- tire un error crudo de Postgres que taparía la regla con un mensaje ilegible.
  if jsonb_typeof(new.checklist) = 'array' then
    select count(*) into sin_marcar
      from jsonb_array_elements(new.checklist) item
     where coalesce(item->>'done', '') <> 'true';
  else
    sin_marcar := 0;
  end if;

  if sin_marcar = 1 then
    raise exception 'regla_estado: Falta 1 paso del checklist.';
  elsif sin_marcar > 1 then
    raise exception 'regla_estado: Faltan % pasos del checklist.', sin_marcar;
  end if;

  return new;
end;
$$;

-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  ESTA ES LA PRUEBA QUE IMPORTA, y no espera al 1 de septiembre. Reproduce el choque exacto:
--  una tarea adelantada y terminada, volcada sobre una tarjeta que está en Pendiente.
--  Reemplazá <CARD_ID> por una tarea tuya de prueba.
--
--    -- 1) La tarjeta arranca en pendiente, como la deja el reinicio:
--    update public.cards set status = 'pend', done_at = null where id = '<CARD_ID>';
--
--    -- 2) Alguien la había adelantado y terminado en un mes futuro:
--    insert into public.card_periodos (card_id, owner, periodo, status, done_at)
--      select id, owner, '2099-01', 'term', now() from public.cards where id = '<CARD_ID>'
--      on conflict (card_id, periodo) do nothing;
--
--    -- 3) El volcado. SIN esta migración tira "regla_estado: Antes de terminarla...".
--    --    Con ella, devuelve 1.
--    select public.volcar_periodo_a_cards('2099-01');
--
--    select status from public.cards where id = '<CARD_ID>';   -- term
--
--    -- Limpieza:
--    delete from public.card_periodos where periodo = '2099-01';
--
--  Y QUE LA REGLA SIGA VIVA FUERA DEL VOLCADO — esto tiene que SEGUIR FALLANDO:
--
--    update public.cards set status = 'pend' where id = '<CARD_ID>';
--    update public.cards set status = 'term' where id = '<CARD_ID>';
--    -- ERROR: regla_estado: Antes de terminarla, pasala a En proceso.

insert into public.schema_migrations (id, nombre)
  values (56, 'migracion-56-volcado-vs-reglas.sql')
  on conflict (id) do nothing;
