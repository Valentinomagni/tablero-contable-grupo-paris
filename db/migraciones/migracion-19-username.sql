-- Migración 19 — Username para login corporativo (spec #16)
-- Agrega profiles.username único y una RPC que mapea username -> email para el login.
-- COMPATIBILIDAD: desplegar el front ANTES de aplicar esta migración NO bloquea a nadie,
-- porque el login sigue aceptando el email (rama email). Esta migración habilita, además,
-- el login por nombre de usuario.

alter table public.profiles add column if not exists username text unique;

-- RPC que mapea username -> email (para login). SECURITY DEFINER: solo devuelve el email
-- correspondiente a un username exacto; no lista ni expone otros datos.
create or replace function public.email_por_usuario(u text) returns text
language sql security definer set search_path = public as $$
  select email from public.profiles where lower(username) = lower(u) limit 1;
$$;
grant execute on function public.email_por_usuario(text) to anon, authenticated;
