-- =====================================================================
-- MIGRACIÓN 12: pendientes menores de la revisión de código
-- Pegar todo en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- Si la fila de configuración se borrara por accidente, los jefes pueden recrearla
create policy "jefes crean config" on public.settings
  for insert to authenticated with check (public.is_jefe());

select 'ok' as resultado;
