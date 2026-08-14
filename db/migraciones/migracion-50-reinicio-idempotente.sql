-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 50
--  El reinicio mensual deja de destruir el archivo del mes cuando se corre dos veces.
--  Correr en Supabase -> SQL Editor. Es idempotente: se puede correr las veces que sea.
-- ============================================================================
--
--  ESTO CIERRA EL HALLAZGO 1 DE LA AUDITORÍA DEL 05/08, QUE ERA IRREVERSIBLE
--
--  `reset_mes_manual` y `reset_recurrentes_seguro` (migración 37) hacían, en este orden:
--
--      1) delete from cards_archive where mes = X          <- borra la foto del mes
--      2) insert into cards_archive ... select from cards  <- la rehace desde `cards`
--      3) update cards set status='pend', done_at=null ... <- y ACÁ muta `cards`
--
--  La primera corrida guarda la foto buena. La SEGUNDA borra esa foto y la reemplaza por una
--  sacada de `cards` DESPUÉS del paso 3, o sea con todo en pendiente y sin fechas de cierre.
--
--  El archivo de la 37 decía de sí mismo "idempotente: se puede correr las veces que sea". No
--  lo era, porque la fuente de la foto no es inmutable: el paso 3 la pisa.
--
--  QUÉ SE PIERDE, EN CONCRETO. El mes queda archivado con el 0% de cumplimiento, y no hay
--  vuelta atrás: los `done_at` que lo probaban se borraron de `cards` en el paso 3 y la copia
--  que los guardaba se borró en el paso 1. Ese 0% falso entra después en el historial, en el
--  promedio de meses, en la comparativa entre meses y en el bus factor. Un número inventado que
--  ya no se puede desmentir es peor que no tener el número.
--
--  Y EL ESCENARIO ERA PROBABLE, NO REBUSCADO. `reinicios_mensuales` arranca VACÍA a propósito
--  (los reinicios viejos no dejaron rastro y completarlos sería inventar historia). Entonces el
--  cartel "el mes pasado no se reinició" aparece igual aunque el cron haya archivado bien. Quien
--  lo ve aprieta "Reiniciar mes", que es exactamente lo que el cartel le sugiere hacer.
--
--  ----------------------------------------------------------------------------
--  DOS DEFENSAS, PORQUE UNA SOLA NO ALCANZA
--  ----------------------------------------------------------------------------
--
--    A) UNA GUARDA en las dos funciones: si ya hay fila en `reinicios_mensuales` para ese mes,
--       contestan "ya se cerró" y no tocan nada. Es la que evita el caso real.
--
--    B) EL `insert` PASA A `on conflict do nothing` y desaparece el `delete`. Es la que sirve
--       cuando alguien se saltea la guarda: corriendo la función desde el SQL Editor después de
--       haber borrado a mano la fila del registro, o con una corrida vieja que quedó colgada. La
--       guarda depende de que el registro esté bien; ésta no depende de nada.
--
--  La diferencia entre las dos es la que importa: A es una regla, B es una imposibilidad. Una
--  regla se puede saltear sin querer; la foto, con B, ya no se puede pisar.
--
--  LO QUE ESTA MIGRACIÓN NO TOCA, y conviene saberlo: `archivar_mes(p_mes)` (migración 22, el
--  botón "Archivar mes" de Administración) sigue haciendo `delete` + `insert`. Ahí es
--  deliberado —sirve para REHACER la foto del mes en curso, y la pantalla lo dice— y no muta
--  `cards`, así que no tiene el defecto de arriba. Queda anotado porque es la otra puerta que
--  escribe en `cards_archive`.
-- ============================================================================


-- ============================================================================
--  1) LA FOTO NO SE PUEDE PISAR: el índice único sobre (mes, id de la card)
--
--  La defensa B necesita una restricción única para poder decir `on conflict do nothing`. Sin
--  ella, la función falla al ejecutarse con "there is no unique or exclusion constraint matching
--  the ON CONFLICT specification" — y una función de cierre que revienta es peor que la que
--  tenemos.
--
--  ESE ÍNDICE YA EXISTE: lo crea la migración 22 como `cards_archive_mes_card_uidx` sobre
--  `(mes, (card->>'id'))`. El bloque de abajo NO lo da por hecho igual, porque si por lo que
--  fuera no se hubiera creado, esta migración tiene que poder crearlo — y crearlo puede fallar
--  si quedaron filas repetidas.
-- ============================================================================
do $$
declare
  borradas int;
begin
  if exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'cards_archive_mes_card_uidx'
  ) then
    -- Camino normal. Si el índice está, no puede haber repetidas: no hay nada que limpiar.
    raise notice 'cards_archive_mes_card_uidx ya existe; no hay filas repetidas que resolver.';
    return;
  end if;

  -- El índice NO está, así que puede haber repetidas y hay que resolverlas ANTES de crearlo.
  --
  -- CUÁL SE QUEDA, Y POR QUÉ. La más VIEJA de cada (mes, card). Es la única elección defendible
  -- acá: la primera foto de un mes se sacó antes de que el reinicio pusiera las tarjetas en
  -- pendiente; cualquier copia posterior del mismo mes sólo puede venir de una re-corrida, o
  -- sea que ya retrató el tablero reiniciado. Quedarse con la última sería consagrar
  -- exactamente el daño que esta migración viene a impedir.
  --
  -- `archived_at` nulo va al final: sin fecha no se puede afirmar que sea la primera, y se
  -- prefiere conservar la que sí tiene una fecha temprana comprobable. El desempate por `id`
  -- está para que el resultado no dependa del orden físico de la tabla.
  with ordenadas as (
    select id,
           row_number() over (
             partition by mes, (card->>'id')
             order by archived_at asc nulls last, id asc
           ) as n
      from public.cards_archive
  )
  delete from public.cards_archive a
   using ordenadas o
   where a.id = o.id and o.n > 1;
  get diagnostics borradas = row_count;

  if borradas > 0 then
    raise notice 'cards_archive: se descartaron % copias repetidas (se conservó la más vieja de cada mes/tarea).', borradas;
  end if;
end $$;

create unique index if not exists cards_archive_mes_card_uidx
  on public.cards_archive (mes, ((card->>'id')));


-- ============================================================================
--  2) EL REINICIO MANUAL — el botón "Reiniciar mes" del tablero
--
--  Se recrea entera (la 37 no se edita: las migraciones aplicadas no se tocan). Los únicos
--  cambios respecto de la 37 son la guarda del principio y el archivado sin `delete`.
-- ============================================================================
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

  -- ── DEFENSA A: LA GUARDA ────────────────────────────────────────────────────
  -- Si el mes ya está cerrado, no se hace NADA. Es el caso probable del hallazgo 1: el cartel
  -- del tablero sigue apareciendo (la tabla arranca vacía) y quien lo lee aprieta el botón.
  --
  -- CONTESTA EN VEZ DE LANZAR EXCEPCIÓN, y es deliberado: la misma guarda la usa el cron del
  -- punto 3, y un cron que aborta con error para decir "no había nada que hacer" ensucia el
  -- registro de trabajos hasta que se lo deja de mirar.
  --
  -- El prefijo `ya_cerrado:` es un CÓDIGO, no un mensaje. Lo lee `yaEstabaCerrado` en
  -- `src/lib/reinicio-mensual.ts` y el front escribe su propio texto en castellano; el usuario
  -- no ve nunca esta cadena. El resto de la línea es para quien la corra desde el SQL Editor.
  select * into ya from public.reinicios_mensuales where mes = mes_a_cerrar;
  if found then
    return format(
      'ya_cerrado: el mes %s ya se había cerrado el %s (origen %s, %s archivadas, %s reiniciadas). No se tocó nada.',
      mes_a_cerrar,
      to_char(ya.corrido_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'),
      ya.origen, coalesce(ya.archivadas, 0), coalesce(ya.reseteadas, 0));
  end if;

  -- ── DEFENSA B: LA FOTO NO SE PISA ───────────────────────────────────────────
  -- Antes acá había un `delete from cards_archive where mes = mes_a_cerrar` con el comentario
  -- "el delete previo lo hace idempotente". Hacía lo contrario: idempotente sería que la segunda
  -- corrida dejara el mismo resultado, y dejaba uno peor, porque el paso 3 de abajo ya había
  -- mutado la fuente. `on conflict do nothing` sí lo es — lo que está archivado, queda.
  insert into public.cards_archive (owner, mes, card)
    select c.owner, mes_a_cerrar, to_jsonb(c) from public.cards c where c.card_type <> 'operativa'
    on conflict (mes, ((card->>'id'))) do nothing;
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

  -- Con `on conflict do nothing`, `archivadas` cuenta lo que ENTRÓ, no lo que hay. Los dos
  -- números coinciden salvo que el mes ya tuviera algo archivado sin fila en el registro —el
  -- único caso donde la defensa B trabaja sola—, y ahí decir sólo "0 archivadas" sonaría a
  -- fracaso cuando en realidad la foto estaba a salvo. Se aclara únicamente cuando difieren.
  select count(*) into en_archivo from public.cards_archive where mes = mes_a_cerrar;
  if archivadas = en_archivo then
    return format('mes %s: %s archivadas, %s tareas reiniciadas', mes_a_cerrar, archivadas, reseteadas);
  end if;
  return format('mes %s: %s archivadas nuevas (%s en el archivo, ya estaban), %s tareas reiniciadas',
                mes_a_cerrar, archivadas, en_archivo, reseteadas);
end;
$$;

-- Igual que las funciones de cron (migración 26): nadie la ejecuta desde el navegador con
-- la clave publicable. Se llama desde el SQL Editor, o desde la app por RPC con la sesión
-- de un jefe — y ahí la verificación de arriba es la que manda.
revoke execute on function public.reset_mes_manual(text) from public, anon;
grant  execute on function public.reset_mes_manual(text) to authenticated;


-- ============================================================================
--  3) EL REINICIO AUTOMÁTICO — el cron del día 1 de cada mes
--
--  Mismas dos defensas. Acá la guarda protege de algo distinto y también real: pg_cron puede
--  reintentar un trabajo, y el día 1 la función se puede llegar a disparar dos veces.
-- ============================================================================
create or replace function public.reset_recurrentes_seguro() returns text
language plpgsql security definer set search_path = public as $$
declare
  mes_cerrado text := to_char((now() at time zone 'America/Argentina/Buenos_Aires') - interval '1 day', 'YYYY-MM');
  ya          public.reinicios_mensuales%rowtype;
  archivadas  int;
  en_archivo  int;
  reseteadas  int;
begin
  -- DEFENSA A. Misma marca que la función manual a propósito: un solo criterio para reconocer
  -- "no hice nada", en vez de dos redacciones que con el tiempo se separan. Acá no la lee el
  -- front —esta función no se llama desde la app—, la lee quien mira el registro del cron.
  select * into ya from public.reinicios_mensuales where mes = mes_cerrado;
  if found then
    return format(
      'ya_cerrado: el mes %s ya se había cerrado el %s (origen %s). No se tocó nada.',
      mes_cerrado,
      to_char(ya.corrido_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'),
      ya.origen);
  end if;

  -- DEFENSA B. Ver el punto 2: sin el `delete`, una corrida tardía no puede pisar la foto buena.
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

  insert into public.reinicios_mensuales (mes, corrido_at, origen, archivadas, reseteadas)
    values (mes_cerrado, now(), 'cron', archivadas, reseteadas)
    on conflict (mes) do update
      set corrido_at = excluded.corrido_at, origen = excluded.origen,
          archivadas = excluded.archivadas, reseteadas = excluded.reseteadas;

  select count(*) into en_archivo from public.cards_archive where mes = mes_cerrado;
  if archivadas = en_archivo then
    return format('mes %s: %s archivadas, %s recurrentes reiniciadas', mes_cerrado, archivadas, reseteadas);
  end if;
  return format('mes %s: %s archivadas nuevas (%s en el archivo, ya estaban), %s recurrentes reiniciadas',
                mes_cerrado, archivadas, en_archivo, reseteadas);
end;
$$;

-- Se vuelven a revocar los permisos: `create or replace` los conserva, pero dejarlo explícito
-- evita que un descuido futuro deje la función abierta (migración 26). El cron corre como
-- superusuario de la base, así que no necesita el grant.
revoke execute on function public.reset_recurrentes_seguro() from public, anon, authenticated;


-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) El índice único está (es lo que hace posible la defensa B):
--
--       select indexname, indexdef from pg_indexes
--        where schemaname = 'public' and tablename = 'cards_archive';
--
--     Esperado: `cards_archive_mes_card_uidx` sobre (mes, (card ->> 'id')).
--
--  2) No quedó ningún `delete from cards_archive` dentro de las dos funciones:
--
--       select proname, prosrc like '%delete from public.cards_archive%' as tiene_delete
--         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public'
--          and proname in ('reset_mes_manual','reset_recurrentes_seguro');
--
--     Esperado: las dos en `false`.
--
--  3) LA PRUEBA QUE IMPORTA — correr el reinicio de un mes YA CERRADO no toca nada.
--     Elegí un mes que figure en el registro:
--
--       select mes, corrido_at, origen, archivadas, reseteadas
--         from public.reinicios_mensuales order by mes desc;
--
--     Anotá cuántas filas tiene su archivo y cuántas están terminadas:
--
--       select count(*) filter (where card->>'status' = 'term') as terminadas, count(*) as total
--         from public.cards_archive where mes = '2026-07';   -- poné el mes que elegiste
--
--     Corré el reinicio de ese mismo mes:
--
--       select public.reset_mes_manual('2026-07');
--
--     Esperado: un texto que empieza con `ya_cerrado:`. Volvé a contar con la consulta de
--     arriba: los dos números tienen que dar EXACTAMENTE lo mismo que antes. Antes de esta
--     migración, `terminadas` daba 0 y no había forma de recuperarlo.
--
--  4) Desde el tablero: apretar "Reiniciar mes" sobre un mes ya cerrado tiene que mostrar
--     "El cierre de … ya estaba hecho, así que no se tocó nada", nunca el texto de la base, y
--     el cartel de reinicio pendiente tiene que desaparecer.

insert into public.schema_migrations (id, nombre)
  values (50, 'migracion-50-reinicio-idempotente.sql')
  on conflict (id) do nothing;
