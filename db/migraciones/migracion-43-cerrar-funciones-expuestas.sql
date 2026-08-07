-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 43
--  Cerrar funciones que se pueden llamar desde internet sin estar logueado.
--  Correr en Supabase -> SQL Editor.
-- ============================================================================
--
--  DE DÓNDE SALIÓ ESTO
--
--  De los Advisors de Supabase: 33 advertencias que **no se pueden ver desde el repositorio**,
--  porque describen el estado de los permisos en la base viva. Es la primera vez que se miran, y
--  encontraron dos cosas que ninguna de las nueve revisiones anteriores podía encontrar.
--
--  LO MÁS GRAVE: `reset_recurring()`
--
--  Es una función de la versión 1 (`db/historico/migracion-2.sql`) que quedó viva en la base.
--  Es `security definer`, así que se ejecuta con permisos totales y la RLS no la frena. Y NO
--  TIENE NINGÚN REVOKE. Lo que hace:
--
--      update cards set status = 'pend', done_at = null,
--                       checklist destildado entero,
--                       due_date = due_date + 1 mes
--       where recurring;
--
--  O sea: **cualquiera, desde internet, sin loguearse, con un solo pedido HTTP a
--  /rest/v1/rpc/reset_recurring, resetea todas las tareas recurrentes de la empresa.** Pone
--  todo en Pendiente, borra las fechas de terminado, destilda todos los checklists y corre los
--  vencimientos un mes. Sin dejar rastro de quién fue.
--
--  No la usa nadie: el reinicio de hoy es `reset_recurrentes_seguro()`, y `reset_recurring` no
--  aparece en una sola línea del código de la app. Es un resto que quedó.
--
--  LO SEGUNDO, Y ES UNA LECCIÓN DE POSTGRES QUE VALE ANOTAR
--
--  `archivar_mes` SÍ tenía su revoke, escrito en la migración 26:
--
--      revoke execute on function public.archivar_mes(text) from anon;
--
--  Y el advisor la sigue marcando como ejecutable por `anon`. El motivo: **en PostgreSQL toda
--  función se crea con EXECUTE otorgado a `PUBLIC`**, y `anon` hereda de `PUBLIC`. Revocarle a
--  `anon` no le saca nada mientras `PUBLIC` lo tenga.
--
--  Las otras ocho líneas de revoke del proyecto dicen `from public, anon, authenticated`. Ésta
--  decía sólo `from anon`. **Parecía una protección y no protegía nada** — y desde el repositorio
--  la línea se ve perfectamente correcta. Sólo el advisor, mirando la base real, lo podía ver.
--
--  Es el mismo patrón que este proyecto viene encontrando una y otra vez: un mecanismo que
--  aparenta cuidar algo y no puede.
-- ============================================================================


-- ============================================================================
--  1) Borrar `reset_recurring()`: no la usa nadie y es destructiva
-- ============================================================================
--
--  Se borra en vez de revocarle permisos. Una función destructiva que no usa nadie no necesita
--  estar más segura: necesita no existir. Si algún día hace falta reiniciar a mano, está
--  `reset_mes_manual(text)`, que valida el formato del mes, exige ser jefe y deja registro.

drop function if exists public.reset_recurring();


-- ============================================================================
--  2) Las funciones de trigger no se llaman por HTTP nunca
-- ============================================================================
--
--  Estas cinco existen para que las dispare un trigger, no para que alguien las invoque. Que
--  estén expuestas como endpoint no tiene ningún uso legítimo.
--
--  Revocarles EXECUTE **no rompe los triggers**: el trigger las ejecuta por su cuenta, con el
--  contexto de la tabla, sin pasar por el permiso del usuario. Es seguro.
--
--  La más incómoda de la lista es `profiles_bloquear_campos_sensibles()`, que es justamente el
--  trigger que impide que alguien se auto-promueva. Estaba publicada como endpoint.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_compartidas() from public, anon, authenticated;
revoke execute on function public.profiles_bloquear_campos_sensibles() from public, anon, authenticated;
revoke execute on function public.cierre_periodos_forzar_cerrado_at() from public, anon, authenticated;


-- ============================================================================
--  3) Las funciones de cron tampoco
-- ============================================================================
--
--  `take_snapshot()` escribe las fotos diarias que alimentan el Reporte. La corre el cron.
--  Expuesta, cualquiera puede fabricar fotos de un día — que es meterle datos falsos a las
--  métricas sin tocar ninguna tarea.

revoke execute on function public.take_snapshot() from public, anon, authenticated;


-- ============================================================================
--  4) `archivar_mes`: arreglar el revoke que no revocaba
-- ============================================================================
--
--  La forma correcta son dos pasos: sacarle el permiso a `PUBLIC` (que es de donde lo heredan
--  todos) y después dárselo explícitamente a quien tiene que tenerlo. La app la llama desde
--  Administración con sesión iniciada, así que `authenticated` la necesita.

revoke execute on function public.archivar_mes(text) from public, anon, authenticated;
grant  execute on function public.archivar_mes(text) to authenticated;


-- ============================================================================
--  5) `buscar_cards`: fijarle el search_path
-- ============================================================================
--
--  Es `security invoker` a propósito —para que la RLS se evalúe con el rol de quien busca— así
--  que el riesgo de secuestro de search_path es mucho menor que en una `security definer`. Pero
--  fijarlo no cuesta nada y saca la advertencia, que es lo que permite que la lista de advisors
--  vuelva a ser mirable.
--
--  `alter function ... set search_path` no toca el cuerpo: no hay riesgo de romper la búsqueda.

alter function public.buscar_cards(text) set search_path = public;


-- ============================================================================
--  LO QUE SE DEJA COMO ESTÁ, Y POR QUÉ
-- ============================================================================
--
--  El advisor va a seguir marcando estas. No es un descuido: es una decisión, y conviene que
--  esté escrita para que nadie la "arregle" y rompa algo.
--
--  `email_por_usuario(text)` — TIENE que ser llamable por `anon`. Es lo que permite entrar
--    escribiendo el nombre de usuario en vez del mail: la app la consulta ANTES de haber
--    iniciado sesión. Sacarla rompe el login de todo el equipo. El costo conocido —que permite
--    enumerar los mails del equipo sin estar logueado— ya está documentado en
--    `docs/SEGURIDAD.md` §3.4 con el rediseño pensado.
--
--  `es_jefe()`, `is_jefe()`, `es_encargado_de(uuid)`, `es_admin_sistema()` — las usan las
--    policies de RLS. Llamarlas directamente no filtra nada: devuelven un booleano sobre QUIEN
--    LLAMA. Un anónimo obtiene `false` siempre, porque `auth.uid()` es nulo. Y tocarles los
--    permisos tiene un riesgo real que no se puede verificar desde acá: si la evaluación de una
--    policy necesita el EXECUTE del usuario, revocarlo rompe todas las consultas de esa tabla.
--    **Ante la duda, no se toca.**
--
--  `deps_info(uuid[])` y `reverse_deps(uuid[])` — las llama la app con sesión. Quedan pendientes
--    de una revisión aparte: son `security definer`, así que **saltean la RLS**, y habría que
--    confirmar que no devuelven información de tareas que quien pregunta no puede ver. No se
--    tocan en esta migración porque cambiarlas sin entenderlas rompería el grafo de dependencias
--    del tablero.
--
--  La extensión `unaccent` en el schema `public` — moverla es lo que recomienda Supabase, pero
--    `buscar_cards` la usa y mover una extensión con una función dependiente puede dejar la
--    búsqueda rota. Beneficio bajo, riesgo real: se deja, anotado.


-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) `reset_recurring` tiene que haber desaparecido:
--
--       select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and proname = 'reset_recurring';
--       -- 0 filas
--
--  2) Quién puede ejecutar qué, después de esto:
--
--       select p.proname,
--              has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
--              has_function_privilege('authenticated', p.oid, 'EXECUTE') as autenticado
--         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public'
--          and p.proname in ('archivar_mes','take_snapshot','handle_new_user',
--                            'sync_compartidas','profiles_bloquear_campos_sensibles',
--                            'cierre_periodos_forzar_cerrado_at','email_por_usuario')
--        order by 1;
--
--     Esperado: `archivar_mes` -> anon false, autenticado true.
--               Las cinco de trigger y cron -> las dos en false.
--               `email_por_usuario` -> las dos en true (a propósito).
--
--  3) Y en la app, que estas tres cosas sigan andando: entrar con nombre de usuario, buscar una
--     tarea con Ctrl+K, y archivar un mes desde Administración.
--
--  4) Volver a correr los Advisors. De 33 advertencias tienen que bajar a unas 14, y las que
--     queden son las que este archivo declara como decisión.

insert into public.schema_migrations (id, nombre)
  values (43, 'migracion-43-cerrar-funciones-expuestas.sql')
  on conflict (id) do nothing;
