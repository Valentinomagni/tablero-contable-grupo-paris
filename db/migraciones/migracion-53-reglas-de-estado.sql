-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 53
--  Las dos reglas de estado, del lado de la base.
--  Correr en Supabase -> SQL Editor. Se puede correr dos veces.
-- ============================================================================
--
--  AVISO PARA EL DUEÑO, ANTES DE CORRERLA
--
--  Desde que esto esté aplicado, las tareas que HOY tienen el checklist a medias no se van a
--  poder cerrar hasta completarlo. Es exactamente el efecto buscado, pero conviene decírselo
--  al equipo antes y no que lo descubran un día 30, con el cierre encima.
--
--  Para saber a cuántas afecta, antes de correr esto:
--
--      select count(*) from public.cards c
--       where c.status <> 'term'
--         and jsonb_typeof(c.checklist) = 'array'
--         and exists (
--           select 1 from jsonb_array_elements(c.checklist) i
--            where coalesce(i->>'done', '') <> 'true'
--         );
--
--  POR QUÉ UN TRIGGER SI LAS REGLAS YA ESTÁN EN EL FRONT
--
--  Están: viven en `src/lib/transicion.ts` y los SEIS caminos que cierran una tarea la
--  consultan. Lo que las cuida hoy es un guardián que busca por TEXTO en el fuente, y hay un
--  camino que ese guardián NO PUEDE VER: el arrastre del tablero escribe `{ status }` desde
--  una variable, nunca el literal `status: "term"`. Un séptimo camino escrito de esa misma
--  forma quedaría afuera de la regla sin que nada avisara.
--
--  El trigger no mira el fuente: mira la escritura. Ése es su valor real, y es distinto del
--  argumento habitual —"el front se puede saltear"—, que también vale.
--
--  Y hay un segundo motivo, propio de esta app: las mutaciones del tablero son OPTIMISTAS. Si
--  el front deja pasar algo que la base después rechaza, la tarjeta se mueve de columna y
--  vuelve sola. Eso se ve como un bug del arrastre, no como una regla.
--
--  El front sigue existiendo para avisar ANTES —eso es lo que hace que la regla no se sienta
--  como una pared—. Esto es lo que hace que la pared exista.
-- ============================================================================


-- ============================================================================
--  1) La función que valida
-- ============================================================================

create or replace function public.cards_validar_estado() returns trigger
language plpgsql
-- `set search_path = public` por la misma razón que el resto de las funciones del proyecto
-- (migración 43): sin eso, quien pueda crear un esquema temporal puede hacer que
-- `jsonb_array_elements` resuelva a otra cosa.
set search_path = public
as $$
declare
  sin_marcar int;
begin
  -- Sólo interesa lo que AVANZA hacia terminado. Reabrir siempre se puede: ya queda registrado
  -- como reapertura y se mide en el índice de retrabajo. Bloquear la vuelta atrás empujaría a
  -- crear una tarea nueva, y ahí se pierde el rastro de que era la misma.
  --
  -- `is distinct from` y no `<>`: si `new.status` viniera en null, `<>` da null, el `or` no se
  -- cumple y la validación seguiría de largo sobre una fila que no está yendo a terminado.
  if new.status is distinct from 'term' or old.status = 'term' then
    return new;
  end if;

  -- LO QUE ESCRIBE OTRO TRIGGER NO SE VUELVE A VALIDAR, y esto NO es una comodidad: sin esta
  -- guarda, las tareas compartidas dejan de poder cerrarse.
  --
  -- `sync_compartidas` (migración 13) es un trigger AFTER UPDATE que, al cerrar una tarjeta,
  -- le copia el estado a las tarjetas ESPEJO de los demás participantes. Esas hermanas están
  -- normalmente en Pendiente —el otro nunca las tocó, para eso se las delegó— y con el
  -- checklist sin tildar. Si la validación corriera también sobre ellas, la excepción abortaría
  -- LA TRANSACCIÓN ENTERA: la persona que sí hizo todo bien no podría cerrar su propia tarea, y
  -- encima leería "Antes de terminarla, pasala a En proceso" sobre un estado que no puede ver.
  --
  -- La copia no es una decisión nueva: es el reflejo de una que ya se validó en la tarjeta de
  -- origen, un segundo antes y en esta misma transacción.
  --
  -- `pg_trigger_depth()` vale 1 cuando la escritura viene de la app y 2 o más cuando la
  -- disparó otro trigger. Es la única forma de distinguirlas desde acá.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- REGLA 1: no se salta "En proceso".
  --
  -- Pasar de Pendiente a Terminado deja `proc_at` en null: el tiempo de ciclo del equipo se
  -- calcula sobre una ficción y la tarea figura resuelta en cero horas.
  if old.status = 'pend' then
    raise exception 'regla_estado: Antes de terminarla, pasala a En proceso.';
  end if;

  -- REGLA 2: el checklist va completo. Sin checklist no hay nada que completar.
  --
  -- El `jsonb_typeof(...) = 'array'` no sobra: `jsonb_array_elements` sobre un objeto o un
  -- texto lanza un error de Postgres crudo (22023), y ese error taparía la regla con un mensaje
  -- que nadie puede leer. Ante una fila con la forma rara, se deja pasar: la regla es para
  -- checklists de verdad, no un validador de esquema.
  --
  -- `->>'done' <> 'true'` en vez de castear a boolean por lo mismo: un `::boolean` sobre un
  -- valor inesperado lanza 22P02 y rompe el cierre. Así, lo que no diga `true` cuenta como
  -- pendiente, que es el mismo criterio que usa `pasosQueFaltan` en el front (`done !== true`).
  if jsonb_typeof(new.checklist) = 'array' then
    select count(*) into sin_marcar
      from jsonb_array_elements(new.checklist) item
     where coalesce(item->>'done', '') <> 'true';
  else
    sin_marcar := 0;
  end if;

  -- Singular y plural separados: este texto lo lee una persona tal cual (el front le saca el
  -- prefijo y lo muestra sin tocar), así que "Faltan 1 pasos" no es una opción. Las dos frases
  -- son las mismas, palabra por palabra, que las de `bloqueoDeTransicion` en `transicion.ts`:
  -- si la regla se explica distinto según quién la frenó, parecen dos reglas.
  if sin_marcar = 1 then
    raise exception 'regla_estado: Falta 1 paso del checklist.';
  elsif sin_marcar > 1 then
    raise exception 'regla_estado: Faltan % pasos del checklist.', sin_marcar;
  end if;

  return new;
end;
$$;

-- El prefijo `regla_estado:` es un CÓDIGO, no un mensaje. Lo lee `clasificarFalla` en
-- `src/lib/fallas.ts` (constante `MARCA_REGLA_ESTADO`), que muestra el texto que sigue y se
-- queda con el prefijo. Mismo mecanismo que `ya_cerrado:` en la migración 50.
--
-- POR QUÉ NO SE MANDA EL TEXTO PELADO: la regla del proyecto es que un error nunca muestra el
-- mensaje crudo de la base. Sin una marca, el front no tiene forma de distinguir este texto
-- —escrito para una persona— del volcado de un error de Postgres, y tiene que taparlos a los
-- dos con el genérico "No se pudo mover la tarea".
comment on function public.cards_validar_estado() is
  'Trigger de cards: no se salta En proceso y el checklist va completo. Los mensajes salen con el prefijo regla_estado:, que lo lee clasificarFalla en src/lib/fallas.ts.';


-- ============================================================================
--  2) El trigger
-- ============================================================================
--
--  `before update of status`: sólo corre cuando el UPDATE nombra la columna `status`. Todo lo
--  demás que se edita de una tarjeta —título, checklist, comentarios— no paga nada.
--
--  BEFORE y no AFTER porque la fila no tiene que llegar a escribirse: si la regla no se cumple,
--  no hay nada que deshacer.

drop trigger if exists cards_validar_estado on public.cards;
create trigger cards_validar_estado
  before update of status on public.cards
  for each row execute function public.cards_validar_estado();


-- ============================================================================
--  3) Que no quede publicada como endpoint
-- ============================================================================
--
--  Misma lección que la migración 43: en PostgreSQL toda función se crea con EXECUTE otorgado
--  a PUBLIC, y `anon` hereda de PUBLIC — revocarle sólo a `anon` no saca nada. Una función de
--  trigger no se llama nunca por HTTP; el trigger la ejecuta por su cuenta, sin pasar por el
--  permiso del usuario, así que revocarla no lo rompe.

revoke execute on function public.cards_validar_estado() from public, anon, authenticated;


-- ============================================================================
--  LO QUE ESTO NO CUBRE, escrito para que nadie lo suponga
-- ============================================================================
--
--  - `card_periodos` (el estado de los meses que no son el vigente) NO tiene este trigger. Ahí
--    escribe un solo lugar, `guardarPeriodo` en `src/lib/periodo-escritura.ts`, y ese camino sí
--    consulta `transicion.ts`. Si algún día hay un segundo camino, esto hay que replicarlo.
--  - Un INSERT que nazca ya en 'term' no se valida: el trigger es sólo de UPDATE. Hoy ninguna
--    pantalla crea tareas terminadas (todas nacen en 'pend').
--  - La espejada de tareas compartidas queda fuera a propósito. Está explicado arriba, en la
--    guarda de `pg_trigger_depth()`.


-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) El trigger existe y está activo ('O' = enabled):
--
--       select tgname, tgenabled from pg_trigger
--        where tgrelid = 'public.cards'::regclass and not tgisinternal;
--
--  2) La regla 1 frena. Reemplazá <CARD_ID> por una tarea tuya de prueba en Pendiente.
--     Esto tiene que FALLAR con "regla_estado: Antes de terminarla, pasala a En proceso.":
--
--       update public.cards set status = 'term' where id = '<CARD_ID>';
--
--  3) La regla 2 frena. Poné esa misma tarea en proceso con un paso sin tildar:
--
--       update public.cards
--          set status = 'proc',
--              checklist = '[{"txt":"probar","done":false}]'::jsonb
--        where id = '<CARD_ID>';
--
--     Y ahora esto tiene que FALLAR con "regla_estado: Falta 1 paso del checklist.":
--
--       update public.cards set status = 'term' where id = '<CARD_ID>';
--
--  4) Con el checklist completo, cierra:
--
--       update public.cards set checklist = '[{"txt":"probar","done":true}]'::jsonb
--        where id = '<CARD_ID>';
--       update public.cards set status = 'term', done_at = now() where id = '<CARD_ID>';
--
--  5) Reabrir sigue andando siempre (esto NO tiene que fallar):
--
--       update public.cards set status = 'proc', done_at = null where id = '<CARD_ID>';

insert into public.schema_migrations (id, nombre)
  values (53, 'migracion-53-reglas-de-estado.sql')
  on conflict (id) do nothing;
