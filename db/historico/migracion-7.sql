-- =====================================================================
-- MIGRACIÓN 7: tablón común (vencimientos/avisos/procesos) + dependencias
-- Pegar todo en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- 1. Tablón: publican los jefes, lo ven todos
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'aviso' check (kind in ('vencimiento','aviso','proceso')),
  title text not null,
  detail text not null default '',
  due_date date,                 -- solo para vencimientos
  created_by text not null default '',
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;
create policy "tablon visible para todos" on public.announcements
  for select to authenticated using (true);
create policy "solo jefes publican" on public.announcements
  for insert to authenticated with check (public.is_jefe());
create policy "solo jefes editan tablon" on public.announcements
  for update to authenticated using (public.is_jefe());
create policy "solo jefes borran tablon" on public.announcements
  for delete to authenticated using (public.is_jefe());

alter publication supabase_realtime add table public.announcements;

-- 2. Dependencias entre tareas: lista de ids de tareas de las que depende
alter table public.cards add column if not exists deps jsonb not null default '[]';

-- 3. Info mínima de tareas ajenas para resolver dependencias
--    (un empleado no ve tarjetas de otros, pero SÍ necesita saber si la tarea
--     que lo bloquea está terminada: título, estado y responsable, nada más)
create or replace function public.deps_info(ids uuid[])
returns table(id uuid, title text, status text, owner_name text)
language sql security definer stable set search_path = public as $$
  select c.id, c.title, c.status, p.name
    from cards c join profiles p on p.id = c.owner
   where c.id = any(ids);
$$;

-- 4. Confirmación
select 'ok' as resultado;
