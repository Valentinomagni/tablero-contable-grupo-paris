-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 44
--  Las funciones de dependencias dejan de ser llamables sin loguearse.
--  Correr en Supabase -> SQL Editor. No toca ningún dato.
-- ============================================================================
--
--  QUÉ PASA
--
--  `deps_info` y `reverse_deps` son de la versión 1 y devuelven, para una lista de ids de
--  tarea, el TÍTULO de cada una y el NOMBRE de quien la tiene:
--
--      returns table(id uuid, title text, status text, owner_name text)
--      language sql security definer ...
--
--  `security definer` significa que **saltean la RLS por completo**: no importa de quién sea la
--  tarea ni qué permisos tenga quien pregunta.
--
--  Y hasta esta migración eran llamables por `anon`, o sea **sin haber iniciado sesión**.
--
--  DOS PROBLEMAS DISTINTOS, Y ESTA MIGRACIÓN CIERRA UNO
--
--  El primero es el que se cierra acá: nadie sin sesión tiene por qué poder llamarlas. Es
--  inequívoco y no cambia nada del funcionamiento, porque la app las usa siempre logueada.
--
--  El segundo queda abierto a propósito, y conviene que esté escrito: **un empleado con sesión
--  puede pedir cualquier id de tarea y obtener su título y su responsable**, aunque sea de otro
--  equipo. La RLS de `cards` no interviene.
--
--  No se arregla acá porque el arreglo —pasarlas a `security invoker`, para que la RLS sí
--  intervenga— **cambia lo que ve la gente**: si una tarea depende de otra que no podés ver,
--  hoy leés "Espera: DDJJ IVA (Juan)" y pasarías a no leer nada. Puede ser lo correcto, pero es
--  una decisión de producto y no un arreglo mecánico.
--
--  Para acotar el alcance real: hay que CONOCER el uuid de la tarjeta. No se pueden listar. O
--  sea que no sirve para barrer la base, sirve para mirar una tarea puntual cuyo id se vio en
--  algún lado. Es un problema real y es más chico de lo que parece a primera vista.
-- ============================================================================

-- ------------------------------------------------------------
-- La forma correcta son dos pasos, y el primero es el que suele faltar.
--
-- En PostgreSQL toda función se crea con EXECUTE otorgado a `PUBLIC`, y todos los roles heredan
-- de ahí. Revocarle a `anon` sin revocarle a `PUBLIC` no le saca absolutamente nada — eso fue
-- lo que pasó con `archivar_mes` en la migración 26, donde la línea estaba escrita y no
-- protegía nada.
--
-- Por eso: primero se le saca a `PUBLIC`, después se le da a quien tiene que tenerlo.
-- ------------------------------------------------------------

revoke execute on function public.deps_info(uuid[]) from public, anon;
grant  execute on function public.deps_info(uuid[]) to authenticated;

revoke execute on function public.reverse_deps(uuid[]) from public, anon;
grant  execute on function public.reverse_deps(uuid[]) to authenticated;


-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) Los permisos:
--
--       select p.proname,
--              has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
--              has_function_privilege('authenticated', p.oid, 'EXECUTE') as autenticado
--         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname in ('deps_info','reverse_deps');
--
--     Esperado: anon = false, autenticado = true, en las dos.
--
--  2) Y en la app: abrí una tarea que dependa de otra. El cartel de "Espera a que termine…"
--     tiene que seguir mostrando el título de la tarea que bloquea. Si dejó de aparecer, algo
--     salió mal con el `grant` a `authenticated`.

insert into public.schema_migrations (id, nombre)
  values (44, 'migracion-44-deps-sin-anon.sql')
  on conflict (id) do nothing;
