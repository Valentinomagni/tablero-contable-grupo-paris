-- Migración 16 — Recurrencia y ocurrencias (única fuente de verdad)
-- Regla de recurrencia en la card (jsonb): { tipo: 'diaria'|'semanal'|'mensual', dias?: int[], diaMes?: int }
alter table public.cards add column if not exists recur_rule jsonb;

create table if not exists public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  owner uuid not null references public.profiles(id) on delete cascade,
  fecha date not null,
  done boolean not null default false,
  done_at timestamptz,
  unique (card_id, fecha)
);
alter table public.task_occurrences enable row level security;
-- `drop ... if exists` primero: sin esto, correr el archivo dos veces falla con 42710
-- (policy already exists) y aborta la transacción, dejando todo lo de abajo sin aplicar.
-- Rompía reconstruir la base desde cero, que es justo cuando más hace falta que funcione.
drop policy if exists "occ propias o jefe" on public.task_occurrences;
create policy "occ propias o jefe" on public.task_occurrences for all using (
  owner = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('jefe','encargado')
             and (p.role='jefe' or exists (select 1 from public.profiles e where e.id=public.task_occurrences.owner and e.manager_id=p.id)))
) with check (owner = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='jefe'));
