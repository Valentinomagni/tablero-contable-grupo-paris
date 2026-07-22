-- ============================================================
-- Migración 30 — Analítica: triggers, full-text y vista materializada
-- (spec 28, fase C)
-- Correr COMPLETO en Supabase → SQL Editor. Idempotente (se puede
-- correr las veces que haga falta, en cualquier orden respecto de
-- las migraciones 26/27/28/29, sin romper nada).
--
-- 1) Trigger de notificaciones en el servidor: cuando una card pasa a
--    'term', avisa al manager del dueño. Réplica fiel de la regla
--    `notifsAlFinalizar` de src/lib/notificaciones.ts.
--    >>> SE CREA DESACTIVADO A PROPÓSITO. Ver la ADVERTENCIA de abajo.
-- 2) Búsqueda full-text sobre cards (columna generada tsv + índice GIN
--    + función public.buscar_cards(q) que respeta RLS).
-- 3) Vista materializada public.mv_resumen_mensual (KPIs por mes /
--    owner / marca) desde public.cards_archive, con índice único para
--    poder refrescarla con REFRESH ... CONCURRENTLY desde un cron.
-- 4) Autoregistro en public.schema_migrations (id 30).
-- ============================================================

-- ------------------------------------------------------------
-- 0) schema_migrations por si esta migración se corre antes que
--    la 28 (que es la que crea la tabla normalmente).
-- ------------------------------------------------------------
create table if not exists public.schema_migrations (
  id int primary key,
  nombre text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;

drop policy if exists "schema_migrations_select" on public.schema_migrations;
create policy "schema_migrations_select" on public.schema_migrations
  for select using (auth.role() = 'authenticated');


-- ############################################################
-- ############################################################
-- ##                                                        ##
-- ##   ADVERTENCIA — LEER ANTES DE ACTIVAR EL TRIGGER (1)   ##
-- ##                                                        ##
-- ##   HOY el cliente (src/features/board/CardModal.tsx)    ##
-- ##   YA inserta esta misma notificación al finalizar una  ##
-- ##   tarea, llamando a notifsAlFinalizar().               ##
-- ##                                                        ##
-- ##   Si el trigger de servidor queda ACTIVO mientras el   ##
-- ##   cliente sigue insertando, CADA FINALIZACIÓN GENERA   ##
-- ##   DOS NOTIFICACIONES IDÉNTICAS. El encargado y el      ##
-- ##   jefe reciben TODO DUPLICADO.                         ##
-- ##                                                        ##
-- ##   Por eso el trigger se crea DESACTIVADO (disable      ##
-- ##   trigger, al final de la sección 1). Correr esta      ##
-- ##   migración es SEGURO en cualquier momento.            ##
-- ##                                                        ##
-- ##   Activarlo es un paso manual de UN SOLO comando, y    ##
-- ##   SOLO se hace JUNTO CON el deploy de la Task 11 de    ##
-- ##   esta fase (la que quita el insert del cliente):      ##
-- ##                                                        ##
-- ##     alter table public.cards                           ##
-- ##       enable trigger cards_notificar_finalizacion;     ##
-- ##                                                        ##
-- ##   Para volver atrás (si el deploy se revierte):        ##
-- ##                                                        ##
-- ##     alter table public.cards                           ##
-- ##       disable trigger cards_notificar_finalizacion;    ##
-- ##                                                        ##
-- ##   Detalle en docs/PASOS-MANUALES.md → "Migración 30".  ##
-- ##                                                        ##
-- ############################################################
-- ############################################################

-- ------------------------------------------------------------
-- 1) Trigger de notificación al finalizar una tarea.
--
-- Réplica EXACTA de notifsAlFinalizar() (src/lib/notificaciones.ts):
--   - Solo si la tarea "tiene impacto": priority = 'alta' O due_date no nulo.
--     (tieneImpacto — finalizaciones sin impacto son ruido y no se notifican.)
--   - Destinatario: el manager_id del DUEÑO de la card (no del que la cerró).
--   - Nada si el dueño no tiene manager, o si el manager es el mismo que cerró.
--   - tipo 'avance', título "Tarea importante terminada",
--     detalle `<actor> terminó "<title>"` + " (prioridad alta)" si corresponde.
--
-- Extra respecto del cliente: si no hay auth.uid() (cron / service key /
-- reset_recurrentes_seguro) no se notifica nada. El cliente tampoco lo hace:
-- su guarda es `if (p.status === "term" && meId)`.
--
-- SECURITY DEFINER + search_path fijo: el que cierra la tarea puede no tener
-- permiso de INSERT sobre una notificación cuyo owner es otra persona.
-- ------------------------------------------------------------
create or replace function public.cards_notificar_finalizacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_manager    uuid;
  v_actor_name text;
begin
  -- Solo la actualización directa del usuario notifica: las cards espejo que
  -- sincroniza trg_sync_compartidas (depth 2) no generan avisos propios.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Sin actor identificado (cron / service role) no se notifica: espeja la
  -- guarda `&& meId` del cliente y evita que el reset mensual dispare avisos.
  if v_actor is null then
    return new;
  end if;

  -- tieneImpacto(): prioridad alta O con vencimiento. Lo demás es ruido.
  -- (lógica bivaluada explícita: con priority/due_date NULL, la versión
  -- anterior `not (priority = 'alta' or due_date is not null)` evaluaba a
  -- NULL y notificaba, mientras que tieneImpacto() en TS devuelve false.)
  if new.due_date is null and coalesce(new.priority, '') <> 'alta' then
    return new;
  end if;

  -- Manager del DUEÑO de la card (no del actor).
  select p.manager_id into v_manager
    from public.profiles p
   where p.id = new.owner;

  -- Sin manager, o auto-finalización del propio manager → nada.
  if v_manager is null or v_manager = v_actor then
    return new;
  end if;

  select coalesce(nullif(btrim(p.name), ''), 'Alguien') into v_actor_name
    from public.profiles p
   where p.id = v_actor;

  insert into public.notifications (owner, tipo, titulo, detalle, card_id)
  values (
    v_manager,
    'avance',
    'Tarea importante terminada',
    coalesce(v_actor_name, 'Alguien') || ' terminó "' || coalesce(new.title, '') || '"'
      || case when new.priority = 'alta' then ' (prioridad alta)' else '' end,
    new.id
  );

  return new;
end;
$$;

-- Nadie la ejecuta a mano desde la app: solo la dispara el trigger.
revoke execute on function public.cards_notificar_finalizacion() from public, anon, authenticated;

-- drop + create del trigger, PRESERVANDO si estaba activado o no.
--
-- >>> La primera vez el trigger queda DESACTIVADO A PROPÓSITO (ver la
-- >>> ADVERTENCIA de arriba): mientras el cliente siga insertando la
-- >>> notificación, tenerlo activo DUPLICA todos los avisos.
-- >>> Se activa a mano junto con el deploy de la Task 11:
-- >>>   alter table public.cards enable trigger cards_notificar_finalizacion;
--
-- Y si la Task 11 YA lo activó, volver a correr esta migración NO lo apaga:
-- se lee el estado previo (pg_trigger.tgenabled = 'O' cuando está activo) y
-- se restaura. Sin esto, un re-run de la migración cortaría en silencio las
-- notificaciones en producción.
do $$
declare
  v_estado text;
begin
  select t.tgenabled::text into v_estado
    from pg_trigger t
   where t.tgrelid = 'public.cards'::regclass
     and t.tgname = 'cards_notificar_finalizacion'
     and not t.tgisinternal;

  execute 'drop trigger if exists cards_notificar_finalizacion on public.cards';
  execute $ddl$
    create trigger cards_notificar_finalizacion
      after update on public.cards
      for each row
      when (new.status = 'term' and old.status is distinct from 'term')
      execute function public.cards_notificar_finalizacion()
  $ddl$;

  if v_estado is null or v_estado = 'D' then
    -- No existía antes, o existía desactivado ('D') → queda DESACTIVADO.
    -- Cualquier otro estado previo ('O' = enabled, 'A' = enable always,
    -- 'R' = enable replica) se preserva habilitado: un re-run no debe
    -- apagar en silencio un trigger que alguien activó explícitamente.
    execute 'alter table public.cards disable trigger cards_notificar_finalizacion';
  end if;
end $$;


-- ------------------------------------------------------------
-- 1-bis) ¿El trigger de notificaciones está ACTIVO? (spec 28 fase C, Task 11)
--
-- El cliente necesita saber la VERDAD sobre el trigger para decidir si inserta
-- la notificación de finalización o si la deja en manos de la base:
--   - trigger ACTIVO   → el cliente NO inserta (si lo hiciera, DUPLICA el aviso).
--   - trigger APAGADO  → el cliente SIGUE insertando (si no, NADIE recibe nada).
--
-- No alcanza con mirar `schema_migrations`: la migración 30 puede estar aplicada
-- y el trigger seguir DESACTIVADO, porque activarlo es un paso manual aparte.
-- Deducirlo del número de migración daría la respuesta equivocada justo en la
-- ventana entre "corrí la migración" y "activé el trigger".
--
-- Devuelve false si el trigger no existe (base sin migrar): ante la duda, el
-- cliente notifica. Un duplicado ocasional se tolera; un silencio no.
--
-- SECURITY DEFINER: `authenticated` no tiene por qué poder leer pg_trigger.
-- ------------------------------------------------------------
create or replace function public.trigger_notificaciones_activo()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select t.tgenabled <> 'D'
       from pg_trigger t
      where t.tgrelid = 'public.cards'::regclass
        and t.tgname = 'cards_notificar_finalizacion'
        and not t.tgisinternal),
    false);
$$;
grant execute on function public.trigger_notificaciones_activo() to authenticated;
revoke execute on function public.trigger_notificaciones_activo() from public, anon;


-- ------------------------------------------------------------
-- 2) Búsqueda full-text sobre cards (título + descripción).
-- ------------------------------------------------------------

-- unaccent es OPCIONAL y "nice to have": en algunos proyectos de Supabase no
-- se puede crear la extensión (permisos / plan). Si falla, la migración NO
-- debe abortar: todo lo de abajo funciona igual sin unaccent, porque el
-- diccionario 'spanish' ya hace stemming y la columna generada no puede usar
-- unaccent de todos modos (unaccent() no es IMMUTABLE, y una columna
-- GENERATED ... STORED exige expresiones inmutables).
do $$
begin
  create extension if not exists unaccent;
exception when others then
  null;  -- sin unaccent: la búsqueda funciona igual, solo es sensible a tildes
end $$;

-- Columna generada: se mantiene sola en cada insert/update, sin trigger.
-- setweight: el título pesa más que la descripción en el ranking.
alter table public.cards
  add column if not exists tsv tsvector
  generated always as (
    setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(description, '')), 'B')
  ) stored;

create index if not exists cards_tsv_gin on public.cards using gin (tsv);

-- Búsqueda. SECURITY INVOKER (el default: NO se declara `security definer`),
-- así la RLS de `cards` se evalúa con el rol del que llama y cada uno ve
-- solamente lo suyo (o lo de su equipo, si es encargado/jefe).
-- Devuelve `setof public.cards` para no acoplar la firma a los tipos exactos
-- de las columnas (evita el error "structure of query does not match" si
-- alguna columna cambia de tipo en el futuro).
drop function if exists public.buscar_cards(text);
create function public.buscar_cards(q text)
returns setof public.cards
language sql
stable
as $$
  select c.*
    from public.cards c
   where btrim(coalesce(q, '')) <> ''
     and c.tsv @@ websearch_to_tsquery('spanish', q)
   order by ts_rank(c.tsv, websearch_to_tsquery('spanish', q)) desc,
            c.created_at desc
   limit 200;
$$;
grant execute on function public.buscar_cards(text) to authenticated;
revoke execute on function public.buscar_cards(text) from public, anon;


-- ------------------------------------------------------------
-- 3) Vista materializada: resumen mensual por mes / owner / marca.
--
-- Fuente: public.cards_archive (migración 22) — el snapshot jsonb inmutable
-- de cada card al cerrar el mes. Nunca se calcula sobre `cards` vivas, así
-- el histórico no cambia retroactivamente.
--
-- OJO: las vistas materializadas NO soportan RLS. Por eso se le revoca el
-- SELECT a anon/authenticated y se expone SOLO a través de
-- public.resumen_mensual(), que filtra con los mismos helpers que la policy
-- de cards_archive (propio / encargado / jefe).
-- ------------------------------------------------------------
create materialized view if not exists public.mv_resumen_mensual as
  select
    a.mes                                                   as mes,
    a.owner                                                 as owner,
    coalesce(nullif(btrim(a.card->>'marca'), ''), 'Sin marca') as marca,
    count(*)                                                as total,
    count(*) filter (where a.card->>'status' = 'term')       as terminadas
  from public.cards_archive a
  group by a.mes, a.owner, coalesce(nullif(btrim(a.card->>'marca'), ''), 'Sin marca');

-- Índice ÚNICO: requisito de PostgreSQL para `refresh materialized view
-- concurrently` (sin él, el refresh bloquea las lecturas). Las tres columnas
-- del group by son exactamente la clave.
create unique index if not exists mv_resumen_mensual_uidx
  on public.mv_resumen_mensual (mes, owner, marca);

revoke all on public.mv_resumen_mensual from public, anon, authenticated;

-- Lectura filtrada por rol (misma regla que la policy de cards_archive).
create or replace function public.resumen_mensual(p_mes text default null)
returns table (mes text, owner uuid, marca text, total bigint, terminadas bigint)
language sql
security definer
stable
set search_path = public
as $$
  select v.mes, v.owner, v.marca, v.total, v.terminadas
    from public.mv_resumen_mensual v
   where (p_mes is null or v.mes = p_mes)
     and (
       v.owner = auth.uid()
       or public.es_jefe()
       or public.es_encargado_de(v.owner)
     )
   order by v.mes desc, v.marca;
$$;
grant execute on function public.resumen_mensual(text) to authenticated;
revoke execute on function public.resumen_mensual(text) from public, anon;

-- Primer refresh (NO concurrently: la vista puede no haberse poblado nunca,
-- y `concurrently` falla sobre una matview que todavía no fue refrescada).
refresh materialized view public.mv_resumen_mensual;


-- ------------------------------------------------------------
-- Verificación (deben devolver sin error):
--   -- trigger creado y DESACTIVADO ('D' = disabled, 'O' = enabled):
--   select tgname, tgenabled from pg_trigger
--     where tgrelid = 'public.cards'::regclass and not tgisinternal;
--   -- lo mismo, pero como lo ve el cliente (false = el cliente sigue notificando):
--   select public.trigger_notificaciones_activo();
--   -- full-text:
--   select column_name, is_generated from information_schema.columns
--     where table_name = 'cards' and column_name = 'tsv';
--   select count(*) from public.buscar_cards('arqueo caja');
--   -- vista materializada:
--   select count(*) from public.mv_resumen_mensual;
--   select * from public.resumen_mensual() limit 5;
--   -- nadie lee la matview directo desde la app:
--   select has_table_privilege('authenticated', 'public.mv_resumen_mensual', 'select'); -- 'f'
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Autoregistro de esta migración
-- ------------------------------------------------------------
insert into public.schema_migrations (id, nombre)
  select 30, 'migracion-30-analitica.sql'
  where not exists (select 1 from public.schema_migrations where id = 30);
