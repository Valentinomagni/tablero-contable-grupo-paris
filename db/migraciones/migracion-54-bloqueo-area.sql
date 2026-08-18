-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 54
--  Marcar que una tarea espera a otra área, sin involucrar a esa área.
--  Correr en Supabase -> SQL Editor. Se puede correr dos veces.
-- ============================================================================
--
--  EL PEDIDO, textual: "añadir dependencia de otras áreas, pero sin implicarlas, porque no van a
--  usar la aplicación por el momento; pero estaría bueno marcar que si algo está trabado sea por
--  otra área. Ej: ventas, administración, recursos humanos".
--
--  POR QUÉ NO ALCANZA CON `deps`
--
--  `cards.deps` es tarea-a-tarea y sólo funciona entre tareas que existen acá. Ventas no tiene
--  tareas en el tablero y no las va a tener. Esto no es una dependencia: es UNA ESPERA
--  REGISTRADA, que es otra cosa y necesita otra forma.
--
--  EL VALOR REAL, y es el que decide el diseño: hoy, cuando el trabajo se traba por otra área,
--  esa demora aparece como demora del equipo contable. El jefe ve tareas quietas y no tiene cómo
--  saber que la pelota está afuera. Esto separa las dos cosas.
--
--  POR QUÉ SON DOS COLUMNAS Y NO UNA
--
--  Sin la fecha, "bloqueada por Ventas" es una etiqueta con la que no se puede hacer nada: no se
--  sabe si espera hace un día o hace un mes. Con fecha es "hace 6 días hábiles que espera a
--  Ventas", y con eso alguien puede levantar el teléfono. La lib `src/lib/bloqueo-area.ts` exige
--  las dos o ninguna, justamente para que no queden etiquetas sin fecha.
--
--  LO QUE ESTO NO HACE, escrito para que nadie lo suponga: no le notifica nada a esas áreas, no
--  les crea usuarios y no les manda mensajes. Es un registro interno. Involucrarlas ahora sería
--  construir para usuarios que no existen.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) Las dos columnas
--
--    `text` y no una tabla de áreas con clave foránea: la lista vive en `settings`, junto a
--    marcas y sucursales (clave 'organizacion'), que es donde ya viven las listas configurables
--    de este proyecto. Una tabla nueva obligaría a una pantalla nueva para administrarla, y la
--    de organización ya existe.
-- ------------------------------------------------------------

alter table public.cards add column if not exists bloqueo_area  text;
alter table public.cards add column if not exists bloqueo_desde timestamptz;

comment on column public.cards.bloqueo_area is
  'Area externa que tiene trabada esta tarea (Ventas, Administracion, RRHH...). Null = no esta trabada. La lista de areas vive en settings, clave organizacion.';

comment on column public.cards.bloqueo_desde is
  'Desde cuando espera. Sin esto, el area es una etiqueta inutil: no se sabe si espera hace un dia o hace un mes.';

-- ------------------------------------------------------------
-- 2) Que no quede una sin la otra
--
--    El front ya lo garantiza, pero el front no es el único que escribe: hay siete caminos que
--    crean tareas y seis que las cierran. Un check en la base es una sola regla; en el front
--    serían trece lugares donde acordarse.
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cards_bloqueo_completo'
  ) then
    alter table public.cards add constraint cards_bloqueo_completo
      check ( (bloqueo_area is null) = (bloqueo_desde is null) );
  end if;
end $$;

-- ------------------------------------------------------------
-- 3) Índice parcial
--
--    Sólo sobre las bloqueadas, que son pocas. Un índice sobre toda la tabla para encontrar el
--    puñado que está trabado es pagar en cada escritura por una consulta que se hace de vez en
--    cuando.
-- ------------------------------------------------------------

create index if not exists cards_bloqueo_area_idx
  on public.cards (bloqueo_area)
  where bloqueo_area is not null;

-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) Las columnas y el check existen:
--
--       select column_name from information_schema.columns
--        where table_name = 'cards' and column_name like 'bloqueo%';
--
--       select conname from pg_constraint where conname = 'cards_bloqueo_completo';
--
--  2) El check hace lo suyo. Reemplazá <CARD_ID> por una tarea tuya de prueba.
--     Esto tiene que FALLAR (area sin fecha):
--
--       update public.cards set bloqueo_area = 'Ventas' where id = '<CARD_ID>';
--
--     Y esto tiene que andar:
--
--       update public.cards set bloqueo_area = 'Ventas', bloqueo_desde = now()
--        where id = '<CARD_ID>';
--
--     Destrabarla, que también tiene que andar (las dos a null a la vez):
--
--       update public.cards set bloqueo_area = null, bloqueo_desde = null
--        where id = '<CARD_ID>';

insert into public.schema_migrations (id, nombre)
  values (54, 'migracion-54-bloqueo-area.sql')
  on conflict (id) do nothing;
