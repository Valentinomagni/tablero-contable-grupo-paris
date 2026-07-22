-- ============================================================
-- Migración 31 — Etiquetas, empresas y pausas (spec 28, fase D)
-- Correr COMPLETO en Supabase → SQL Editor. Idempotente (se puede
-- correr las veces que haga falta, en cualquier orden respecto de
-- las migraciones 26/27/28/29/30, sin romper nada).
--
-- 1) cards.etiquetas: etiquetas contextuales múltiples, independientes
--    de `categoria`. Índice GIN para filtrar por etiqueta.
-- 2) Tabla public.empresas: catálogo de empresas del grupo.
-- 3) Tabla public.card_pausas: registro de pausas del cronómetro por
--    card (se crea ahora aunque el cronómetro esté condicionado a la
--    aprobación del ICR — la tabla vacía no molesta y evita una
--    migración extra después).
-- 4) Autoregistro en public.schema_migrations (id 31).
-- ============================================================

-- ------------------------------------------------------------
-- 0) schema_migrations por si esta migración se corre antes que
--    la 28/29/30 (que la crean normalmente).
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


-- ------------------------------------------------------------
-- 1) cards.etiquetas: múltiples etiquetas por tarea, independientes
--    de `categoria` (que es una sola categoría por card).
--
-- OJO con la columna generada `tsv` (migración 30): es
-- `generated always as (...) stored` sobre title/description, así que
-- agregar esta columna NO la afecta — una columna generada solo se
-- recalcula cuando cambian las columnas que referencia su propia
-- expresión, y `etiquetas` no es una de ellas.
--
-- Se decide NO sumar `etiquetas` al índice de búsqueda de texto (tsv)
-- por ahora: to_tsvector sobre un text[] requiere concatenarlo primero
-- (array_to_string) y sumaría una migración de la columna generada
-- (drop + create) solo para esto. Además buscar_cards() ya devuelve
-- filas completas de `cards`, así que filtrar por etiqueta se resuelve
-- hoy con `etiquetas && array[...]` en el cliente/consulta, sin falta
-- de texto libre. Mejora futura si se pide "buscar por etiqueta" en el
-- mismo cuadro de búsqueda full-text.
-- ------------------------------------------------------------
alter table public.cards
  add column if not exists etiquetas text[] not null default '{}';

create index if not exists cards_etiquetas_gin
  on public.cards using gin (etiquetas);


-- ------------------------------------------------------------
-- 2) Empresas del grupo. RLS: cualquier autenticado lee; solo el
--    jefe crea/edita/borra (mismo patrón que las tablas de catálogo
--    administradas desde Admin.tsx).
-- ------------------------------------------------------------
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cuit text,
  cierre_balance text,
  reporta_fabrica boolean not null default false,
  prioridad int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.empresas enable row level security;

drop policy if exists "empresas_select" on public.empresas;
create policy "empresas_select" on public.empresas for select
  using (auth.role() = 'authenticated');

drop policy if exists "empresas_insert" on public.empresas;
create policy "empresas_insert" on public.empresas for insert
  with check (public.es_jefe());

drop policy if exists "empresas_update" on public.empresas;
create policy "empresas_update" on public.empresas for update
  using (public.es_jefe())
  with check (public.es_jefe());

drop policy if exists "empresas_delete" on public.empresas;
create policy "empresas_delete" on public.empresas for delete
  using (public.es_jefe());


-- ------------------------------------------------------------
-- 3) Pausas del cronómetro por card. Se crea ahora aunque el
--    cronómetro esté condicionado a la aprobación del ICR: la tabla
--    vacía no molesta y evita una migración extra después.
--
-- RLS: SELECT propio, o jefe, o encargado del dueño de la pausa
-- (public.es_encargado_de(owner) — mismo helper de la migración
-- 14-FIX, SIN subconsultas directas a profiles). INSERT/UPDATE/DELETE
-- solo el propio dueño.
-- ------------------------------------------------------------
create table if not exists public.card_pausas (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.cards(id) on delete cascade,
  owner uuid references auth.users(id),
  desde timestamptz not null default now(),
  hasta timestamptz
);
alter table public.card_pausas enable row level security;

create index if not exists card_pausas_card_id_idx
  on public.card_pausas (card_id);

drop policy if exists "card_pausas_select" on public.card_pausas;
create policy "card_pausas_select" on public.card_pausas for select
  using (
    owner = auth.uid()
    or public.es_jefe()
    or public.es_encargado_de(owner)
  );

drop policy if exists "card_pausas_insert" on public.card_pausas;
create policy "card_pausas_insert" on public.card_pausas for insert
  with check (owner = auth.uid());

drop policy if exists "card_pausas_update" on public.card_pausas;
create policy "card_pausas_update" on public.card_pausas for update
  using (owner = auth.uid())
  with check (owner = auth.uid());

drop policy if exists "card_pausas_delete" on public.card_pausas;
create policy "card_pausas_delete" on public.card_pausas for delete
  using (owner = auth.uid());


-- ------------------------------------------------------------
-- Verificación (deben devolver sin error):
--   select column_name from information_schema.columns
--     where table_name = 'cards' and column_name = 'etiquetas';
--   select indexname from pg_indexes
--     where tablename = 'cards' and indexname = 'cards_etiquetas_gin';
--   select count(*) from public.empresas;
--   select count(*) from public.card_pausas;
--   -- tsv de la migración 30 sigue intacto (sigue siendo generada):
--   select column_name, is_generated from information_schema.columns
--     where table_name = 'cards' and column_name = 'tsv';
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Autoregistro de esta migración
-- ------------------------------------------------------------
insert into public.schema_migrations (id, nombre)
  select 31, 'migracion-31-etiquetas-empresas.sql'
  where not exists (select 1 from public.schema_migrations where id = 31);
