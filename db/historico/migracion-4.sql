-- =====================================================================
-- MIGRACIÓN 4: objetivos por empleado + KPIs
-- Pegar todo en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  weight int not null default 0 check (weight between 0 and 100),
  kpi_name text not null default '',
  kpi_unit text not null default '',
  kpi_target numeric,          -- meta del KPI
  kpi_current numeric not null default 0,  -- valor actual
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.objectives enable row level security;

create policy "ver objetivos propios o ser jefe" on public.objectives
  for select to authenticated using (owner = auth.uid() or public.is_jefe());
create policy "crear objetivos propios o ser jefe" on public.objectives
  for insert to authenticated with check (owner = auth.uid() or public.is_jefe());
create policy "editar objetivos propios o ser jefe" on public.objectives
  for update to authenticated using (owner = auth.uid() or public.is_jefe());
create policy "borrar objetivos propios o ser jefe" on public.objectives
  for delete to authenticated using (owner = auth.uid() or public.is_jefe());

alter publication supabase_realtime add table public.objectives;
