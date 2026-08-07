-- =====================================================================
-- MIGRACIÓN 5: esfuerzo/complejidad por tarea (para medir productividad real)
-- Pegar todo en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- 1 = baja (ej: conciliar un banco chico), 2 = media, 3 = alta, 5 = muy alta
-- (ej: DDJJ de un impuesto). Las tareas existentes quedan en 1.
alter table public.cards add column if not exists
  effort int not null default 1 check (effort in (1,2,3,5));
