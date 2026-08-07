-- ============================================================
-- Migración 34 — checklist y observaciones POR DÍA en task_occurrences.
-- Spec 28-correcciones, item 2 (queja original #2 del propietario).
-- Correr COMPLETO en Supabase → SQL Editor. Idempotente (se puede correr las
-- veces que haga falta, en cualquier orden respecto de las migraciones 26–33).
--
-- QUÉ RESUELVE: una tarea recurrente diaria tenía UN solo checklist, compartido por todas las
-- fechas. Al reiniciarse se perdía el detalle de los días anteriores. `task_occurrences` ya
-- guarda una fila por (card_id, fecha) y ya es inmutable, así que el detalle del día va acá.
--
-- NO TOCA NADA EXISTENTE: sólo agrega dos columnas con default. El `done`/`resultado` del
-- arqueo sigue igual, las policies RLS de task_occurrences siguen igual, y sin esta migración
-- la app funciona como hoy (gate `tieneChecklistDiario` en src/lib/esquema.ts).
-- ============================================================

-- ------------------------------------------------------------
-- 0) schema_migrations por si esta migración se corre antes que
--    las que normalmente la crean (28–32).
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
-- 1) Las dos columnas nuevas. `if not exists` = idempotente.
--    `checklist` arranca en '[]' (nunca null) para que la app pueda leerla
--    sin coalesce; `obs` es texto libre del día y sí puede ser null.
-- ------------------------------------------------------------
alter table public.task_occurrences add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.task_occurrences add column if not exists obs text;

-- ------------------------------------------------------------
-- Verificación (debe listar las dos columnas nuevas):
--   select column_name, data_type, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'task_occurrences'
--      and column_name in ('checklist', 'obs');
--   -- y que el detalle de un día se guarde aparte del de otro:
--   select fecha, done, checklist from public.task_occurrences order by fecha desc limit 5;
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Autoregistro de esta migración
-- ------------------------------------------------------------
insert into public.schema_migrations (id, nombre)
  select 34, 'migracion-34-checklist-diario.sql'
  where not exists (select 1 from public.schema_migrations where id = 34);
