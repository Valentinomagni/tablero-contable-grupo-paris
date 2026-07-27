-- ============================================================
-- Migración 33 — Administrador del sistema (usuario fantasma APARTE)
-- Spec 28-correcciones, items 3 y 4.
-- Correr COMPLETO en Supabase → SQL Editor. Idempotente.
--
-- QUÉ RESUELVE
--  Item 3: el "usuario fantasma" dejaba de ser una MARCA sobre el perfil de una
--          persona real (que era mi error de interpretación) y pasa a ser un
--          USUARIO PROPIO E INDEPENDIENTE, que no es ningún empleado.
--  Item 4: las consultas/errores que reporta el equipo dejan de ir al JEFE y
--          pasan a ir a ese administrador del sistema. El jefe YA NO las ve.
--          (Es a propósito: si alguien reporta un problema o una queja, el jefe
--          no debería ser el destinatario.)
--
-- ⚠️ ANTES DE CORRER ESTO — hay UN paso previo en el panel de Supabase:
--    1. Andá a  Authentication → Users → "Add user" → "Create new user".
--    2. Poné un email dedicado (NO el de un empleado real), por ejemplo:
--          admin.sistema@grupoparis.local
--       y una contraseña. Marcá "Auto Confirm User" si aparece la opción.
--    3. Copiá ese email y pegalo abajo, en la línea que dice EMAIL_DEL_FANTASMA.
--
--    Ese es el usuario con el que vas a entrar para leer las consultas.
--
-- SEGURIDAD: el helper es SECURITY DEFINER, igual que es_jefe()/es_encargado_de().
-- NUNCA se subconsulta `profiles` dentro de una policy de `profiles` — esa es la
-- regla dura del proyecto que evita el error 42P17 (recursión infinita en RLS).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Columna que marca al administrador del sistema
-- ------------------------------------------------------------
alter table public.profiles add column if not exists admin_sistema boolean not null default false;

-- ------------------------------------------------------------
-- 2) Helper SECURITY DEFINER (mismo patrón que es_jefe)
-- ------------------------------------------------------------
create or replace function public.es_admin_sistema() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and admin_sistema = true
  );
$$;
grant execute on function public.es_admin_sistema() to authenticated;

-- ------------------------------------------------------------
-- 3) Designar al usuario fantasma
--    👇 CAMBIÁ ESTE EMAIL por el que creaste en el paso previo 👇
-- ------------------------------------------------------------
do $$
declare
  v_email text := 'admin.sistema@grupoparis.local';   -- <<<< EMAIL_DEL_FANTASMA
  v_uid   uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower(v_email);

  if v_uid is null then
    raise notice 'AVISO: no existe ningún usuario de auth con el email %. Crealo primero en Authentication → Users y volvé a correr esta migración.', v_email;
  else
    -- Crea el perfil si no existía; si existía, lo marca.
    insert into public.profiles (id, name, role, email, puesto, ficha, oculto, admin_sistema)
      values (v_uid, 'Administración del sistema', 'empleado', v_email, 'Administración', '—', true, true)
    on conflict (id) do update
      set oculto = true,
          admin_sistema = true;

    raise notice 'OK: % quedó como administrador del sistema (oculto de listados y métricas).', v_email;
  end if;
end $$;

-- ------------------------------------------------------------
-- 4) El fantasma tiene que poder leer los perfiles
--    (si no, en la bandeja vería consultas sin saber de quién son).
--    Se RECREA la policy de la migración 14-FIX agregándole el helper nuevo.
-- ------------------------------------------------------------
drop policy if exists "encargado ve su equipo" on public.profiles;
create policy "encargado ve su equipo" on public.profiles for select
  using (
    id = auth.uid()                  -- yo mismo
    or manager_id = auth.uid()       -- mis reportes directos (columna propia, sin subquery)
    or public.es_jefe()              -- jefe ve todo
    or public.es_admin_sistema()     -- administrador del sistema ve todo
  );

-- ------------------------------------------------------------
-- 5) Consultas: del jefe al administrador del sistema
--    El jefe DEJA de verlas (item 4). El autor sigue viendo las suyas.
-- ------------------------------------------------------------
drop policy if exists "consultas_select" on public.consultas;
create policy "consultas_select" on public.consultas for select
  using (autor = auth.uid() or public.es_admin_sistema());

drop policy if exists "consultas_update" on public.consultas;
create policy "consultas_update" on public.consultas for update
  using (public.es_admin_sistema())
  with check (public.es_admin_sistema());

-- La policy de INSERT no cambia: cualquiera manda su consulta como 'nueva'.
-- Sigue sin haber policy de DELETE: no se borran consultas desde la app.

-- ------------------------------------------------------------
-- CÓMO VERIFICAR (opcional, después de correr)
-- ------------------------------------------------------------
--   -- ¿quedó designado?
--   select email, oculto, admin_sistema from public.profiles where admin_sistema;
--   -- entrando como el fantasma, tienen que verse todas:
--   select count(*) from public.consultas;
--   -- el fantasma NO debe aparecer en el equipo (oculto = true):
--   select name, oculto from public.profiles order by oculto desc;
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Autoregistro de esta migración
-- ------------------------------------------------------------
insert into public.schema_migrations (id, nombre)
  select 33, 'migracion-33-admin-sistema.sql'
  where not exists (select 1 from public.schema_migrations where id = 33);
