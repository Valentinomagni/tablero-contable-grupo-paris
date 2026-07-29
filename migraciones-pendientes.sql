-- ============================================================================
--  TABLERO CONTABLE — MIGRACIONES PENDIENTES (32 + 33 + 34)
--  Generado el 28/07/2026. Correr UNA sola vez en Supabase → SQL Editor.
-- ============================================================================
--
--  QUÉ HABILITA CADA UNA
--    32 · Períodos       → el selector de mes del tablero muestra datos reales y
--                          podés adelantar trabajo del mes que viene sin pisar
--                          el mes en curso.
--    33 · Fantasma       → las consultas y errores del equipo te llegan a vos
--                          (cuenta de administración), no al jefe.
--    34 · Checklist día  → una tarea recurrente diaria deja de perder lo que
--                          tildaste ayer.
--
--  ⚠️  UN PASO PREVIO, SÓLO PARA LA 33
--      Antes de correr esto, creá la cuenta de administración:
--        Supabase → Authentication → Users → "Add user" → "Create new user"
--        Email dedicado (NO el de un empleado real), por ejemplo:
--            admin.sistema@grupoparis.local
--        Poné una contraseña y marcá "Auto Confirm User" si aparece.
--      Después, buscá más abajo la línea marcada  <<<< EMAIL_DEL_FANTASMA
--      y poné ahí ese mismo email.
--
--      Si el email no coincide con ninguna cuenta, la migración NO falla:
--      avisa por consola y no cambia nada. Corregís y volvés a correr.
--
--  SEGURIDAD Y REVERSIBILIDAD
--    · Las tres son IDEMPOTENTES: se pueden correr varias veces sin romper nada.
--    · Ninguna borra datos. La 34 sólo agrega dos columnas con valor por defecto.
--    · La app es DEFENSIVA: si algo de esto no corre, se comporta como hoy.
--
--  RECOMENDADO ANTES DE EMPEZAR
--    Entrá como jefe → Administración → "Descargar backup completo (JSON)".
-- ============================================================================



-- ############################################################################
-- #  MIGRACIÓN 32 — Períodos (card_periodos)
-- ############################################################################

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


-- ############################################################################
-- #  MIGRACIÓN 33 — Administrador del sistema — OJO: el email va abajo
-- ############################################################################

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


-- ############################################################################
-- #  MIGRACIÓN 34 — Checklist y observaciones por día
-- ############################################################################

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


-- ============================================================================
--  LISTO. Para verificar que quedaron las tres aplicadas:
--     select id, nombre, applied_at from public.schema_migrations order by id;
--  Tienen que aparecer la 32, la 33 y la 34.
-- ============================================================================
