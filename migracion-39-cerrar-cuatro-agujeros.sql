-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 39
--  Cierra cuatro agujeros que encontró la auditoría del 05/08/2026.
--  Correr en Supabase -> SQL Editor. No toca ningún dato de trabajo.
-- ============================================================================
--
--  LOS CUATRO, EN UNA LÍNEA CADA UNO:
--
--    1. El jefe podía darse a sí mismo acceso al canal de consultas del equipo.
--    2. Un empleado NO podía avisarle nada a nadie, y la app no se enteraba del error.
--    3. Cualquiera podía publicar un aviso anónimo para toda la empresa.
--    4. Cualquiera podía plantar una tarea "protegida" en el tablero de otro.
--
--  El 2 es el que más se nota en el día a día: hoy hay notificaciones que no llegan.
--  El 1 es el que más importa para que la app siga sirviendo.
--
--  Ninguno requiere que hagas nada además de correr este archivo. Es idempotente.
-- ============================================================================


-- ============================================================================
--  1) El jefe no puede darse acceso al canal de consultas
-- ============================================================================
--
--  QUÉ ESTABA MAL. El trigger que protege las columnas sensibles de `profiles` empieza con
--  `if auth.uid() is not null and not es_jefe() then`, así que cuando el que edita es el jefe
--  el bloque entero de chequeos no se evalúa. Y la policy de `profiles` deja actualizar la
--  fila propia. Entonces el jefe podía hacer, desde la consola del navegador:
--
--      update profiles set admin_sistema = true where id = auth.uid();
--
--  y `admin_sistema` es lo único que gatea `consultas_select`. Con eso pasaba a leer todas
--  las consultas, sugerencias y reportes del equipo, con nombre y apellido de quién escribió.
--
--  POR QUÉ IMPORTA, aunque el jefe sea el dueño. La migración 33 le prometió al equipo que el
--  jefe no lee ese canal — es el lugar donde alguien puede decir "esto no se entiende" o
--  "esta tarea no me corresponde" sin que se lo tomen a mal. Si la promesa depende de que
--  nadie pruebe, no es un control: es una costumbre. Y el día que alguien descubra que se
--  podía, el canal se muere y con él la única fuente honesta de qué hay que mejorar.
--
--  EL ARREGLO. `admin_sistema` sale del alcance de CUALQUIER sesión de la aplicación, jefe
--  incluido. Se sigue pudiendo designar la cuenta de administración desde este mismo SQL
--  Editor, que corre como `postgres` y ahí `auth.uid()` es nulo:
--
--      update public.profiles set admin_sistema = true where email = 'la-cuenta@...';
--
--  VERIFICADO ANTES DE ESCRIBIR ESTO: la aplicación nunca escribe `admin_sistema`, sólo lo
--  lee (`src/App.tsx`, `src/features/admin/Admin.tsx`). Este cambio no rompe ninguna pantalla.

create or replace function public.profiles_bloquear_campos_sensibles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Fuera del `if` del jefe, a propósito: esta columna no la cambia nadie desde la app.
  -- `auth.uid() is not null` deja pasar a la consola de la base, que es el único lugar
  -- autorizado a designar la cuenta de administración.
  if auth.uid() is not null and new.admin_sistema is distinct from old.admin_sistema then
    raise exception 'admin_sistema solo se cambia desde la consola de la base, no desde la aplicación';
  end if;

  if auth.uid() is not null and not public.es_jefe() then
    -- marca y sucursal alimentan la segmentación y el reporte ejecutivo: si cada uno
    -- pudiera reescribir las suyas, podría sacarse de su segmento o entrar a otro.
    if new.role is distinct from old.role
       or new.manager_id is distinct from old.manager_id
       or new.oculto is distinct from old.oculto
       or new.username is distinct from old.username
       or new.email is distinct from old.email
       or new.marca is distinct from old.marca
       or new.sucursal is distinct from old.sucursal then
      raise exception 'Solo un jefe puede cambiar role, manager_id, oculto, username, email, marca o sucursal de un perfil';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_bloquear_campos_sensibles on public.profiles;
create trigger profiles_bloquear_campos_sensibles
  before update on public.profiles
  for each row execute function public.profiles_bloquear_campos_sensibles();


-- ============================================================================
--  2) Un empleado puede volver a avisarle a sus compañeros
-- ============================================================================
--
--  QUÉ ESTABA MAL. Es la misma clase de falla que motivó la migración 36 —`using` y
--  `with check` que no dicen lo mismo— y quedó viva acá. La policy era:
--
--      for all using (owner = auth.uid())
--            with check (owner = auth.uid() or <el que escribe es jefe o encargado>)
--
--  O sea: para insertarle una notificación a OTRA persona hay que ser jefe o encargado. Un
--  empleado, que es la mayoría del equipo, no podía.
--
--  QUÉ SE ROMPÍA, EN CONCRETO. Ana (empleada) delega una tarea a Beto. La tarjeta se crea
--  bien —eso lo permite la migración 20— y aparece en el tablero de Beto. La notificación
--  "te delegaron una tarea" la rechaza la base. Beto nunca se entera.
--
--  Y NADIE VEÍA EL ERROR. Los cinco lugares que insertan notificaciones lo envuelven en un
--  `try/catch` que ignora la falla, pero es peor que eso: `supabase-js` no lanza excepción
--  cuando la base rechaza, devuelve `{ error }` — así que el `catch` ni siquiera se ejecuta.
--  El error se descarta solo. Por eso pudo estar roto sin que nadie lo reportara nunca.
--
--  EL ARREGLO. Se parte la policy `for all` en cuatro, una por operación, que es lo que
--  permite que insertar tenga una regla distinta de leer:
--
--    - LEER: sólo las propias. Esto no se toca; es lo que hace que nadie vea las de otro.
--    - CREAR: cualquiera con sesión. El contenido de una notificación no es información
--      sensible ("te delegaron X", "te mencionaron en Y"), y quien la manda ya podía
--      delegarte una tarea o escribirte en el tablón. Acotarla más deja afuera justamente
--      el caso que hoy está roto.
--    - MARCAR LEÍDA / BORRAR: sólo las propias, con `using` y `with check` iguales — para
--      que nadie pueda reasignarle una notificación suya a otro con un update.

drop policy if exists "notif propias" on public.notifications;
drop policy if exists "notif leer propias" on public.notifications;
drop policy if exists "notif crear" on public.notifications;
drop policy if exists "notif marcar leida" on public.notifications;
drop policy if exists "notif borrar propias" on public.notifications;

create policy "notif leer propias" on public.notifications
  for select using (owner = auth.uid());

create policy "notif crear" on public.notifications
  for insert with check (auth.uid() is not null);

create policy "notif marcar leida" on public.notifications
  for update using (owner = auth.uid()) with check (owner = auth.uid());

create policy "notif borrar propias" on public.notifications
  for delete using (owner = auth.uid());


-- ============================================================================
--  3) Los avisos para toda la empresa los publica el jefe
-- ============================================================================
--
--  QUÉ ESTABA MAL. La policy de creación de avisos aceptaba `owner_id is null`, y la de
--  lectura termina con `or owner_id is null`. Las dos juntas hacen que una fila sin dueño la
--  vea TODO el mundo, sin pasar por la lista de destinatarios.
--
--  EL ESCENARIO QUE IMPORTA. Un empleado, desde la consola del navegador, publica un aviso
--  urgente firmado "Sistema" —`created_by` es texto libre que manda el cliente— avisando un
--  cambio de cuenta bancaria para transferencias. Le aparece a todo el equipo contable de las
--  concesionarias. Contra un equipo que maneja pagos, un aviso interno falso es exactamente
--  el vector que importa. Encima, después no lo puede borrar ni el que lo publicó: la policy
--  de borrado pide `owner_id = auth.uid()`, y `null = auth.uid()` no es verdadero. Sólo el
--  jefe lo podía limpiar.
--
--  EL ARREGLO. Sin dueño sólo puede publicar el jefe. Las filas viejas sin dueño siguen
--  visibles como hasta ahora: esto cambia quién puede CREARLAS, no quién las ve.
--
--  VERIFICADO: la aplicación siempre manda `owner_id: me.id` al publicar (`Tablon.tsx`).
--  Ninguna pantalla usa el camino sin dueño, así que esto no rompe nada de lo que se usa.

drop policy if exists "crear evento propio" on public.announcements;
create policy "crear evento propio" on public.announcements
  for insert with check (owner_id = auth.uid() or (owner_id is null and public.es_jefe()));


-- ============================================================================
--  4) Nadie planta una tarea protegida en el tablero de otro
-- ============================================================================
--
--  QUÉ ESTABA MAL. La migración 22 puso dos policies restrictivas para que sólo el jefe
--  pueda modificar o borrar una tarea protegida — pero ninguna para CREARLA. Y la migración
--  20 permite crear una tarjeta a nombre de cualquiera con tal de que el historial diga que
--  fue compartida, y ese historial lo arma el cliente.
--
--  EL ESCENARIO. Alguien crea tarjetas con `protected: true` en el tablero de un compañero.
--  El compañero no las puede editar ni borrar —las dos restrictivas de la 22 lo cortan— y le
--  quedan ahí ocupando el tablero hasta que el jefe las limpie una por una.
--
--  EL ARREGLO. La tercera restrictiva, simétrica a las dos que ya existían.
--
--  VERIFICADO: la aplicación nunca crea una tarjeta con `protected` puesto; sólo lo activa
--  después, con un update (`CardModal.tsx`). Esto no rompe ningún flujo.

drop policy if exists "protegidas solo jefe (insert)" on public.cards;
create policy "protegidas solo jefe (insert)" on public.cards
  as restrictive for insert with check (not protected or public.es_jefe());


-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) Como jefe, esto ahora tiene que FALLAR con el mensaje de arriba:
--       update public.profiles set admin_sistema = true where id = auth.uid();
--
--  2) Quién es admin del sistema hoy (deberían ser sólo las cuentas que pusiste vos):
--       select name, email, admin_sistema from public.profiles where admin_sistema = true;
--
--  3) Las policies de notificaciones tienen que ser cuatro:
--       select policyname, cmd from pg_policies
--        where tablename = 'notifications' order by cmd;
--
--  4) Y en la app: pedile a alguien del equipo que delegue una tarea a un compañero.
--     Ahora al compañero le tiene que llegar la notificación. Antes no llegaba.

insert into public.schema_migrations (id, nombre)
  values (39, 'migracion-39-cerrar-cuatro-agujeros.sql')
  on conflict (id) do nothing;
