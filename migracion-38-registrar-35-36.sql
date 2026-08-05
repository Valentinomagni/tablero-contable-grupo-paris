-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 38
--  Registrar las migraciones 35 y 36 en el índice de la base.
--  Correr en Supabase -> SQL Editor. Tarda menos de un segundo.
-- ============================================================================
--
--  QUÉ ARREGLA, EN CRIOLLO
--
--  En Administración hay un chip que dice "Base de datos al día" o "Faltan migraciones: N".
--  Es el único lugar donde la app avisa que hay algo pendiente de correr acá.
--
--  Ese chip venía mirando sólo hasta la migración 28. De la 29 a la 37 no las miraba, así que
--  mostraba el escudo verde sin haberlas revisado. Entre las que no miraba está la 35, que es
--  justamente la que cierra el agujero por el que un empleado podía hacerse administrador.
--
--  El arreglo del lado de la app ya está hecho: ahora el chip mira las 26. Pero al mirarlas
--  aparece un segundo problema: las migraciones 35 y 36 nunca se anotaron en el índice
--  `schema_migrations` cuando las corriste, porque a esos dos archivos les faltaba la línea que
--  las anota. Están aplicadas —eso no cambia— pero el índice no lo sabe.
--
--  Sin esta migración, el chip te iba a decir "Faltan migraciones: 35, 36" para siempre, y
--  volver a correrlas no lo arreglaba. Una alarma que no se puede apagar termina ignorada, y la
--  próxima vez que avise algo real tampoco le vas a creer. Por eso se arregla ahora.
--
--  ESTO NO TOCA NINGÚN DATO. No crea ni borra tablas, columnas, políticas ni filas de trabajo.
--  Sólo escribe tres renglones en el índice de migraciones. Se puede correr dos veces sin efecto.
--
--  DESPUÉS DE CORRERLA: entrá a Administración y el chip tiene que estar verde.
-- ============================================================================

-- ------------------------------------------------------------
-- 0) Por si acaso: el índice tiene que existir
--
--    Lo crea la migración 28. Se repite acá con `if not exists` para que este archivo se pueda
--    correr solo, sin asumir el orden — mismo criterio que el resto de las migraciones.
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
-- 1) Anotar la 35 y la 36, que ya están aplicadas
--
--    `on conflict do nothing`: si por algún motivo ya estuvieran anotadas, no pisa la fecha
--    original de aplicación. El dato viejo, cuando existe, es más confiable que el de hoy.
-- ------------------------------------------------------------

insert into public.schema_migrations (id, nombre) values
  (35, 'migracion-35-cerrar-escalada-admin.sql'),
  (36, 'migracion-36-encargados-equipo.sql')
  on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2) Verificación — corré esto y mirá el resultado
--
--    Tiene que devolver 26 filas, de la 13 a la 38 sin huecos. Si falta alguna, ésa es
--    exactamente la que hay que correr, y el nombre del archivo está en la columna `nombre`.
-- ------------------------------------------------------------

-- select id, nombre, applied_at from public.schema_migrations order by id;

-- ------------------------------------------------------------
-- 3) Registro de esta misma migración
-- ------------------------------------------------------------

insert into public.schema_migrations (id, nombre)
  values (38, 'migracion-38-registrar-35-36.sql')
  on conflict (id) do nothing;
