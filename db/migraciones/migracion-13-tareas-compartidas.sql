-- Migración 13 — Tareas compartidas / delegadas
-- Sincroniza el estado entre las tarjetas "espejo" de una tarea compartida (mismo vínculo
-- "compartida:<id>" en el historial): al terminar/reabrir una, se actualizan las hermanas.
-- SECURITY DEFINER: corre con permisos del dueño de la función, así un empleado puede cerrar
-- su tarjeta y sincronizar la del jefe (o de un compañero) aunque RLS no lo dejaría directamente.
-- Es idempotente y no recursivo: solo toca hermanas cuyo estado DIFIERE del nuevo.

create or replace function public.sync_compartidas() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  vinc text;
begin
  if new.status is distinct from old.status then
    select (elem->>'txt') into vinc
    from jsonb_array_elements(coalesce(new.history, '[]'::jsonb)) elem
    where elem->>'txt' like 'compartida:%'
    limit 1;

    if vinc is not null then
      update public.cards c
      set status = new.status,
          done_at = case when new.status = 'term' then new.done_at else null end
      where c.id <> new.id
        and c.status is distinct from new.status
        and exists (
          select 1 from jsonb_array_elements(coalesce(c.history, '[]'::jsonb)) e
          where e->>'txt' = vinc
        );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_compartidas on public.cards;
create trigger trg_sync_compartidas
  after update of status on public.cards
  for each row execute function public.sync_compartidas();
