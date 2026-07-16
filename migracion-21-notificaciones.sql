-- Migración 21 — Notificaciones (spec #8)
-- Tabla de notificaciones por destinatario, escrita por la app en eventos clave
-- (delegación, finalización con impacto). RLS: cada uno lee/actualiza las propias;
-- el INSERT permite notificar a otros (delegar, finalizar) además de a uno mismo.
-- NO aplicada aún: el hook useNotifications es defensivo hasta que se aplique.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade, -- destinatario
  tipo text not null,            -- 'asignacion' | 'delegacion' | 'vencida' | 'dep_liberada' | 'avance' | 'sin_asignar' | 'sistema'
  titulo text not null,
  detalle text not null default '',
  card_id uuid,                  -- opcional, para abrir la tarea
  leida boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "notif propias" on public.notifications for all
  using (owner = auth.uid()) with check (owner = auth.uid() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('jefe','encargado')));
create index if not exists idx_notif_owner on public.notifications(owner, created_at desc);
