-- =====================================================================
-- MIGRACIÓN 8: tareas operativas (a demanda) + registro de actividad
-- Pegar todo en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- 1. Tipo de tarjeta: normal (se cierra) u operativa (continua, se registra)
alter table public.cards add column if not exists
  card_type text not null default 'normal' check (card_type in ('normal','operativa'));

-- 2. Registro de actividad de las operativas:
--    "pagué 3 informes", "revisé 5 trámites" → un evento por registro
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  owner uuid not null references public.profiles(id) on delete cascade,
  who_name text not null default '',
  qty int not null default 1 check (qty between 1 and 999),
  note text not null default '',
  at timestamptz not null default now()
);
create index activity_log_card_idx on public.activity_log (card_id, at desc);
create index activity_log_owner_idx on public.activity_log (owner, at desc);

alter table public.activity_log enable row level security;
create policy "ver actividad propia o ser jefe" on public.activity_log
  for select to authenticated using (owner = auth.uid() or public.is_jefe());
create policy "registrar actividad propia o ser jefe" on public.activity_log
  for insert to authenticated with check (
    (owner = auth.uid() or public.is_jefe())
    and exists (select 1 from cards c where c.id = card_id
                and (c.owner = auth.uid() or public.is_jefe()))
  );
create policy "borrar registros solo jefes" on public.activity_log
  for delete to authenticated using (public.is_jefe());

-- 3. Confirmación
select 'ok' as resultado;
