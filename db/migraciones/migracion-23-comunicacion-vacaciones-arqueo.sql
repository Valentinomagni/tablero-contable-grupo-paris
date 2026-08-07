-- ============================================================
-- Migración 23 — Tablón útil, vacaciones/cobertura y resultado de arqueo
-- (spec 24, items 1, 5 y 9). Correr COMPLETO en Supabase → SQL Editor.
-- Regla del proyecto: las policies NUNCA consultan profiles directamente;
-- usan los helpers SECURITY DEFINER es_jefe() / es_encargado_de(uuid)
-- creados en migracion-14-FIX (evita recursión 42P17).
-- ============================================================

-- (1) Tablón como canal de comunicación: prioridad, vigencia y archivado
alter table public.announcements add column if not exists prioridad text not null default 'normal'; -- normal|importante|urgente
alter table public.announcements add column if not exists vigente_hasta date;                        -- null = sin vencimiento
alter table public.announcements add column if not exists archivado boolean not null default false;

-- (5) Vacaciones y cobertura de puestos
create table if not exists public.vacaciones (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,   -- quién se ausenta
  desde date not null,
  hasta date not null,
  motivo text not null default 'Vacaciones',
  reemplazante uuid references public.profiles(id) on delete set null,     -- responsable temporal
  notas text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.vacaciones enable row level security;

-- visibilidad general: todo el equipo ve quién está ausente y quién cubre
drop policy if exists "ver vacaciones" on public.vacaciones;
create policy "ver vacaciones" on public.vacaciones for select using (true);

-- crear/editar/borrar: jefe, o el encargado del ausente (el propio empleado puede VER pero no auto-asignarse vacaciones)
drop policy if exists "gestionar vacaciones" on public.vacaciones;
create policy "gestionar vacaciones" on public.vacaciones for all
  using (public.es_jefe() or public.es_encargado_de(owner))
  with check (public.es_jefe() or public.es_encargado_de(owner));

-- (9) Arqueo de caja: resultado por ocurrencia diaria (historial inmutable por fecha)
alter table public.task_occurrences add column if not exists resultado text;        -- 'ok' | 'dif' | null (hecho sin resultado)
alter table public.task_occurrences add column if not exists dif_importe numeric;   -- importe de la diferencia (si 'dif')
alter table public.task_occurrences add column if not exists dif_obs text;          -- observaciones / evidencia
alter table public.cards add column if not exists requiere_resultado boolean not null default false; -- marca "tarea de control" (ej. arqueo)

-- Verificación (deben devolver sin error):
--   select prioridad, vigente_hasta, archivado from public.announcements limit 1;
--   select * from public.vacaciones limit 1;
--   select resultado, dif_importe from public.task_occurrences limit 1;
