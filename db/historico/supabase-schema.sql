-- =====================================================================
-- TABLERO CONTABLE — Esquema de base de datos para Supabase
-- Pegar todo este archivo en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- 1. Perfiles: uno por usuario, con nombre y jerarquía
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'empleado' check (role in ('jefe','encargado','empleado')),
  created_at timestamptz not null default now()
);

-- Al crear un usuario en Authentication, se crea su perfil automáticamente
-- (toma nombre y rol del campo "User Metadata" si se cargó, si no usa el email)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'empleado')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Función auxiliar: ¿el usuario logueado es jefe?
create or replace function public.is_jefe()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'jefe');
$$;

-- 2. Tarjetas (tareas)
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status text not null default 'pend' check (status in ('pend','proc','term')),
  description text not null default '',
  checklist jsonb not null default '[]',   -- [{txt, done, done_at}]
  comments jsonb not null default '[]',    -- [{who, when, txt}]
  done_at timestamptz,
  created_at timestamptz not null default now()
);

-- 3. Seguridad a nivel de fila (RLS):
--    jefes ven y editan todo; encargados y empleados SOLO su propio tablero
alter table public.profiles enable row level security;
alter table public.cards enable row level security;

-- Los nombres de perfil son visibles para todos los logueados
-- (los jefes necesitan la lista del equipo para las pestañas)
create policy "perfiles visibles para autenticados" on public.profiles
  for select to authenticated using (true);

create policy "ver tarjetas propias o ser jefe" on public.cards
  for select to authenticated using (owner = auth.uid() or public.is_jefe());

create policy "crear tarjetas propias o ser jefe" on public.cards
  for insert to authenticated with check (owner = auth.uid() or public.is_jefe());

create policy "editar tarjetas propias o ser jefe" on public.cards
  for update to authenticated using (owner = auth.uid() or public.is_jefe());

create policy "borrar tarjetas propias o ser jefe" on public.cards
  for delete to authenticated using (owner = auth.uid() or public.is_jefe());

-- 4. Tiempo real: que los cambios lleguen a todos al instante
alter publication supabase_realtime add table public.cards;
