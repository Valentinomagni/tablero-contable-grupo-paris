-- ============================================================
-- FIX URGENTE — Recursión infinita en las políticas de profiles
-- Error en producción: 42P17 "infinite recursion detected in policy
-- for relation profiles" → profiles y announcements devuelven 500
-- y el login no carga.
--
-- Causa: la política "encargado ve su equipo" (migración 14) consulta
-- public.profiles DESDE una política DE public.profiles.
-- Solución estándar: mover el chequeo de rol a una función
-- SECURITY DEFINER (evita la RLS al evaluarse → corta la recursión).
--
-- CORRER ESTE ARCHIVO COMPLETO EN: Supabase → SQL Editor → Run
-- ============================================================

-- 1) Eliminar la política recursiva
drop policy if exists "encargado ve su equipo" on public.profiles;

-- 2) Helpers de rol sin recursión (SECURITY DEFINER se evalúa sin RLS)
create or replace function public.es_jefe() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'jefe');
$$;
grant execute on function public.es_jefe() to authenticated;

create or replace function public.es_encargado_de(emp uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = emp and manager_id = auth.uid());
$$;
grant execute on function public.es_encargado_de(uuid) to authenticated;

-- 3) Recrear la política SIN consultar profiles directamente
create policy "encargado ve su equipo" on public.profiles for select
  using (
    id = auth.uid()            -- yo mismo
    or manager_id = auth.uid() -- mis reportes directos (columna propia, sin subquery)
    or public.es_jefe()        -- jefe ve todo (via función security definer)
  );

-- 4) Las políticas de cards (migración 14) y announcements (migración 15)
--    consultaban profiles con subqueries — recrearlas usando los helpers
--    para que no dependan de la evaluación en cadena:
drop policy if exists "encargado gestiona cards de su equipo" on public.cards;
create policy "encargado gestiona cards de su equipo" on public.cards for update
  using (
    owner = auth.uid()
    or public.es_jefe()
    or public.es_encargado_de(owner)
  );

drop policy if exists "ver eventos segun rol" on public.announcements;
create policy "ver eventos segun rol" on public.announcements for select using (
  owner_id = auth.uid()
  or auth.uid() = any(visible_to)
  or public.es_jefe()
  or (owner_id is not null and public.es_encargado_de(owner_id))
  or owner_id is null
);

-- 5) Verificación (debe devolver filas sin error):
--    select id from public.profiles limit 1;
