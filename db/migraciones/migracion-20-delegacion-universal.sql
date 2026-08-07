-- Migración 20 — Delegación universal con trazabilidad (spec #4)
-- Permite que CUALQUIER usuario (no solo jefes) inserte una card cuyo owner es otra
-- persona, siempre que la tarjeta registre en su history la marca de tarea
-- compartida/delegada (quién delegó y cuándo — `filasCompartida` en src/lib/shared.ts
-- estampa `compartida:<uuid>` + "delegada por X · con nombres" con timestamp ISO).
-- Aplicar junto con migracion-13 (trigger de sync de tarjetas espejo).

drop policy if exists "delegar tarea a otro" on public.cards;
create policy "delegar tarea a otro" on public.cards for insert with check (
  owner = auth.uid()  -- tarea propia (comportamiento actual)
  or exists (         -- o es una tarea compartida/delegada: debe registrar quién delegó en el historial
    select 1 from jsonb_array_elements(coalesce(history, '[]'::jsonb)) e
    where e->>'txt' like 'compartida:%' or e->>'txt' like 'Tarea compartida — delegada por %'
  )
);
