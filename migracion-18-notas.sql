-- Migración 18 — Anotaciones personales
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notes enable row level security;
create policy "notas solo del dueño" on public.notes for all
  using (owner = auth.uid()) with check (owner = auth.uid());
