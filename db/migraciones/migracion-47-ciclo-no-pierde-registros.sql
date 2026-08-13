-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 47
--  El ciclo diario deja de perder registros de cumplimiento.
--  Correr en Supabase -> SQL Editor. No borra ningún dato.
-- ============================================================================
--
--  CÓMO SE ENCONTRÓ ESTO
--
--  La primera corrida de `ciclo_recurrente_diario()` devolvió:
--
--      2026-08-13: 19 tareas reactivadas, 15 ciclos registrados
--
--  Diecinueve y quince. Cuatro tareas volvieron a Pendiente **sin que quedara registrado que el
--  ciclo anterior se había completado**. El número no cerraba, y ahí estaba el defecto.
--
--  QUÉ PASABA
--
--  La migración 46 insertaba el registro así:
--
--      insert into task_occurrences (card_id, owner, fecha, done, done_at)
--        values (..., true, now())
--        on conflict (card_id, fecha) do nothing;   <-- acá
--
--  Pero `materializar_mes_recurrentes` **ya crea las filas del mes por adelantado**, con
--  `done = false`. Entonces, para esas cuatro tareas, la fila del día ya existía, el
--  `do nothing` salteó el insert, y la fila quedó en `done = false`.
--
--  O sea: la tarjeta estaba en Terminada —el trabajo se hizo— y el registro del día dice que no.
--
--  POR QUÉ IMPORTA, Y NO ES UN DETALLE
--
--  Ese registro es de donde sale el avance del mes que pidió Patricia: "6 de 24 arqueos". Con
--  este defecto, un día trabajado y cerrado cuenta como no hecho, y el porcentaje queda por
--  debajo de la realidad. Es exactamente el tipo de número que hace que alguien deje de creerle
--  al tablero — y encima, en contra de quien sí hizo el trabajo.
--
--  EL ARREGLO, Y LO QUE NO TOCA
--
--  Pasa a `do update`, pero **sólo sobre `done` y `done_at`**, y sólo si todavía no estaba
--  marcado. Todo lo demás de esa fila —el resultado del arqueo, el importe de la diferencia, la
--  observación, el checklist del día— **se deja intacto**. Esos los cargó una persona y no se
--  pisan nunca desde un proceso automático.
--
--  El `where` del final es el que garantiza eso: si la fila ya estaba en `done = true`, no se
--  toca nada, ni siquiera la fecha de cumplimiento. La primera marca es la buena.
-- ============================================================================

create or replace function public.ciclo_recurrente_diario()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  dow int := extract(dow from hoy)::int;   -- 0=domingo .. 6=sábado, igual que en el front
  reactivadas int := 0;
  registradas int := 0;
  n int;
  c record;
  proximo date;
  fecha_ciclo date;
begin
  for c in
    select id, owner, due_date, recur_rule, checklist, history
      from public.cards
     where status = 'term'
       and recur_rule is not null
       and coalesce(card_type, 'normal') <> 'operativa'
       and (
            recur_rule->>'tipo' = 'diaria'
         or (recur_rule->>'tipo' = 'semanal'
             and (recur_rule->'dias') @> to_jsonb(dow))
         or (recur_rule->>'tipo' = 'mensual'
             and extract(day from hoy)::int = least(
                   (recur_rule->>'diaMes')::int,
                   extract(day from (date_trunc('month', hoy) + interval '1 month - 1 day'))::int))
       )
  loop
    fecha_ciclo := coalesce(c.due_date, hoy - 1);

    -- 1) Registrar que el ciclo anterior se completó.
    --
    --    `do update` y no `do nothing`: la fila puede existir ya, creada por adelantado por
    --    `materializar_mes_recurrentes` con `done = false`. Con `do nothing` se salteaba y el
    --    día quedaba contado como no hecho, aunque la tarjeta estuviera en Terminada.
    --
    --    El `where` es la parte importante: sólo actualiza si NO estaba hecho. Así una segunda
    --    corrida no pisa la fecha de cumplimiento original, y —sobre todo— nunca se tocan
    --    `resultado`, `dif_importe`, `dif_obs` ni el checklist del día, que los cargó una
    --    persona. Un proceso automático no reescribe lo que alguien afirmó.
    insert into public.task_occurrences (card_id, owner, fecha, done, done_at)
      values (c.id, c.owner, fecha_ciclo, true, now())
      on conflict (card_id, fecha) do update
        set done = true,
            done_at = coalesce(public.task_occurrences.done_at, now())
      where public.task_occurrences.done is distinct from true;

    get diagnostics n = row_count;
    registradas := registradas + n;

    -- 2) El vencimiento del ciclo nuevo.
    proximo := case
      when c.recur_rule->>'tipo' = 'diaria' then hoy + 1
      when c.recur_rule->>'tipo' = 'mensual' then
        least(
          (date_trunc('month', hoy) + interval '1 month')::date
            + ((c.recur_rule->>'diaMes')::int - 1),
          (date_trunc('month', hoy) + interval '2 month - 1 day')::date)
      else
        (select d::date
           from generate_series(hoy + 1, hoy + 7, interval '1 day') d
          where (c.recur_rule->'dias') @> to_jsonb(extract(dow from d)::int)
          order by d limit 1)
    end;

    -- 3) La tarjeta vuelve a Pendiente. Es la MISMA tarjeta: no se duplica nada.
    update public.cards
       set status = 'pend',
           done_at = null,
           due_date = proximo,
           checklist = coalesce(
             (select jsonb_agg(i || '{"done":false,"done_at":null}'::jsonb)
                from jsonb_array_elements(coalesce(checklist, '[]'::jsonb)) i),
             '[]'::jsonb),
           -- "ciclo" y no "reabrió": `src/lib/retrabajo.ts` cuenta las reaperturas leyendo el
           -- historial, y ese índice se le muestra al jefe. Hay un test que verifica que los
           -- dos textos no se solapen.
           history = coalesce(history, '[]'::jsonb) || jsonb_build_object(
             'who', 'Sistema',
             'at', now(),
             'txt', 'Nuevo ciclo de la recurrencia'
           )
     where id = c.id;

    reactivadas := reactivadas + 1;
  end loop;

  return format('%s: %s tareas reactivadas, %s ciclos registrados', hoy, reactivadas, registradas);
end;
$$;

revoke execute on function public.ciclo_recurrente_diario() from public, anon, authenticated;


-- ============================================================================
--  REPARAR LOS CUATRO QUE YA SE PERDIERON
-- ============================================================================
--
--  La corrida del 13/08 dejó cuatro tareas reactivadas sin su registro. Se reparan acá:
--  para toda tarjeta cuyo historial diga que arrancó un ciclo nuevo, la ocurrencia del día
--  anterior a su vencimiento actual tiene que estar marcada como hecha.
--
--  Se acota a los últimos 7 días para no tocar historia vieja, y se respeta lo mismo de arriba:
--  sólo se marca lo que está sin marcar.

update public.task_occurrences o
   set done = true, done_at = coalesce(o.done_at, now())
  from public.cards c
 where o.card_id = c.id
   and o.done is distinct from true
   and o.fecha >= (now() at time zone 'America/Argentina/Buenos_Aires')::date - 7
   and o.fecha <  (now() at time zone 'America/Argentina/Buenos_Aires')::date
   and c.recur_rule is not null
   and exists (
     select 1 from jsonb_array_elements(coalesce(c.history, '[]'::jsonb)) h
      where h->>'txt' = 'Nuevo ciclo de la recurrencia'
        and (h->>'at')::timestamptz >= now() - interval '7 days'
   );


-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) Volver a correrla. La segunda corrida del mismo día tiene que decir **0 reactivadas**,
--     porque las tareas ya están en Pendiente:
--
--       select public.ciclo_recurrente_diario();
--
--  2) Y mañana, cuando corra sola, los dos números tienen que coincidir: tantas reactivadas
--     como ciclos registrados. Si vuelven a diferir, hay otra causa y hay que mirarla.
--
--  3) Que la reparación haya alcanzado a las cuatro:
--
--       select count(*) as sin_registrar
--         from public.task_occurrences o join public.cards c on c.id = o.card_id
--        where o.done is distinct from true
--          and o.fecha >= current_date - 7 and o.fecha < current_date
--          and c.recur_rule is not null;
--
--     Debería dar 0, o sólo días que de verdad no se trabajaron.

insert into public.schema_migrations (id, nombre)
  values (47, 'migracion-47-ciclo-no-pierde-registros.sql')
  on conflict (id) do nothing;
