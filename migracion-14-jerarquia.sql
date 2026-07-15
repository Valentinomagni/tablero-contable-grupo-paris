-- Migración 14 — Estructura jerárquica
alter table public.profiles add column if not exists manager_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists marca text; -- Peugeot | Citroën | Chevrolet | Honda

-- Un encargado puede LEER los profiles de su equipo (además de lo que ya permita su policy).
drop policy if exists "encargado ve su equipo" on public.profiles;
create policy "encargado ve su equipo" on public.profiles for select
  using (
    manager_id = auth.uid()               -- mis reportes directos
    or id = auth.uid()                     -- yo mismo
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'jefe')
  );

-- Un encargado puede ACTUALIZAR (reasignar) las cards cuyos dueños son de su equipo.
drop policy if exists "encargado gestiona cards de su equipo" on public.cards;
create policy "encargado gestiona cards de su equipo" on public.cards for update
  using (
    owner = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'jefe')
    or exists (select 1 from public.profiles e where e.id = auth.uid() and e.role = 'encargado'
               and exists (select 1 from public.profiles emp where emp.id = public.cards.owner and emp.manager_id = e.id))
  );
