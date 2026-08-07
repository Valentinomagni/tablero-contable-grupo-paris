-- ============================================================
-- MIGRACIÓN 22 — Gestión de tareas (spec 21 / plan 22)
-- Items: 3 (encargado ve cards), 7 (protección), 8 (reset_policy),
--        9 (archivo mensual), 11 (categoría), 1 (editar avisos).
--
-- REGLA DURA: ninguna policy consulta public.profiles directamente
-- (recursión 42P17). Se usan SIEMPRE los helpers SECURITY DEFINER
-- public.es_jefe() y public.es_encargado_de(uuid) creados en la
-- migración 14-FIX.
--
-- CORRER ESTE ARCHIVO COMPLETO EN: Supabase → SQL Editor → Run
-- ============================================================

-- ------------------------------------------------------------
-- (3) El encargado VE las cards de su equipo.
-- Bug: la policy UPDATE existía (migración 14) pero faltaba la de
-- SELECT → el encargado abría el tablero de un empleado y lo veía
-- VACÍO. Con esta policy: cada uno ve lo suyo, el jefe ve todo y
-- el encargado ve las de sus reportes directos.
-- ------------------------------------------------------------
drop policy if exists "encargado ve cards de su equipo" on public.cards;
create policy "encargado ve cards de su equipo" on public.cards for select
  using (
    owner = auth.uid()
    or public.es_jefe()
    or public.es_encargado_de(owner)
  );

-- ------------------------------------------------------------
-- (7) Tareas PROTEGIDAS: solo el jefe puede modificarlas/borrarlas.
-- Se usan policies RESTRICTIVE: se AND-ean con las permisivas
-- existentes, así la restricción aplica sin importar cuántas
-- policies OR permisivas haya. Las edge functions usan la service
-- key, que BYPASSEA RLS, así que no se ven afectadas.
-- ------------------------------------------------------------
alter table public.cards add column if not exists protected boolean not null default false;

drop policy if exists "protegidas solo jefe (update)" on public.cards;
create policy "protegidas solo jefe (update)" on public.cards
  as restrictive for update
  using (not protected or public.es_jefe());

drop policy if exists "protegidas solo jefe (delete)" on public.cards;
create policy "protegidas solo jefe (delete)" on public.cards
  as restrictive for delete
  using (not protected or public.es_jefe());

-- ------------------------------------------------------------
-- (8) Ciclo de vida de recurrentes: 'mensual' (reinicia cada mes,
-- comportamiento histórico), 'mantener' (no se toca) o 'manual'
-- (reinicio a mano). Las recurrentes existentes quedan en 'mensual'.
-- ------------------------------------------------------------
alter table public.cards add column if not exists reset_policy text not null default 'mensual';

-- ------------------------------------------------------------
-- (11) Categoría libre de la tarea (las opciones válidas viven en
-- settings.categorias del jsonb de configuración — sin tabla nueva).
-- ------------------------------------------------------------
alter table public.cards add column if not exists categoria text;

-- ------------------------------------------------------------
-- (9) ARCHIVO MENSUAL: snapshot jsonb de cada card por mes.
-- Nada histórico se pisa jamás; el historial se consulta desde acá.
-- ------------------------------------------------------------
create table if not exists public.cards_archive (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null,
  mes         text not null,               -- 'YYYY-MM'
  card        jsonb not null,              -- snapshot completo de la card
  archived_at timestamptz default now()
);

-- Idempotencia: re-ejecutar archivar_mes para el mismo mes NO duplica
-- (unique por mes + id de la card dentro del snapshot).
create unique index if not exists cards_archive_mes_card_uidx
  on public.cards_archive (mes, ((card->>'id')));

alter table public.cards_archive enable row level security;

-- SELECT: el dueño, su encargado o el jefe (helpers, nunca subquery a profiles).
drop policy if exists "ver archivo propio, de mi equipo o jefe" on public.cards_archive;
create policy "ver archivo propio, de mi equipo o jefe" on public.cards_archive for select
  using (
    owner = auth.uid()
    or public.es_jefe()
    or public.es_encargado_de(owner)
  );

-- INSERT: solo el jefe (la vía normal es la función archivar_mes, que
-- por ser SECURITY DEFINER inserta sin pasar por esta policy).
drop policy if exists "archivar solo jefe" on public.cards_archive;
create policy "archivar solo jefe" on public.cards_archive for insert
  with check (public.es_jefe());

-- Función de archivo: snapshot de TODAS las cards no operativas del
-- mes indicado. Idempotente: borra lo ya archivado de ese mes antes
-- de insertar (más el unique index como cinturón y tiradores).
create or replace function public.archivar_mes(p_mes text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  -- solo el jefe puede archivar
  if not public.es_jefe() then
    raise exception 'Solo el jefe puede archivar el mes.';
  end if;

  -- idempotencia: re-ejecutar el mismo mes reemplaza el snapshot previo
  delete from public.cards_archive where mes = p_mes;

  insert into public.cards_archive (owner, mes, card)
  select c.owner, p_mes, to_jsonb(c)
  from public.cards c
  where c.card_type <> 'operativa';

  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.archivar_mes(text) to authenticated;

-- ------------------------------------------------------------
-- (1) Editar avisos: el dueño del aviso o el jefe pueden hacer UPDATE
-- en announcements (antes no había policy de update → nadie editaba).
-- ------------------------------------------------------------
drop policy if exists "editar aviso propio o jefe" on public.announcements;
create policy "editar aviso propio o jefe" on public.announcements for update
  using (owner_id = auth.uid() or public.es_jefe());

-- ------------------------------------------------------------
-- Verificación (deben devolver filas / true sin error):
--   select count(*) from public.cards;                 -- como encargado: ve su equipo
--   select public.archivar_mes(to_char(now(),'YYYY-MM'));
--   select count(*) from public.cards_archive;
-- ============================================================
