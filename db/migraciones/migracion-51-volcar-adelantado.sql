-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 51
--  El trabajo adelantado deja de desaparecer cuando llega el mes.
--  Correr en Supabase -> SQL Editor. Se puede correr dos veces.
-- ============================================================================
--
--  HALLAZGO 4 DE LA AUDITORÍA DEL 05/08. Y TIENE FECHA: EL 1 DE SEPTIEMBRE.
--
--  El diseño de períodos es asimétrico, y las dos mitades son deliberadas:
--
--    ESCRIBE en `card_periodos` cuando el mes que mirás NO es el vigente
--      (`escribeEnPeriodo`, src/lib/periodo-escritura.ts:51)
--    LEE de `cards` cuando el mes SÍ es el vigente
--      (`cardsDelPeriodo`, src/lib/periodo-instancias.ts:87)
--
--  Mientras septiembre es futuro, lo que alguien adelanta va a `card_periodos`. Cuando llega el
--  1/9 y septiembre pasa a ser el mes vigente, la lectura cambia de fuente: la app empieza a
--  leer `cards`, y esas filas quedan huérfanas. Para siempre.
--
--  EL ESCENARIO CONCRETO, tal cual lo describió la auditoría: el 20 de julio alguien adelanta
--  agosto y marca 10 tareas como terminadas. El 1 de agosto el cron reinicia las tarjetas, el
--  tablero lee las tarjetas crudas, y las 10 vuelven a aparecer pendientes. El trabajo
--  adelantado no está en ninguna pantalla ni en ninguna métrica.
--
--  Y adelantar trabajo era el motivo declarado de TODO el diseño de períodos.
--
--  QUÉ HACE ESTA MIGRACIÓN
--
--  Agrega un paso al final del reinicio mensual, en las dos funciones: después de reiniciar las
--  tarjetas, vuelca sobre `cards` las filas de `card_periodos` del mes que ARRANCA, y las marca
--  como volcadas.
--
--  EL ORDEN IMPORTA Y NO ES INTERCAMBIABLE: el volcado va DESPUÉS del reinicio. Al revés, el
--  reinicio pisaría lo que se acaba de volcar y el bug seguiría igual, sólo que más difícil de
--  encontrar.
--
--  POR QUÉ SE MARCAN EN VEZ DE BORRARSE
--
--  Una vez volcada, la fila no se puede seguir leyendo. Si el mes más adelante deja de ser
--  vigente, `cardsDelPeriodo` la mergearía otra vez y mostraría la foto adelantada POR ENCIMA de
--  todo lo que se hizo durante el mes: se salvaría el trabajo adelantado a costa de tapar el
--  real, que es cambiar un bug por otro peor.
--
--  Borrarlas resolvería eso y sería irreversible. Marcarlas deja ver qué se volcó y cuándo, que
--  es lo que hace falta el día que alguien pregunte por qué una tarea aparece terminada.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) La marca
-- ------------------------------------------------------------

alter table public.card_periodos add column if not exists aplicado_at timestamptz;

comment on column public.card_periodos.aplicado_at is
  'Cuando el reinicio mensual volco esta fila sobre cards. Null = todavia es un mes futuro. Una fila con este campo NO se vuelve a leer: su contenido ya vive en la tarjeta.';

-- Las filas de meses YA PASADOS no se tocan: quedan en null. Volcarlas ahora sobre `cards`
-- sobrescribiría el mes en curso con estado viejo, que es exactamente el daño que se evita.
-- Sólo se vuelca en el momento del cambio de mes, que es cuando corresponde.

-- ------------------------------------------------------------
-- 2) El volcado, como función aparte
--
--    Aparte y no copiada dentro de cada reinicio: el hallazgo 2 de esta misma auditoría existe
--    porque un criterio estaba escrito dos veces y con el tiempo divergió.
-- ------------------------------------------------------------

create or replace function public.volcar_periodo_a_cards(mes_que_arranca text)
returns int language plpgsql security definer set search_path = public as $$
declare
  volcadas int;
begin
  if mes_que_arranca !~ '^\d{4}-\d{2}$' then
    return 0;
  end if;

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
     -- Las operativas nunca escriben en `card_periodos` (`escribeEnPeriodo` las excluye). El
     -- filtro va igual: si alguna vez entrara una fila por otro camino, volcarla borraría el
     -- contador del día de una tarea a demanda.
     and c.card_type <> 'operativa';
  get diagnostics volcadas = row_count;

  update public.card_periodos
     set aplicado_at = now()
   where periodo = mes_que_arranca
     and aplicado_at is null;

  return volcadas;
end;
$$;

revoke all on function public.volcar_periodo_a_cards(text) from public, anon;

comment on function public.volcar_periodo_a_cards(text) is
  'Vuelca sobre cards el trabajo adelantado del mes que arranca y marca las filas como volcadas. La llama el reinicio mensual DESPUES de reiniciar: al reves, el reinicio pisaria lo volcado.';

-- ------------------------------------------------------------
-- 3) Engancharlo a las dos funciones de reinicio
--
--    `create or replace function` exige el cuerpo entero, así que las dos van completas. Son
--    IDÉNTICAS a las de la migración 50 salvo el paso 4, que es lo nuevo. Si comparás las dos
--    migraciones, ése tiene que ser el único cambio.
--
--    El texto que devuelven suma el dato del volcado: un volcado silencioso es indistinguible
--    de que no pasó nada, y ya tuvimos un cron que fallaba callado durante un mes entero.
-- ------------------------------------------------------------

create or replace function public.reset_mes_manual(mes_a_cerrar text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ya          public.reinicios_mensuales%rowtype;
  archivadas  int;
  en_archivo  int;
  reseteadas  int;
  volcadas    int;
  mes_nuevo   text;
begin
  if not public.es_jefe() then
    raise exception 'Solo un jefe puede reiniciar el mes.';
  end if;

  if mes_a_cerrar !~ '^\d{4}-\d{2}$' then
    raise exception 'El mes tiene que venir como YYYY-MM (por ejemplo 2026-07). Llegó: %', mes_a_cerrar;
  end if;

  -- DEFENSA A (migración 50): si el mes ya está cerrado, no se toca NADA. Contesta con el
  -- código `ya_cerrado:` en vez de lanzar excepción, porque la misma guarda la usa el cron.
  select * into ya from public.reinicios_mensuales where mes = mes_a_cerrar;
  if found then
    return format(
      'ya_cerrado: el mes %s ya se había cerrado el %s (origen %s, %s archivadas, %s reiniciadas). No se tocó nada.',
      mes_a_cerrar,
      to_char(ya.corrido_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'),
      ya.origen, coalesce(ya.archivadas, 0), coalesce(ya.reseteadas, 0));
  end if;

  -- DEFENSA B (migración 50): `on conflict do nothing`, nunca `delete` + `insert`.
  insert into public.cards_archive (owner, mes, card)
    select c.owner, mes_a_cerrar, to_jsonb(c) from public.cards c where c.card_type <> 'operativa'
    on conflict (mes, ((card->>'id'))) do nothing;
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
          'txt','Reinicio mensual manual (' || mes_a_cerrar || ' archivado)')
    where (c.recurring = true or c.recur_rule is not null)
      and coalesce(c.reset_policy, 'mensual') = 'mensual';
  get diagnostics reseteadas = row_count;

  -- ── PASO 4: LO NUEVO DE ESTA MIGRACIÓN ──────────────────────────────────────
  -- Va DESPUÉS del reinicio. Al revés, el reinicio de arriba pisaría lo recién volcado y el
  -- trabajo adelantado se perdería igual, sólo que con una función más donde buscar el bug.
  --
  -- El mes que arranca es el siguiente al que se cierra: `mes_a_cerrar || '-01'` a date, más un
  -- mes. Se calcula así y no con `now()` porque un cierre manual puede correrse tarde, y ahí
  -- "el mes que viene" y "el mes actual" no son lo mismo.
  mes_nuevo := to_char((to_date(mes_a_cerrar || '-01', 'YYYY-MM-DD') + interval '1 month'), 'YYYY-MM');
  volcadas := public.volcar_periodo_a_cards(mes_nuevo);

  insert into public.reinicios_mensuales (mes, corrido_at, origen, archivadas, reseteadas)
    values (mes_a_cerrar, now(), 'manual', archivadas, reseteadas)
    on conflict (mes) do update
      set corrido_at = excluded.corrido_at, origen = excluded.origen,
          archivadas = excluded.archivadas, reseteadas = excluded.reseteadas;

  select count(*) into en_archivo from public.cards_archive where mes = mes_a_cerrar;
  if archivadas = en_archivo then
    return format('mes %s: %s archivadas, %s tareas reiniciadas, %s adelantadas de %s',
                  mes_a_cerrar, archivadas, reseteadas, volcadas, mes_nuevo);
  end if;
  return format('mes %s: %s archivadas nuevas (%s en el archivo, ya estaban), %s tareas reiniciadas, %s adelantadas de %s',
                mes_a_cerrar, archivadas, en_archivo, reseteadas, volcadas, mes_nuevo);
end;
$$;

create or replace function public.reset_recurrentes_seguro() returns text
language plpgsql security definer set search_path = public as $$
declare
  mes_cerrado text := to_char((now() at time zone 'America/Argentina/Buenos_Aires') - interval '1 day', 'YYYY-MM');
  mes_nuevo   text := to_char((now() at time zone 'America/Argentina/Buenos_Aires'), 'YYYY-MM');
  ya          public.reinicios_mensuales%rowtype;
  archivadas  int;
  en_archivo  int;
  reseteadas  int;
  volcadas    int;
begin
  select * into ya from public.reinicios_mensuales where mes = mes_cerrado;
  if found then
    return format(
      'ya_cerrado: el mes %s ya se había cerrado el %s (origen %s). No se tocó nada.',
      mes_cerrado,
      to_char(ya.corrido_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'),
      ya.origen);
  end if;

  insert into public.cards_archive (owner, mes, card)
    select c.owner, mes_cerrado, to_jsonb(c) from public.cards c where c.card_type <> 'operativa'
    on conflict (mes, ((card->>'id'))) do nothing;
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

  -- PASO 4, igual que en la manual y por la misma razón: después del reinicio, nunca antes.
  -- Acá `mes_nuevo` sí sale de `now()`: el cron corre a las 00:15 del día 1 (migración 45), o
  -- sea que el mes de hoy ES el que arranca.
  volcadas := public.volcar_periodo_a_cards(mes_nuevo);

  insert into public.reinicios_mensuales (mes, corrido_at, origen, archivadas, reseteadas)
    values (mes_cerrado, now(), 'cron', archivadas, reseteadas)
    on conflict (mes) do update
      set corrido_at = excluded.corrido_at, origen = excluded.origen,
          archivadas = excluded.archivadas, reseteadas = excluded.reseteadas;

  select count(*) into en_archivo from public.cards_archive where mes = mes_cerrado;
  if archivadas = en_archivo then
    return format('mes %s: %s archivadas, %s recurrentes reiniciadas, %s adelantadas de %s',
                  mes_cerrado, archivadas, reseteadas, volcadas, mes_nuevo);
  end if;
  return format('mes %s: %s archivadas nuevas (%s en el archivo, ya estaban), %s recurrentes reiniciadas, %s adelantadas de %s',
                mes_cerrado, archivadas, en_archivo, reseteadas, volcadas, mes_nuevo);
end;
$$;

-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) La columna y la función existen:
--
--       select column_name from information_schema.columns
--        where table_name = 'card_periodos' and column_name = 'aplicado_at';
--
--       select proname from pg_proc where proname = 'volcar_periodo_a_cards';
--
--  2) Prueba de punta a punta, SIN esperar al 1 de septiembre. Elegí una tarea tuya de prueba
--     y reemplazá <CARD_ID>. Esto simula "alguien adelantó el mes que viene":
--
--       insert into public.card_periodos (card_id, owner, periodo, status, done_at)
--         select id, owner, '2099-01', 'term', now() from public.cards where id = '<CARD_ID>'
--         on conflict (card_id, periodo) do nothing;
--
--       select public.volcar_periodo_a_cards('2099-01');   -- devuelve 1
--       select status, done_at from public.cards where id = '<CARD_ID>';        -- term
--       select aplicado_at from public.card_periodos where periodo = '2099-01'; -- con fecha
--
--       -- Correrlo de nuevo NO tiene que volcar nada, porque ya está marcada:
--       select public.volcar_periodo_a_cards('2099-01');   -- devuelve 0
--
--     Limpieza de la prueba:
--       delete from public.card_periodos where periodo = '2099-01';
--
--  3) Un mes inválido no hace nada y no explota:
--
--       select public.volcar_periodo_a_cards('cualquier cosa');  -- 0

insert into public.schema_migrations (id, nombre)
  values (51, 'migracion-51-volcar-adelantado.sql')
  on conflict (id) do nothing;
