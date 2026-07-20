-- ============================================================
-- Migración 26 — Blindar las funciones de cron (URGENTE, seguridad)
-- Correr COMPLETO en Supabase → SQL Editor.
--
-- PROBLEMA: reset_recurrentes_seguro() y materializar_mes_recurrentes() son
-- SECURITY DEFINER (corren con permisos plenos) y quedaron ejecutables por
-- 'anon' y 'authenticated' → cualquiera con la clave pública de la app (que
-- viaja en el bundle del front) podría dispararlas. reset_recurrentes_seguro()
-- ADEMÁS reinicia tareas → no debe poder llamarse desde afuera.
--
-- SOLUCIÓN: revocar EXECUTE a todos los roles de aplicación. El cron de Supabase
-- corre como 'postgres' (dueño), que NO pierde el permiso → los jobs siguen andando.
-- Idempotente y seguro de correr.
-- ============================================================

revoke execute on function public.reset_recurrentes_seguro() from public, anon, authenticated;
revoke execute on function public.materializar_mes_recurrentes(int, int) from public, anon, authenticated;

-- archivar_mes ya valida es_jefe() adentro, pero lo blindamos igual por prolijidad:
revoke execute on function public.archivar_mes(text) from anon;

-- Verificación (deben devolver 'f' = anon NO puede ejecutar):
--   select has_function_privilege('anon', 'public.reset_recurrentes_seguro()', 'execute');
--   select has_function_privilege('anon', 'public.materializar_mes_recurrentes(int,int)', 'execute');

-- ------------------------------------------------------------
-- Autoregistro (por si esta migración se corre antes que la 28,
-- que es la que crea schema_migrations formalmente — misma
-- definición exacta, idempotente).
-- ------------------------------------------------------------
create table if not exists public.schema_migrations (
  id int primary key,
  nombre text not null,
  applied_at timestamptz not null default now()
);
insert into public.schema_migrations (id, nombre) values (26, 'migracion-26-blindar-funciones-cron.sql')
on conflict (id) do nothing;
