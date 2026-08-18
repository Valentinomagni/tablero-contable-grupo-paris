-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 55
--  Catálogo de tareas estándar: una definición canónica del trabajo que se repite.
--  Correr en Supabase -> SQL Editor. Se puede correr dos veces.
-- ============================================================================
--
--  EL PEDIDO, textual: "Juan hace las conciliaciones de Chevrolet, pero su descripción no es
--  como la de Valentino. Si son las mismas tareas, diferente empresa o marca, deberíamos tenerlo
--  igual para que mi jefe pueda comparar y además para que nos sirva de dato general."
--
--  POR QUÉ HOY NO PASA. Hay SIETE caminos que crean tareas (Admin, Board, CardModal,
--  DelegarModal, NuevaTareaModal, Cierre, Notas) y en seis de ellos el título y la descripción
--  son texto libre. Dos personas hacen el mismo trabajo y lo escriben distinto; después nadie
--  puede sumar esas dos filas sin leerlas una por una.
--
--  POR QUÉ NO ALCANZA CON LO QUE YA HAY (`plantilla.ts` / `settings.closing_template`)
--
--  La plantilla de cierre es una lista plana guardada en `settings`: título, responsable, día de
--  vencimiento, esfuerzo y prioridad. Sirve para GENERAR las tareas de un mes de un click, y eso
--  lo sigue haciendo — esta migración no la toca ni la reemplaza.
--
--  Lo que la plantilla NO puede hacer es definir QUÉ ES una tarea: no tiene descripción, no tiene
--  checklist, y sobre todo no tiene identidad. Un ítem de un arreglo JSON dentro de `settings` no
--  tiene un id al que una tarjeta pueda apuntar. Sin ese id no hay forma de preguntar "¿cuántas
--  de las tareas de este mes son la misma tarea?", que es exactamente lo que se pidió.
--
--  Por eso es una TABLA y no otra clave en `settings`: lo que hace falta es la clave foránea.
--
--  LO QUE ESTO NO HACE. No obliga a nadie a usar el catálogo, no bloquea la creación libre de
--  tareas y no cambia ninguna tarea existente. Una tarea creada desde una definición se puede
--  editar entera después: la definición es un punto de partida, no una jaula. Si no se pudiera
--  editar, el primer caso que no encaje se crearía por afuera y en dos semanas el catálogo
--  quedaría vacío de uso.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) La tabla
--
--    `checklist jsonb`: los pasos de la definición, con la misma forma que `cards.checklist`
--    ([{txt, done, done_at}]) para que instanciar sea copiar y no traducir.
--
--    `activa`: baja LÓGICA. Nunca se borra una definición — las tareas viejas siguen apuntando
--    acá y el histórico tiene que poder decir de dónde salieron. Desactivar la saca de la lista
--    de "crear desde el catálogo" sin romper nada de lo ya hecho.
--
--    `effort` con check (1,2,3,5): es la escala del proyecto (`Card["effort"]`). Sin el check, la
--    base podría guardar un 4 que TypeScript no sabe representar y que aparecería en la app como
--    un valor imposible.
--
--    `tiempo_max_horas` puede quedar en null = esta tarea no tiene un máximo propio; ahí manda el
--    tiempo máximo por categoría de `settings`, como hasta ahora.
-- ------------------------------------------------------------

create table if not exists public.tareas_estandar (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null check (length(btrim(nombre)) > 0),
  descripcion      text not null default '',
  checklist        jsonb not null default '[]'::jsonb,
  categoria        text,
  effort           int not null default 1 check (effort in (1, 2, 3, 5)),
  tiempo_max_horas int,
  activa           boolean not null default true,
  created_at       timestamptz not null default now()
);

comment on table public.tareas_estandar is
  'Definicion canonica de una tarea que se repite (misma tarea, distinta marca o empresa). Se instancia en cards; cards.estandar_id guarda de que definicion salio. No reemplaza a settings.closing_template, que sigue generando el cierre mensual.';

comment on column public.tareas_estandar.activa is
  'Baja LOGICA. Nunca se borra una definicion: las tareas viejas siguen apuntando aca. false = no se ofrece mas al crear, pero el historico sigue entero.';

comment on column public.tareas_estandar.checklist is
  'Pasos de la definicion, misma forma que cards.checklist. Al instanciar SE COPIA, no se referencia: si se referenciara, cambiar la definicion cambiaria las tareas ya cerradas del mes pasado.';

-- ------------------------------------------------------------
-- 2) El nombre es único, y sin distinguir mayúsculas
--
--    Todo el valor de esto es que la misma tarea se llame igual en los dos lados. Con una unique
--    común, "Conciliación bancaria" y "conciliación bancaria" serían dos definiciones distintas y
--    volveríamos al problema original con un paso más de burocracia en el medio.
--
--    Índice único sobre `lower(nombre)` en vez de `unique (nombre)`: es la misma garantía, más
--    estricta, y `if not exists` la hace repetible.
-- ------------------------------------------------------------

create unique index if not exists tareas_estandar_nombre_uk
  on public.tareas_estandar (lower(nombre));

-- ------------------------------------------------------------
-- 3) De qué definición salió cada tarea
--
--    `on delete set null` y NO `cascade`, y esta es la decisión importante del archivo:
--    borrar una definición del catálogo NO puede borrar las tareas que salieron de ella.
--    Pierden el vínculo, no la existencia. Con `cascade`, una limpieza del catálogo se llevaría
--    puesto trabajo real y cerrado, en silencio.
--
--    (En la práctica no se borra: la pantalla hace baja lógica con `activa`. El `set null` es la
--    red por si alguien borra una fila a mano desde el SQL Editor.)
-- ------------------------------------------------------------

alter table public.cards
  add column if not exists estandar_id uuid references public.tareas_estandar(id) on delete set null;

comment on column public.cards.estandar_id is
  'De que definicion del catalogo salio esta tarea. Null = se creo a mano, que sigue estando permitido. Es el campo que permite comparar la misma tarea entre marcas y personas.';

-- ------------------------------------------------------------
-- 4) Permisos
--
--    LEER: cualquiera con sesión. Todos crean tareas, así que todos necesitan ver el catálogo;
--    y qué pasos tiene una conciliación no es información sensible.
--
--    ESCRIBIR: sólo el jefe. Cambiar una definición cambia cómo se llama y cómo se describe el
--    trabajo de TODO el equipo. No es una preferencia personal.
--
--    `using` y `with check` dicen exactamente lo mismo, que es la regla que este proyecto
--    aprendió rompiendo cuatro tablas: si difieren, alguien ve algo que no puede guardar y
--    recibe el error crudo de Postgres.
-- ------------------------------------------------------------

alter table public.tareas_estandar enable row level security;

drop policy if exists "tareas_estandar_select" on public.tareas_estandar;
create policy "tareas_estandar_select" on public.tareas_estandar
  for select using (auth.uid() is not null);

drop policy if exists "tareas_estandar_escribir" on public.tareas_estandar;
create policy "tareas_estandar_escribir" on public.tareas_estandar
  for all
  using      (public.es_jefe())
  with check (public.es_jefe());

-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) La tabla, la columna y las dos policies existen:
--
--       select column_name from information_schema.columns
--        where table_name = 'tareas_estandar' order by ordinal_position;
--
--       select column_name from information_schema.columns
--        where table_name = 'cards' and column_name = 'estandar_id';
--
--       select policyname, cmd from pg_policies
--        where tablename = 'tareas_estandar' order by cmd;
--
--  2) Cargar una definición de prueba (como jefe) y verla:
--
--       insert into public.tareas_estandar (nombre, descripcion, categoria, effort)
--         values ('Conciliacion bancaria', 'Cruce del extracto contra el mayor.', null, 2);
--       select id, nombre, activa from public.tareas_estandar order by nombre;
--
--  3) El nombre no se puede repetir ni cambiando mayúsculas. Esto tiene que FALLAR:
--
--       insert into public.tareas_estandar (nombre) values ('conciliacion BANCARIA');
--
--  4) Y como empleado, que pueda leer y NO pueda escribir. Esto tiene que fallar:
--
--       insert into public.tareas_estandar (nombre) values ('Prueba desde empleado');
--
--  5) LO MÁS IMPORTANTE — borrar una definición no borra las tareas que salieron de ella.
--     Reemplazá <ESTANDAR_ID> por el id del paso 2 y <CARD_ID> por una tarea de prueba tuya:
--
--       update public.cards set estandar_id = '<ESTANDAR_ID>' where id = '<CARD_ID>';
--       delete from public.tareas_estandar where id = '<ESTANDAR_ID>';
--       select id, title, estandar_id from public.cards where id = '<CARD_ID>';
--
--     La tarea tiene que seguir ahí, con `estandar_id` en null. Si desapareciera, la clave
--     foránea quedó en `cascade` y hay que rehacerla.

insert into public.schema_migrations (id, nombre)
  values (55, 'migracion-55-catalogo-tareas.sql')
  on conflict (id) do nothing;
