-- =====================================================================
-- MIGRACIÓN 3: prioridades + historial de cambios por tarjeta
-- Pegar todo en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

alter table public.cards add column if not exists
  priority text not null default 'media' check (priority in ('alta','media','baja'));

-- historial: [{who, at, txt}] — la app agrega una entrada en cada acción
alter table public.cards add column if not exists
  history jsonb not null default '[]';
