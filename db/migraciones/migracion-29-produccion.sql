-- ============================================================
-- Migración 29 — Preparación para producción (spec 28 fase A)
-- Correr COMPLETO en Supabase → SQL Editor. Idempotente (se puede
-- correr las veces que haga falta, en cualquier orden respecto de
-- las migraciones 26/27/28, sin romper nada).
--
-- 1) Columnas nuevas: profiles.oculto / profiles.last_seen,
--    cards.proc_at / cards.tiempo_max_horas / cards.dato_control.
-- 2) Tabla consultas: canal de feedback del equipo hacia la
--    administración (consulta | sugerencia | error).
-- 3) Tabla cierre_periodos: cierre mensual POR PERSONA.
-- 4) Policies RLS de ambas tablas nuevas, usando los helpers
--    SECURITY DEFINER public.es_jefe() / public.es_encargado_de(uuid)
--    (migración 14-FIX) — NUNCA subconsultas a profiles dentro de
--    una policy de profiles, para no reintroducir el 42P17.
-- 5) profiles: policy de UPDATE para que cada uno actualice su
--    propia fila (necesario para last_seen) + trigger que evita que
--    un no-jefe cambie role/manager_id/oculto de cualquier fila.
-- ============================================================

-- ------------------------------------------------------------
-- 0) schema_migrations por si esta migración se corre antes que
--    la 28 (que es la que crea la tabla normalmente).
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
-- 0-bis) settings.key ya es primary key (viene de una migración del
--    proyecto v1), así que el upsert({key:'tiempos_max',...},
--    {onConflict:'key'}) de Admin.tsx (Task 4) funciona sin índice
--    adicional.
-- ------------------------------------------------------------

-- Fila semilla para que el upsert de tiempos_max tenga sobre qué
-- operar incluso antes del primer guardado desde Admin.tsx.
insert into public.settings (key, value)
  select 'tiempos_max', '{}'::jsonb
  where not exists (select 1 from public.settings where key = 'tiempos_max');

-- ------------------------------------------------------------
-- 1) Columnas nuevas
-- ------------------------------------------------------------
alter table public.profiles add column if not exists oculto boolean not null default false;
alter table public.profiles add column if not exists last_seen timestamptz;
alter table public.cards    add column if not exists proc_at timestamptz;
alter table public.cards    add column if not exists tiempo_max_horas int;
alter table public.cards    add column if not exists dato_control text;

-- ------------------------------------------------------------
-- 2) Consultas internas: canal de feedback del equipo hacia la administración.
-- ------------------------------------------------------------
create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references auth.users(id),
  tipo text not null default 'consulta',      -- consulta | sugerencia | error
  texto text not null,
  estado text not null default 'nueva',       -- nueva | leida | archivada
  respuesta text,
  created_at timestamptz not null default now(),
  respondida_at timestamptz
);
alter table public.consultas enable row level security;

drop policy if exists "consultas_select" on public.consultas;
create policy "consultas_select" on public.consultas for select
  using (autor = auth.uid() or public.es_jefe());

drop policy if exists "consultas_insert" on public.consultas;
create policy "consultas_insert" on public.consultas for insert
  with check (
    autor = auth.uid()
    and estado = 'nueva'
    and respuesta is null
    and respondida_at is null
  );

drop policy if exists "consultas_update" on public.consultas;
create policy "consultas_update" on public.consultas for update
  using (public.es_jefe())
  with check (public.es_jefe());

-- Sin policy de DELETE: no se permite borrar consultas desde la app.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'consultas_tipo_check'
      and conrelid = 'public.consultas'::regclass
  ) then
    alter table public.consultas
      add constraint consultas_tipo_check
      check (tipo in ('consulta', 'sugerencia', 'error'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'consultas_estado_check'
      and conrelid = 'public.consultas'::regclass
  ) then
    alter table public.consultas
      add constraint consultas_estado_check
      check (estado in ('nueva', 'leida', 'archivada'));
  end if;
end $$;

-- ------------------------------------------------------------
-- 3) Cierre mensual POR PERSONA: cada quien cierra su mes cuando terminó.
-- ------------------------------------------------------------
create table if not exists public.cierre_periodos (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id),
  mes text not null,                          -- 'YYYY-MM'
  cerrado_at timestamptz not null default now(),
  nota text,
  unique (owner, mes)
);
alter table public.cierre_periodos enable row level security;

drop policy if exists "cierre_periodos_select" on public.cierre_periodos;
create policy "cierre_periodos_select" on public.cierre_periodos for select
  using (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));

drop policy if exists "cierre_periodos_insert" on public.cierre_periodos;
create policy "cierre_periodos_insert" on public.cierre_periodos for insert
  with check (owner = auth.uid());

drop policy if exists "cierre_periodos_update" on public.cierre_periodos;
create policy "cierre_periodos_update" on public.cierre_periodos for update
  using (owner = auth.uid())
  with check (owner = auth.uid());

drop policy if exists "cierre_periodos_delete" on public.cierre_periodos;
create policy "cierre_periodos_delete" on public.cierre_periodos for delete
  using (owner = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cierre_periodos_mes_check'
      and conrelid = 'public.cierre_periodos'::regclass
  ) then
    alter table public.cierre_periodos
      add constraint cierre_periodos_mes_check
      check (mes ~ '^\d{4}-\d{2}$');
  end if;
end $$;

-- Evita backdating: cerrado_at se setea con now() en INSERT.
-- En UPDATE, preservá la fecha de cierre que ya tiene — nunca se reescribe.
create or replace function public.cierre_periodos_forzar_cerrado_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    new.cerrado_at := now();
  else
    new.cerrado_at := old.cerrado_at;
  end if;
  return new;
end;
$$;

drop trigger if exists cierre_periodos_forzar_cerrado_at on public.cierre_periodos;
create trigger cierre_periodos_forzar_cerrado_at
  before insert or update on public.cierre_periodos
  for each row
  execute function public.cierre_periodos_forzar_cerrado_at();

-- ------------------------------------------------------------
-- 4) profiles: policy de UPDATE propia (para que cada uno pueda
--    actualizar su last_seen, entre otros campos no sensibles) +
--    trigger que bloquea cambios de role/manager_id/oculto hechos
--    por alguien que no sea jefe.
--
--    No se encontró en el repo ninguna policy de UPDATE previa sobre
--    public.profiles (ni en migracion-13..28 ni en las de jerarquía/
--    recursión) — solo hay policies de SELECT. Sin una policy de
--    UPDATE, RLS bloquea toda escritura de un usuario sobre su propia
--    fila (ni siquiera puede actualizar last_seen). Se agrega acá una
--    policy amplia en filas (permite actualizar la propia fila o,
--    si sos jefe, cualquiera) pero RESTRINGIDA en columnas sensibles
--    vía el trigger de abajo, tal como pide el Step 2 del brief.
-- ------------------------------------------------------------
drop policy if exists "usuario actualiza su propio perfil" on public.profiles;
create policy "usuario actualiza su propio perfil" on public.profiles for update
  using (id = auth.uid() or public.es_jefe())
  with check (id = auth.uid() or public.es_jefe());

create or replace function public.profiles_bloquear_campos_sensibles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.es_jefe() then
    -- marca y sucursal alimentan la segmentación y el reporte ejecutivo: si cada uno
    -- pudiera reescribir las suyas, podría sacarse de su segmento o entrar a otro.
    if new.role is distinct from old.role
       or new.manager_id is distinct from old.manager_id
       or new.oculto is distinct from old.oculto
       or new.username is distinct from old.username
       or new.email is distinct from old.email
       or new.marca is distinct from old.marca
       or new.sucursal is distinct from old.sucursal then
      raise exception 'Solo un jefe puede cambiar role, manager_id, oculto, username, email, marca o sucursal de un perfil';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_bloquear_campos_sensibles on public.profiles;
create trigger profiles_bloquear_campos_sensibles
  before update on public.profiles
  for each row
  execute function public.profiles_bloquear_campos_sensibles();

-- ------------------------------------------------------------
-- 6) Reset mensual de recurrentes: limpiar TAMBIÉN proc_at.
--
-- La función de la migración 24 reinicia las recurrentes con status='pend' y
-- done_at=null, pero no conocía proc_at (columna nueva de esta migración). Sin
-- limpiarlo, una recurrente reiniciada conserva el proc_at del mes pasado: al
-- pasarla a "En proceso" el sello no se vuelve a poner (la app sólo sella si
-- proc_at es null) y el SLA se mide desde hace un mes → entrada falsa de
-- "Superó el tiempo máximo" en el historial.
--
-- Se replica la función de la 24 EXACTAMENTE, sumando `proc_at = null` al UPDATE.
-- ------------------------------------------------------------
create or replace function public.reset_recurrentes_seguro() returns text
language plpgsql security definer set search_path = public as $$
declare
  mes_cerrado text := to_char((now() at time zone 'America/Argentina/Buenos_Aires') - interval '1 day', 'YYYY-MM');
  archivadas int;
  reseteadas int;
begin
  -- 1) Snapshot inmutable del mes que cierra (idempotente: borra lo previo de ese mes)
  delete from public.cards_archive where mes = mes_cerrado;
  insert into public.cards_archive (owner, mes, card)
    select owner, mes_cerrado, to_jsonb(c) from public.cards c where c.card_type <> 'operativa';
  get diagnostics archivadas = row_count;

  -- 2) Reset SOLO de las recurrentes con ciclo 'mensual' (respeta 'mantener' / 'manual')
  update public.cards c
    set status = 'pend',
        done_at = null,
        proc_at = null,
        checklist = coalesce(
          (select jsonb_agg(jsonb_set(jsonb_set(item, '{done}', 'false'), '{done_at}', 'null'))
           from jsonb_array_elements(c.checklist) item),
          '[]'::jsonb),
        history = c.history || jsonb_build_object(
          'who','Sistema','at', now(),
          'txt','Reinicio mensual automático (' || mes_cerrado || ' archivado)')
    where (c.recurring = true or c.recur_rule is not null)
      and coalesce(c.reset_policy, 'mensual') = 'mensual';
  get diagnostics reseteadas = row_count;

  return format('mes %s: %s archivadas, %s recurrentes reiniciadas', mes_cerrado, archivadas, reseteadas);
end;
$$;

-- `create or replace` conserva los privilegios de la función previa, pero se repite el
-- revoke de la migración 26 por si esta migración corre antes que aquélla: sólo el cron
-- (postgres) debe poder ejecutarla, nunca anon/authenticated.
revoke execute on function public.reset_recurrentes_seguro() from public, anon, authenticated;

-- ------------------------------------------------------------
-- Verificación (deben devolver sin error):
--   select column_name from information_schema.columns
--     where table_name = 'profiles' and column_name in ('oculto', 'last_seen');
--   select count(*) from public.consultas;
--   select count(*) from public.cierre_periodos;
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Autoregistro de esta migración
-- ------------------------------------------------------------
insert into public.schema_migrations (id, nombre)
  select 29, 'migracion-29-produccion.sql'
  where not exists (select 1 from public.schema_migrations where id = 29);
