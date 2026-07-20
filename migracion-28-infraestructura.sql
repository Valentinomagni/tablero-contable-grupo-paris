-- ============================================================
-- Migración 28 — Infraestructura: registro de migraciones,
-- bucket de adjuntos y resumen semanal (spec 27)
-- Correr COMPLETO en Supabase → SQL Editor. Idempotente (se puede
-- correr las veces que haga falta sin romper nada).
--
-- 1) public.schema_migrations: hasta ahora no había forma de saber,
--    mirando la base, qué migraciones ya se corrieron. Esta tabla lo
--    registra. La app SOLO lee (RLS select para authenticated); quien
--    escribe es cada script de migración corriendo como postgres.
-- 2) Bucket 'adjuntos' privado en Storage, para que las cards puedan
--    llevar archivos adjuntos (spec 27).
-- 3) resumen_semanal(): función para un cron semanal OPCIONAL que
--    publica un aviso en el tablón con un resumen de la semana.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Registro de migraciones
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

-- Backfill de las migraciones que YA están aplicadas en esta base
-- (13 a 25 — verificadas). La 26, 27 y 28 se autoregistran al final
-- de sus propios archivos, para no asumir que ya corrieron.
insert into public.schema_migrations (id, nombre) values
  (13, 'migracion-13-tareas-compartidas.sql'),
  (14, 'migracion-14-jerarquia.sql'),
  (15, 'migracion-15-calendario-permisos.sql'),
  (16, 'migracion-16-recurrencia.sql'),
  (17, 'migracion-17-sin-asignar.sql'),
  (18, 'migracion-18-notas.sql'),
  (19, 'migracion-19-username.sql'),
  (20, 'migracion-20-delegacion-universal.sql'),
  (21, 'migracion-21-notificaciones.sql'),
  (22, 'migracion-22-gestion-tareas.sql'),
  (23, 'migracion-23-comunicacion-vacaciones-arqueo.sql'),
  (24, 'migracion-24-reset-recurrentes-seguro.sql'),
  (25, 'migracion-25-materializar-recurrentes.sql')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2) Bucket de adjuntos (privado)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('adjuntos', 'adjuntos', false)
on conflict (id) do nothing;

-- Ver y subir: cualquier usuario autenticado (la app filtra por card en el path)
drop policy if exists "adjuntos_select" on storage.objects;
create policy "adjuntos_select" on storage.objects
  for select using (bucket_id = 'adjuntos' and auth.role() = 'authenticated');

drop policy if exists "adjuntos_insert" on storage.objects;
create policy "adjuntos_insert" on storage.objects
  for insert with check (bucket_id = 'adjuntos' and auth.role() = 'authenticated');

-- Borrar: el dueño del archivo (owner de storage.objects) o un jefe
drop policy if exists "adjuntos_delete" on storage.objects;
create policy "adjuntos_delete" on storage.objects
  for delete using (
    bucket_id = 'adjuntos'
    and (owner = auth.uid() or public.es_jefe())
  );

-- ------------------------------------------------------------
-- 3) Resumen semanal (para cron semanal OPCIONAL del usuario)
-- ------------------------------------------------------------
create or replace function public.resumen_semanal()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cerradas int;
  v_vencidas int;
  v_arqueos  int;
  v_detail   text;
begin
  -- Tareas cerradas en los últimos 7 días
  select count(*) into v_cerradas
  from public.cards
  where status = 'term' and done_at >= now() - interval '7 days';

  -- Tareas vencidas que siguen abiertas hoy
  select count(*) into v_vencidas
  from public.cards
  where status <> 'term' and due_date is not null and due_date < current_date;

  -- Arqueos con diferencia en los últimos 7 días
  select count(*) into v_arqueos
  from public.task_occurrences
  where resultado = 'dif' and fecha >= current_date - 7;

  v_detail :=
    'Tareas cerradas (últimos 7 días): ' || v_cerradas || chr(10) ||
    'Tareas vencidas y aún abiertas (hoy): ' || v_vencidas || chr(10) ||
    'Arqueos con diferencia (últimos 7 días): ' || v_arqueos;

  insert into public.announcements (kind, title, detail, owner_id, created_by, visible_to)
  values ('aviso', 'Resumen semanal', v_detail, null, 'Sistema', '{}');
end;
$$;

-- Igual criterio que migración 26: nadie desde la app puede dispararla a mano,
-- solo el cron (que corre como postgres, dueño de la función).
revoke execute on function public.resumen_semanal() from public, anon, authenticated;

-- Verificación (deben devolver sin error):
--   select count(*) from public.schema_migrations;
--   select id from storage.buckets where id = 'adjuntos';
--   select has_function_privilege('anon', 'public.resumen_semanal()', 'execute'); -- debe dar 'f'

-- ------------------------------------------------------------
-- Autoregistro de esta migración
-- ------------------------------------------------------------
insert into public.schema_migrations (id, nombre) values (28, 'migracion-28-infraestructura.sql')
on conflict (id) do nothing;
