-- =====================================================================
-- MIGRACIÓN 6: panel de administración (puesto/ficha, permisos, RLS)
-- Pegar todo en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- 1. Ficha de puesto y email visible en perfiles
alter table public.profiles add column if not exists puesto text not null default '';
alter table public.profiles add column if not exists ficha  text not null default '';
alter table public.profiles add column if not exists email  text not null default '';
update public.profiles p set email = coalesce(u.email,'')
  from auth.users u where u.id = p.id and p.email = '';

-- el trigger de alta ahora también guarda el email
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role, email)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'empleado'),
    coalesce(new.email,''));
  return new;
end $$;

-- 2. Los jefes pueden editar perfiles (nombre, rol, puesto, ficha)
create policy "jefes editan perfiles" on public.profiles
  for update to authenticated using (public.is_jefe());

-- 3. Configuración de la app (permisos parametrizables)
create table public.settings (
  key text primary key,
  value jsonb not null
);
insert into public.settings values ('permissions', '{"edit_closed": false}');

alter table public.settings enable row level security;
create policy "config visible para autenticados" on public.settings
  for select to authenticated using (true);
create policy "solo jefes cambian config" on public.settings
  for update to authenticated using (public.is_jefe());

-- 4. Permiso "editar tareas cerradas": aplicado en el servidor.
--    Si está apagado, un no-jefe NO puede modificar (ni reabrir) una tarea terminada.
drop policy "editar tarjetas propias o ser jefe" on public.cards;
create policy "editar tarjetas propias o ser jefe" on public.cards
  for update to authenticated using (
    public.is_jefe()
    or (owner = auth.uid() and (
         status <> 'term'
         or coalesce((select (value->>'edit_closed')::boolean
                        from public.settings where key = 'permissions'), false)
    ))
  );

-- 5. Confirmación
select key, value from public.settings;
