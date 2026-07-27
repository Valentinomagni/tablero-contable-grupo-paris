-- ============================================================
-- Migración 32 — card_periodos: estado de trabajo por período mensual
-- (propuesta de períodos, Fase 0 — ver docs/PROPUESTA-PERIODOS.md sección 4).
-- Correr COMPLETO en Supabase → SQL Editor. Idempotente (se puede correr las
-- veces que haga falta, en cualquier orden respecto de las migraciones 26–31,
-- sin romper nada).
--
-- QUÉ HACE (y qué NO):
--  - AGREGA la tabla `card_periodos`: una fila por (card_id, periodo 'YYYY-MM')
--    con el estado de trabajo del mes (status/checklist/comments/history/tiempos).
--    Junio y julio de la misma tarea son dos filas distintas, nunca se pisan.
--  - Backfill idempotente: por cada card NO operativa sin fila del mes vigente,
--    crea su `card_periodos` del mes vigente copiando el estado actual de la card.
--  - NO toca la tabla `cards`. NO jubila el reset de la migración 24 (eso es Fase 2).
--    La app sigue funcionando EXACTAMENTE igual: esta migración sólo agrega y puebla.
--
-- RLS: policies CALCADAS de task_occurrences / cierre_periodos, usando los helpers
-- SECURITY DEFINER public.es_jefe() / public.es_encargado_de(uuid) (migración 14-FIX)
-- — NUNCA subconsultas directas a profiles dentro de una policy (evita el 42P17).
-- ============================================================

-- ------------------------------------------------------------
-- 0) schema_migrations por si esta migración se corre antes que
--    la 28/29/30/31 (que la crean normalmente).
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
-- 1) Tabla card_periodos: estado de trabajo por (card_id, periodo).
--    unique(card_id, periodo) garantiza una sola instancia por mes.
-- ------------------------------------------------------------
create table if not exists public.card_periodos (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  owner uuid not null references auth.users(id),
  periodo text not null,                          -- 'YYYY-MM'
  status text not null default 'pend',            -- pend | proc | term
  checklist jsonb not null default '[]',
  comments jsonb not null default '[]',
  history jsonb not null default '[]',
  done_at timestamptz,
  proc_at timestamptz,
  due_date date,
  created_at timestamptz not null default now(),
  unique (card_id, periodo)
);
alter table public.card_periodos enable row level security;

-- check de formato de periodo ('YYYY-MM'), idempotente
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'card_periodos_periodo_check'
      and conrelid = 'public.card_periodos'::regclass
  ) then
    alter table public.card_periodos
      add constraint card_periodos_periodo_check
      check (periodo ~ '^\d{4}-\d{2}$');
  end if;
end $$;

-- check de status válido, idempotente
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'card_periodos_status_check'
      and conrelid = 'public.card_periodos'::regclass
  ) then
    alter table public.card_periodos
      add constraint card_periodos_status_check
      check (status in ('pend', 'proc', 'term'));
  end if;
end $$;

-- Índices: por (owner, periodo) para el board de una persona en un mes,
-- y por card_id para el join con la definición.
create index if not exists card_periodos_owner_periodo_idx
  on public.card_periodos (owner, periodo);
create index if not exists card_periodos_card_id_idx
  on public.card_periodos (card_id);

-- ------------------------------------------------------------
-- 2) Policies RLS — calcadas de task_occurrences / cierre_periodos:
--    SELECT propio, o jefe, o encargado del dueño (helpers SECURITY
--    DEFINER, sin subconsulta a profiles). INSERT/UPDATE/DELETE propio.
-- ------------------------------------------------------------
drop policy if exists "card_periodos_select" on public.card_periodos;
create policy "card_periodos_select" on public.card_periodos for select
  using (
    owner = auth.uid()
    or public.es_jefe()
    or public.es_encargado_de(owner)
  );

drop policy if exists "card_periodos_insert" on public.card_periodos;
create policy "card_periodos_insert" on public.card_periodos for insert
  with check (owner = auth.uid());

drop policy if exists "card_periodos_update" on public.card_periodos;
create policy "card_periodos_update" on public.card_periodos for update
  using (owner = auth.uid())
  with check (owner = auth.uid());

drop policy if exists "card_periodos_delete" on public.card_periodos;
create policy "card_periodos_delete" on public.card_periodos for delete
  using (owner = auth.uid());

-- ------------------------------------------------------------
-- 3) Backfill idempotente del mes vigente.
--
-- Por cada card NO operativa (card_type <> 'operativa') que no tenga ya fila
-- para el mes vigente, crea su `card_periodos` del mes vigente copiando su
-- status / checklist / history / done_at / proc_at / due_date actuales.
--
-- "mes vigente" = mes actual del servidor: to_char(now(), 'YYYY-MM').
-- `on conflict (card_id, periodo) do nothing` → doble corrida no duplica.
-- NO se copia `comments` de la card acá: card_periodos.comments arranca en []
-- (los comentarios de la card son de su hilo, no del estado del período; el
-- default '[]' es el correcto para la instancia del mes).
-- ------------------------------------------------------------
insert into public.card_periodos
    (card_id, owner, periodo, status, checklist, history, done_at, proc_at, due_date)
  select
    c.id,
    c.owner,
    to_char(now(), 'YYYY-MM'),
    c.status,
    coalesce(c.checklist, '[]'::jsonb),
    coalesce(c.history, '[]'::jsonb),
    c.done_at,
    c.proc_at,
    c.due_date
  from public.cards c
  where c.card_type <> 'operativa'
on conflict (card_id, periodo) do nothing;

-- ------------------------------------------------------------
-- Verificación (deben devolver sin error):
--   select count(*) from public.card_periodos;
--   select card_id, periodo, status from public.card_periodos limit 5;
--   -- una fila por card no operativa para el mes vigente:
--   select count(*) from public.card_periodos where periodo = to_char(now(),'YYYY-MM');
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Autoregistro de esta migración
-- ------------------------------------------------------------
insert into public.schema_migrations (id, nombre)
  select 32, 'migracion-32-card-periodos.sql'
  where not exists (select 1 from public.schema_migrations where id = 32);
