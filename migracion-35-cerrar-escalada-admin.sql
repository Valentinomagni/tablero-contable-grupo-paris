-- ============================================================
-- MIGRACIÓN 35 — Cerrar una escalada de privilegios en `profiles.admin_sistema`
--
-- ESTO ES UN ARREGLO DE SEGURIDAD. Conviene correrlo antes que cualquier otra cosa
-- pendiente, y no hace falta nada más: son 20 líneas y no toca ningún dato.
--
-- ------------------------------------------------------------
-- QUÉ ESTABA MAL
-- ------------------------------------------------------------
-- La policy de UPDATE sobre `profiles` es amplia a propósito:
--
--     using (id = auth.uid() or public.es_jefe())
--
-- Cada persona puede editar su propia fila (su nombre, su puesto). La restricción de qué
-- columnas puede tocar NO la hace la policy: la hace el trigger
-- `profiles_bloquear_campos_sensibles` de la migración 29, que corta si alguien que no es
-- jefe intenta cambiar `role`, `manager_id`, `oculto`, `username`, `email`, `marca` o
-- `sucursal`.
--
-- La migración 33 agregó la columna `admin_sistema` y **no actualizó ese trigger**. Como la
-- columna no estaba en la lista, el camino quedaba abierto:
--
--     update profiles set admin_sistema = true where id = auth.uid();
--
-- Pasa la policy (es su propia fila) y pasa el trigger (la columna no está en la lista).
-- Cualquier persona autenticada podía hacerse administradora del sistema.
--
-- ------------------------------------------------------------
-- POR QUÉ IMPORTA TANTO
-- ------------------------------------------------------------
-- `es_admin_sistema()` es lo ÚNICO que gatea `consultas_select` y `consultas_update`. Las
-- consultas son el canal donde el equipo reporta problemas, dudas y errores — y el diseño
-- decidió expresamente que el JEFE no las vea, para que reportar no se sienta arriesgado.
--
-- Con el agujero abierto, cualquier empleado podía volverse el destinatario de todas esas
-- consultas, leerlas, responderlas y archivarlas. Es el dato más sensible del sistema, y el
-- único mecanismo que lo protegía tenía un hueco de exactamente una columna.
--
-- ------------------------------------------------------------
-- LA LECCIÓN, para que no vuelva a pasar
-- ------------------------------------------------------------
-- Toda columna nueva de `profiles` que otorgue permisos o cambie visibilidad tiene que
-- agregarse a este trigger EN LA MISMA MIGRACIÓN que la crea. El trigger es una lista
-- explícita, así que una columna nueva queda desprotegida por omisión, en silencio y sin que
-- ningún test lo note. Es un default peligroso: lo seguro sería lo contrario.
--
-- Idempotente: se puede correr las veces que sea.
-- ============================================================

create or replace function public.profiles_bloquear_campos_sensibles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.es_jefe() then
    -- marca y sucursal alimentan la segmentación y el reporte ejecutivo: si cada uno
    -- pudiera reescribir las suyas, podría sacarse de su segmento o entrar a otro.
    -- admin_sistema da acceso al canal de consultas del equipo: nadie se lo puede dar solo.
    if new.role is distinct from old.role
       or new.manager_id is distinct from old.manager_id
       or new.oculto is distinct from old.oculto
       or new.username is distinct from old.username
       or new.email is distinct from old.email
       or new.marca is distinct from old.marca
       or new.sucursal is distinct from old.sucursal
       or new.admin_sistema is distinct from old.admin_sistema then
      raise exception 'Solo un jefe puede cambiar role, manager_id, oculto, username, email, marca, sucursal o admin_sistema de un perfil';
    end if;
  end if;
  return new;
end;
$$;

-- El trigger en sí no cambia, pero se recrea para que quede explícito que quedó apuntando a
-- la versión nueva de la función (y para que este archivo sirva solo, sin depender de la 29).
drop trigger if exists profiles_bloquear_campos_sensibles on public.profiles;
create trigger profiles_bloquear_campos_sensibles
  before update on public.profiles
  for each row
  execute function public.profiles_bloquear_campos_sensibles();

-- ------------------------------------------------------------
-- VERIFICACIÓN (opcional, para correr a mano y ver que quedó bien)
-- ------------------------------------------------------------
-- Como jefe, esto tiene que seguir funcionando:
--   update public.profiles set admin_sistema = true where email = 'la-cuenta-de-admin@...';
--
-- Como empleado, esto ahora tiene que FALLAR con el mensaje de arriba:
--   update public.profiles set admin_sistema = true where id = auth.uid();
--
-- Y para ver quién es admin del sistema hoy (deberían ser sólo las cuentas que pusiste vos):
--   select name, email, admin_sistema from public.profiles where admin_sistema = true;
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Registro en schema_migrations
--
-- Faltaba. Sin esto el chip de Administración no se entera de que esta migración se corrió, y
-- la da por faltante para siempre. Es idempotente: se puede correr de nuevo sin efecto.
-- ------------------------------------------------------------

insert into public.schema_migrations (id, nombre)
  values (35, 'migracion-35-cerrar-escalada-admin.sql')
  on conflict (id) do nothing;
