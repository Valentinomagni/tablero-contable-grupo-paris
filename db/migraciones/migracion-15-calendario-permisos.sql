-- Migración 15 — Visibilidad de eventos de calendario
alter table public.announcements add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.announcements add column if not exists visible_to uuid[] default '{}';

-- Todos pueden insertar sus eventos (owner_id = auth.uid()).
drop policy if exists "crear evento propio" on public.announcements;
create policy "crear evento propio" on public.announcements for insert with check (owner_id = auth.uid() or owner_id is null);

-- SELECT por rol/equipo/destinatario:
drop policy if exists "ver eventos segun rol" on public.announcements;
create policy "ver eventos segun rol" on public.announcements for select using (
  owner_id = auth.uid()                                   -- propios
  or auth.uid() = any(visible_to)                         -- me lo compartieron
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'jefe')  -- jefe: todos
  or exists (select 1 from public.profiles e where e.id = auth.uid() and e.role = 'encargado'
             and exists (select 1 from public.profiles emp where emp.id = public.announcements.owner_id and emp.manager_id = e.id)) -- encargado: su equipo
  or owner_id is null                                     -- eventos legacy (jefe cargó sin owner) siguen visibles
);
