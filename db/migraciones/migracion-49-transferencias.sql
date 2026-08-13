-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 49
--  Registro de transferencias de clientes, con detección de comprobantes repetidos.
--  Correr en Supabase -> SQL Editor. No toca ningún dato existente.
-- ============================================================================
--
--  ESTO CIERRA EL REPORTE DE PATRICIA
--
--  Hoy las transferencias de los clientes se controlan con PDFs sueltos en un grupo de
--  mensajería. No hay lista, no hay orden, y —sobre todo— no hay manera de darse cuenta de que
--  un comprobante ya se cargó: el mismo pago entra dos veces, la cuenta del cliente queda mal, y
--  el error aparece semanas después conciliando, cuando ya nadie se acuerda del caso.
--
--  Un grupo de mensajería no es un registro: no se puede buscar, no se puede ordenar por fecha,
--  y lo que se scrollea se pierde. Esta tabla es el registro que falta.
--
--  QUÉ NO HACE ESTA MIGRACIÓN: no bloquea la carga de nada por parecerse a otra cosa. El aviso
--  de duplicado lo da la app (`src/lib/transferencias.ts`) mostrando la transferencia parecida y
--  preguntando si es la misma. Si el sistema impidiera cargar lo que él cree repetido, quien
--  sabe que no lo es tendría que falsear un dato para poder seguir —cambiar un peso el monto,
--  inventar un número— y a partir de ahí el registro entero es mentira.
--
--  Lo único que la base sí impide es dos veces el MISMO NÚMERO DE COMPROBANTE, que no es una
--  sospecha sino un hecho: un comprobante identifica una operación. Ver el índice del punto 2.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) La tabla
--
--    `monto` es NUMERIC, nunca float ni double.
--
--    Con punto flotante los centavos se pierden: 0.1 + 0.2 no da 0.3, y una suma de doscientas
--    transferencias termina desviada unos centavos. Eso alcanza para que una conciliación no
--    cierre y para que alguien pase una tarde buscando un error que no está en ningún lado.
--    `numeric` guarda el número decimal exacto. El proyecto ya usa `numeric` para
--    `task_occurrences.dif_importe` por el mismo motivo: se sigue ese criterio.
--
--    La escala fija (14,2) es el centavo: dos decimales, hasta doce dígitos enteros. No hay
--    transferencia de cliente que no entre ahí, y deja el redondeo definido en un solo lugar en
--    vez de depender de lo que mande cada pantalla.
--
--    `card_id` con `on delete cascade`: las transferencias son el contenido de esa tarea de
--    control, no viven sin ella. `owner` es quien la cargó, y es lo que usan las policies.
-- ------------------------------------------------------------

create table if not exists public.transferencias (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  owner uuid not null references auth.users(id),
  fecha date not null,                      -- fecha de la transferencia, NO la de carga
  cliente text not null default '',
  cuit text,
  monto numeric(14,2) not null default 0,   -- es plata: numeric, jamás float
  nro_comprobante text,                     -- puede faltar: no toda transferencia trae número
  adjunto_path text,                        -- ruta del PDF en el bucket `adjuntos` (migración 28)
  created_at timestamptz not null default now()
);

comment on table public.transferencias is
  'Transferencias de clientes cargadas desde la tarea de control. monto es numeric (plata): con float se pierden centavos y las conciliaciones no cierran.';

alter table public.transferencias enable row level security;

-- Un comprobante en blanco tiene que llegar como NULL, no como cadena vacía.
--
-- POR QUÉ IMPORTA: el índice único de abajo ignora los NULL, pero NO ignora las cadenas vacías.
-- Si una pantalla mandara '' en vez de null, la primera transferencia sin número se cargaría y
-- la segunda fallaría por "comprobante repetido" sin que haya ningún comprobante. Es un bloqueo
-- imposible de entender desde el otro lado de la pantalla.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transferencias_nro_no_vacio'
      and conrelid = 'public.transferencias'::regclass
  ) then
    alter table public.transferencias
      add constraint transferencias_nro_no_vacio
      check (nro_comprobante is null or btrim(nro_comprobante) <> '');
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) El índice único PARCIAL sobre el número de comprobante
--
--    Parcial —`where nro_comprobante is not null`— y esa palabra es todo el punto: buena parte
--    de las transferencias llegan sin número (una captura de pantalla, un aviso del banco sin
--    referencia). Con un unique común, la segunda transferencia sin número chocaría con la
--    primera y no se podría cargar. La gente no dejaría de cargarlas: inventaría números, que es
--    bastante peor que no tenerlos.
--
--    Con el índice parcial, los NULL no se comparan entre sí: se pueden cargar todas las que
--    haga falta sin número, y en cambio dos comprobantes con el MISMO número no entran nunca.
-- ------------------------------------------------------------

create unique index if not exists transferencias_nro_comprobante_uidx
  on public.transferencias (nro_comprobante)
  where nro_comprobante is not null;

-- Listado de la tarea: las de esta card, la más reciente primero.
create index if not exists transferencias_card_fecha_idx
  on public.transferencias (card_id, fecha desc);

-- Búsqueda del duplicado probable (mismo cliente, mismo mes) sin recorrer la tabla entera.
create index if not exists transferencias_owner_fecha_idx
  on public.transferencias (owner, fecha desc);

-- ------------------------------------------------------------
-- 3) Permisos
--
--    LEER: quien la cargó, el jefe, y el encargado de quien la cargó. Es el mismo alcance que
--    `card_periodos` y `task_occurrences`: nadie ve el movimiento de un cliente que no es de su
--    equipo.
--
--    CARGAR: cada uno carga a su nombre (`owner = auth.uid()`).
--
--    CORREGIR Y BORRAR: también el jefe y el encargado. Acá se apartan del molde de
--    `card_periodos` a propósito: un monto mal tipeado en un registro de plata tiene que poder
--    arreglarse el día que se detecta, aunque quien lo cargó esté de licencia. Que la corrección
--    dependa de una sola persona es cómo un número equivocado se queda meses.
--
--    `using` y `with check` de la policy de update dicen EXACTAMENTE lo mismo, palabra por
--    palabra. Es la regla que este proyecto aprendió rompiendo cuatro tablas: cuando difieren,
--    alguien ve una fila que no puede guardar y lo que recibe es el error crudo de Postgres.
--
--    Se usan los helpers SECURITY DEFINER `public.es_jefe()` y `public.es_encargado_de(uuid)`
--    (migración 14-FIX) — nunca una subconsulta a `profiles` adentro de una policy, que es lo
--    que produce el 42P17 (recursión infinita).
-- ------------------------------------------------------------

drop policy if exists "transferencias_select" on public.transferencias;
create policy "transferencias_select" on public.transferencias for select
  using (
    owner = auth.uid()
    or public.es_jefe()
    or public.es_encargado_de(owner)
  );

drop policy if exists "transferencias_insert" on public.transferencias;
create policy "transferencias_insert" on public.transferencias for insert
  with check (owner = auth.uid());

drop policy if exists "transferencias_update" on public.transferencias;
create policy "transferencias_update" on public.transferencias for update
  using      (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner))
  with check (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));

drop policy if exists "transferencias_delete" on public.transferencias;
create policy "transferencias_delete" on public.transferencias for delete
  using (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));

-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) La tabla existe, el monto es numeric y las cuatro policies están:
--
--       select column_name, data_type, numeric_scale from information_schema.columns
--        where table_name = 'transferencias' order by ordinal_position;
--       select policyname, cmd from pg_policies
--        where tablename = 'transferencias' order by cmd;
--
--  2) El índice parcial deja cargar varias SIN número (esto tiene que andar):
--
--       insert into public.transferencias (card_id, owner, fecha, cliente, monto)
--         select id, owner, current_date, 'Prueba A', 1000 from public.cards limit 1;
--       insert into public.transferencias (card_id, owner, fecha, cliente, monto)
--         select id, owner, current_date, 'Prueba B', 2000 from public.cards limit 1;
--
--  3) …y en cambio NO deja repetir un número de comprobante. La segunda tiene que fallar:
--
--       insert into public.transferencias (card_id, owner, fecha, cliente, monto, nro_comprobante)
--         select id, owner, current_date, 'Prueba C', 3000, 'TEST-49' from public.cards limit 1;
--       insert into public.transferencias (card_id, owner, fecha, cliente, monto, nro_comprobante)
--         select id, owner, current_date, 'Prueba D', 4000, 'TEST-49' from public.cards limit 1;
--
--  4) Borrar las pruebas:
--
--       delete from public.transferencias where cliente like 'Prueba %';

insert into public.schema_migrations (id, nombre)
  values (49, 'migracion-49-transferencias.sql')
  on conflict (id) do nothing;
