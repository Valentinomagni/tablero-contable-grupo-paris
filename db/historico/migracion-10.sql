-- =====================================================================
-- MIGRACIÓN 10: vencimientos visibles en la pantalla de ingreso (sin login)
-- Pegar todo en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================
-- Solo expone los VENCIMIENTOS (título, fecha, detalle) a visitantes sin
-- sesión. Avisos y procesos siguen requiriendo login.

create policy "vencimientos publicos en portada" on public.announcements
  for select to anon using (kind = 'vencimiento');

select 'ok' as resultado;
