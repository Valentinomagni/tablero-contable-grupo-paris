-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 48
--  Feriados y días no laborables, para que dejen de contar como demora.
--  Correr en Supabase -> SQL Editor. No toca ningún dato existente.
-- ============================================================================
--
--  ESTO CIERRA EL REPORTE DE VALENTINO
--
--  "Los fines de semana y feriados influyen negativamente en el análisis de tiempos, sumando
--  días de inactividad como si fuesen demoras operativas."
--
--  El caso concreto: una tarea entregada el viernes y revisada el lunes hoy figura con cuatro
--  días de espera. Dos de esos días la oficina estaba cerrada.
--
--  No es un problema cosmético: hace que el equipo aparezca más lento de lo que trabajó, en una
--  pantalla que se usa para decidir. Y es la clase de número que, cuando alguien lo nota, hace
--  que se deje de creer todo el resto del tablero.
--
--  POR QUÉ UNA TABLA Y NO UNA LISTA FIJA EN EL CÓDIGO
--
--  Argentina tiene feriados móviles, puentes que se deciden por decreto cada año, y días que
--  sólo son no laborables para esta empresa: un inventario, una capacitación, la mudanza de una
--  sucursal. Ninguna lista fija los cubre, y una que quede vieja es peor que ninguna.
--
--  Los sábados y domingos NO se cargan acá: los calcula `src/lib/dias-habiles.ts`. Esta tabla es
--  sólo para lo que hay que decidir.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) La tabla
--
--    `fecha` es la clave: un día no puede estar cargado dos veces, y eso lo garantiza la base en
--    vez de la pantalla. `motivo` es texto libre corto — "Feriado nacional", "Inventario",
--    "Puente turístico"— para que dentro de un año se sepa por qué ese día no contaba.
-- ------------------------------------------------------------

create table if not exists public.dias_no_laborables (
  fecha date primary key,
  motivo text not null default '',
  creado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.dias_no_laborables is
  'Feriados y dias no laborables cargados a mano. Los sabados y domingos NO van aca: los calcula src/lib/dias-habiles.ts';

alter table public.dias_no_laborables enable row level security;

-- ------------------------------------------------------------
-- 2) Permisos
--
--    LEER: cualquiera con sesión. Todos necesitan que sus tiempos se calculen bien, y saber qué
--    día no se trabaja no es información sensible.
--
--    ESCRIBIR: sólo el jefe. Marcar un día como no laborable cambia TODAS las métricas de
--    tiempo del equipo, hacia atrás y hacia adelante. No es una preferencia personal.
--
--    `using` y `with check` dicen exactamente lo mismo, que es la regla que este proyecto
--    aprendió rompiendo cuatro tablas: si difieren, alguien ve algo que no puede guardar y
--    recibe el error crudo de Postgres.
-- ------------------------------------------------------------

drop policy if exists "dias_no_laborables_select" on public.dias_no_laborables;
create policy "dias_no_laborables_select" on public.dias_no_laborables
  for select using (auth.uid() is not null);

drop policy if exists "dias_no_laborables_escribir" on public.dias_no_laborables;
create policy "dias_no_laborables_escribir" on public.dias_no_laborables
  for all
  using      (public.es_jefe())
  with check (public.es_jefe());

-- ------------------------------------------------------------
-- 3) Los domingos NO se cargan, y conviene dejarlo escrito
--
--    El reporte pide "permitir el marcado manual de Domingos y Días Feriados". Los domingos se
--    calculan: cargarlos uno por uno serían 52 filas por año que nadie va a mantener, y el día
--    que alguien se olvide de cargar un domingo, ese domingo pasa a contar como día trabajado.
--
--    Lo que sí resuelve esta tabla es el caso inverso y real: un domingo o sábado en el que SÍ
--    se trabajó (un cierre que se hizo el fin de semana). Para eso hace falta otra cosa, y no
--    está en este alcance — se anota acá para que quede registrado que se pensó.
-- ------------------------------------------------------------

-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) La tabla existe y tiene sus dos policies:
--
--       select policyname, cmd from pg_policies
--        where tablename = 'dias_no_laborables' order by cmd;
--
--  2) Cargar un feriado de prueba (como jefe) y verlo:
--
--       insert into public.dias_no_laborables (fecha, motivo)
--         values ('2026-12-25', 'Navidad') on conflict (fecha) do nothing;
--       select * from public.dias_no_laborables order by fecha;
--
--  3) Y como empleado, que pueda leerlo y NO pueda escribirlo. Esto tiene que fallar:
--
--       insert into public.dias_no_laborables (fecha, motivo) values ('2026-12-08', 'Prueba');

insert into public.schema_migrations (id, nombre)
  values (48, 'migracion-48-dias-no-laborables.sql')
  on conflict (id) do nothing;
