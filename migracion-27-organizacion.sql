-- ============================================================
-- Migración 27 — Estructura organizacional (spec 26)
-- Correr COMPLETO en Supabase → SQL Editor. Idempotente.
-- 1) Sucursal en personas y tareas (texto libre, validado por la app
--    contra la lista configurable de settings).
-- 2) Listas configurables de marcas y sucursales en settings
--    (key 'organizacion') → agregar marcas/sucursales SIN tocar código.
-- 3) Poder ELIMINAR avisos (hoy solo se archivan): DELETE para autor o jefe.
-- ============================================================

alter table public.profiles add column if not exists sucursal text;
alter table public.cards    add column if not exists sucursal text;
-- Marca dinámica (consumida por Task 4) — validada contra settings.organizacion.marcas
alter table public.cards add column if not exists marca text;

insert into public.settings (key, value)
select 'organizacion', jsonb_build_object(
  'marcas',     jsonb_build_array('General','Peugeot','Citroën','Chevrolet','Honda','Postventa'),
  'sucursales', jsonb_build_array('San Luis Capital','Villa Mercedes','Merlo','San Juan')
)
where not exists (select 1 from public.settings where key='organizacion');

-- DELETE de avisos: el autor o un jefe (misma regla que puedeEditarAnuncio en el front)
drop policy if exists "announcements_delete" on public.announcements;
create policy "announcements_delete" on public.announcements
  for delete using ( owner_id = auth.uid() or public.es_jefe() );

-- ------------------------------------------------------------
-- Autoregistro (por si esta migración se corre antes que la 28,
-- que es la que crea schema_migrations formalmente — misma
-- definición exacta, idempotente).
-- ------------------------------------------------------------
create table if not exists public.schema_migrations (
  id int primary key,
  nombre text not null,
  applied_at timestamptz not null default now()
);
insert into public.schema_migrations (id, nombre) values (27, 'migracion-27-organizacion.sql')
on conflict (id) do nothing;
