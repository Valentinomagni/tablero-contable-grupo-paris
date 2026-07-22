# Pasos manuales — activar los planes 02–09 (15/07/2026)

Todo el código está commiteado localmente y **sin pushear**. Los gates están verdes
(135 tests, build, smoke) y el código es **defensivo**: aunque despliegues antes de aplicar
las migraciones, la app NO se rompe — las funciones nuevas simplemente no operan hasta que
corras el SQL. El smoke confirma que todas las vistas cargan bien sin las migraciones.

## Orden recomendado
1. **Backup** primero: entrá como jefe → Administración → "Descargar backup completo (JSON)". Guardalo.
2. **Aplicá las migraciones** (Supabase → SQL Editor → New query → pegar → Run), EN ESTE ORDEN:
   | # | Archivo (raíz del repo) | Qué habilita |
   |---|---|---|
   | 13 | `migracion-13-tareas-compartidas.sql` | Sync de tareas compartidas al completarlas (spec previa) |
   | 14 | `migracion-14-jerarquia.sql` | `manager_id` + `marca` + RLS de equipo (base de #5/#7/#9/#10) |
   | 15 | `migracion-15-calendario-permisos.sql` | Eventos por rol + destinatarios (#6) |
   | 16 | `migracion-16-recurrencia.sql` | `recur_rule` + `task_occurrences` (#4/#11/#12) |
   | 17 | `migracion-17-sin-asignar.sql` | Perfil centinela "Sin asignar" (#14) |
   | 18 | `migracion-18-notas.sql` | Tabla `notes` para Anotaciones (#19) |
   | 19 | `migracion-19-username.sql` | `username` + RPC `email_por_usuario` (#16) |
   | 20 | `migracion-20-delegacion-universal.sql` | Delegación de tareas para todos los roles (spec 20 #4) |
   | 21 | `migracion-21-notificaciones.sql` | Centro de notificaciones (campana, spec 20 #8) |
   | 27 | `migracion-27-organizacion.sql` | Sucursales dinámicas, marcas en cards, DELETE de avisos (spec 26) |
## Migración 27 — Estructura organizacional
Después de aplicar `migracion-27-organizacion.sql`:
1. Verificá que las columnas se crearon correctamente:
   ```sql
   select sucursal from public.profiles limit 1;
   select sucursal, marca from public.cards limit 1;
   ```
2. Verificá que la configuración de organizacion se cargó:
   ```sql
   select value from public.settings where key='organizacion';
   ```
   Debe devolver un JSON con las 6 marcas (General, Peugeot, Citroën, Chevrolet, Honda, Postventa) y 4 sucursales (San Luis Capital, Villa Mercedes, Merlo, San Juan).
3. Verificá que el policy de DELETE de avisos se creó:
   ```sql
   select * from pg_policies where tablename='announcements' and policyname='announcements_delete';
   ```

3. **Desplegá la Edge Function** `eliminar-usuario` (Supabase → Edge Functions → crear `eliminar-usuario` → pegar el contenido de `edge-function-eliminar-usuario.ts` → Deploy). Mismo flujo que `crear-usuario`.
4. **Push del código** (deploy a Cloudflare). Desde la carpeta del proyecto:
   `git push origin main`  (o pedime que lo pushee yo).
5. **Configurar los datos nuevos** (una vez, desde la app como jefe, en Administración → clic en cada persona):
   - **Responsable (manager)** y **Marca** de cada empleado/encargado → activa Resúmenes por rol, Organigrama y permisos del Encargado.
   - **Usuario** (username, ej. `Vmagni`) de cada persona → habilita el login por usuario. **El login por email sigue funcionando** mientras tanto (compatibilidad), así que nadie queda afuera.

## Migración 28 — Infraestructura (registro de migraciones, adjuntos y resumen semanal)
Después de aplicar `migracion-28-infraestructura.sql`:
1. Verificá el registro de migraciones (deben aparecer 13 a 25, más 28 — y 26/27 si ya las corriste):
   ```sql
   select id, nombre, applied_at from public.schema_migrations order by id;
   ```
2. Verificá que el bucket de adjuntos se creó (privado):
   ```sql
   select id, public from storage.buckets where id = 'adjuntos';
   ```
3. Verificá que nadie desde la app puede disparar el resumen semanal a mano:
   ```sql
   select has_function_privilege('anon', 'public.resumen_semanal()', 'execute'); -- debe dar 'f'
   ```
4. **(Opcional) Cron semanal del resumen**: Supabase → **Cron Jobs** (o Database → Cron) → New Cron Job:
   - Nombre: `resumen-semanal`
   - Schedule: `0 11 * * 1` (todos los lunes a las 11:00 UTC = 8:00 hora Argentina, UTC−3)
   - Comando: `select public.resumen_semanal();`

   Esto publica un aviso en el tablón cada lunes con tareas cerradas de la semana, vencidas abiertas y arqueos
   con diferencia. Es opcional: si no lo configurás, nada cambia.

## Migración 29 — Esquema de preparación para producción (spec 28 fase A)

**IMPORTANTE: Después de correr la migración 29, avisale al equipo que recargue la app (F5).** Las pestañas abiertas seguirán usando el esquema viejo hasta que refresquen, porque la consulta del estado de migraciones se cachea 5 minutos.

**0. ANTES de correr la migración 29**, auditá si hay una policy de UPDATE
sobre `profiles` creada desde el dashboard de Supabase que esta migración
no toca (las policies de RLS se combinan con OR entre sí, así que una
policy vieja amplia se sigue aplicando aunque la 29 agregue la suya):
```sql
select polname, polcmd, pg_get_expr(polqual, polrelid) as expresion
  from pg_policy where polrelid = 'public.profiles'::regclass;
```
Si aparece una policy de UPDATE que no sea la de la migración 29
(`"usuario actualiza su propio perfil"`) y su expresión es permisiva
(por ejemplo `using (true)`), borrala desde el dashboard: significa que
cualquier empleado logueado podría editar perfiles ajenos, sin que el
trigger de campos sensibles alcance a frenarlo del todo (el trigger solo
protege role/manager_id/oculto/username/email, no el resto de las columnas).

Después de aplicar `migracion-29-produccion.sql`:
1. Verificá que las columnas nuevas de `profiles` se crearon:
   ```sql
   select column_name from information_schema.columns
     where table_name = 'profiles' and column_name in ('oculto', 'last_seen');
   ```
   Debe devolver 2 filas.
2. Verificá las columnas nuevas de `cards`:
   ```sql
   select column_name from information_schema.columns
     where table_name = 'cards' and column_name in ('proc_at', 'tiempo_max_horas', 'dato_control');
   ```
   Debe devolver 3 filas.
3. Verificá que las tablas nuevas existen y tienen RLS activo:
   ```sql
   select relname, relrowsecurity from pg_class
     where relname in ('consultas', 'cierre_periodos');
   ```
   Ambas filas deben tener `relrowsecurity = true`.
4. Verificá que un usuario no-jefe no puede cambiar `role`/`manager_id`/`oculto` de su propio
   perfil (el trigger `profiles_bloquear_campos_sensibles` lo bloquea):
   ```sql
   select tgname from pg_trigger where tgrelid = 'public.profiles'::regclass and not tgisinternal;
   ```
   Debe listar `profiles_bloquear_campos_sensibles`.

## Migración 30 — Analítica: trigger, full-text y vista materializada (spec 28 fase C)

Correr `migracion-30-analitica.sql` completo en Supabase → SQL Editor. Es idempotente
(se puede correr las veces que haga falta, en cualquier orden respecto de la 26/27/28/29).

### AVISO — lock de tabla al agregar la columna generada `tsv`

La migración reescribe la tabla `cards` (lock exclusivo) al agregar la columna generada
`tsv`. Con el volumen actual es instantáneo, pero conviene correrla en un momento de baja
actividad.

### AVISO IMPORTANTE — el trigger de notificaciones nace DESACTIVADO

La migración crea el trigger `cards_notificar_finalizacion` sobre `public.cards`, que
avisa al encargado/jefe cuando alguien termina una tarea con impacto. **Hoy la app
(cliente) ya inserta esa misma notificación** al finalizar una tarea. Si el trigger
quedara activo mientras el cliente sigue insertando, **cada finalización generaría DOS
notificaciones idénticas** y el equipo recibiría todo duplicado.

Por eso el trigger se crea **desactivado**: correr la migración 30 hoy es seguro y no
cambia nada de lo que ve el usuario.

### PASO MANUAL OBLIGATORIO — activar el trigger (después de desplegar la Task 11)

El código de la Task 11 (`debeNotificarDesdeCliente` en `src/lib/notificaciones.ts`) ya
pregunta a la base, en cada carga, si el trigger está activo:

- trigger **activo** → el cliente **no** inserta la notificación (la genera la base);
- trigger **apagado** o desconocido → el cliente **sigue** insertando, como siempre.

O sea que el cliente se adapta solo. Falta un único comando del lado de la base.

**Orden obligatorio: primero desplegar el código, después correr el comando.**

1. Desplegar la Task 11 a producción y confirmar que quedó arriba (recargar el tablero).
2. **OBLIGATORIO antes de activar el trigger** — verificar que PostgREST ya expone el RPC:
   tras el `create or replace function` de la migración 30, PostgREST no lo ve hasta que
   recarga su schema cache. Si activás el trigger con el RPC en 404, el cliente sigue
   insertando por su cuenta y **cada finalización duplica el aviso, en silencio**.
   - Forzar la recarga (Supabase → SQL Editor):
     ```sql
     notify pgrst, 'reload schema';
     ```
   - Verificar **desde la app**, no desde el SQL Editor: con el tablero abierto, DevTools →
     Network debe mostrar `POST /rest/v1/rpc/trigger_notificaciones_activo` con respuesta
     `200` y cuerpo `false`. Si da `404` (`PGRST202`), **no** actives el trigger todavía —
     esperá un momento y repetí el `notify` hasta que el RPC responda `200`.
3. Recién ahí, en Supabase → SQL Editor:
   ```sql
   alter table public.cards enable trigger cards_notificar_finalizacion;
   ```
4. Verificar que quedó activo (`tgenabled` debe ser `'O'`):
   ```sql
   select tgname, tgenabled from pg_trigger
     where tgrelid = 'public.cards'::regclass
       and tgname = 'cards_notificar_finalizacion';
   ```
   Y lo mismo tal como lo ve la app (debe devolver `true`):
   ```sql
   select public.trigger_notificaciones_activo();
   ```
5. Prueba de humo: terminar una tarea con prioridad alta (o con vencimiento) cuyo dueño
   tenga manager, y confirmar que al manager le llega **una sola** notificación
   "Tarea importante terminada". Si llegan dos, hay tres causas posibles: (a) el navegador
   tiene la versión vieja del código (recargar con caché limpia), (b) el cliente cacheó el
   valor viejo del RPC (`useTriggerNotificaciones` tiene `staleTime` de 5 min: esperá o
   recargá la pestaña), o (c) el RPC sigue en 404 (repetir la verificación del paso 2). Si
   no llega ninguna, revisar el paso 4.
6. Prueba de humo — **tarea compartida** (no la saltees: es el caso que el paso 5 no cubre).
   Delegá una tarea con prioridad alta a **tres** personas que tengan manager, y que una de
   ellas la termine. Al terminar una hermana, el cliente sincroniza las otras con un update
   directo, y esos updates entran al trigger con `pg_trigger_depth() = 1` — o sea que la
   guarda de profundidad NO los frena. Debe llegar **una sola** notificación, no tres. Si
   llegan tres, la base tiene la versión vieja de `cards_notificar_finalizacion()`: volvé a
   correr `migracion-30-analitica.sql` (es idempotente y no apaga el trigger ya activado).

**ADVERTENCIA — si activás el trigger ANTES de desplegar el código**, el cliente viejo
sigue insertando su propia notificación y **cada finalización genera avisos duplicados**
hasta que el deploy salga. No se pierde nada ni se rompe nada, pero el equipo recibe todo
por duplicado mientras dure la ventana. Si pasó, o desplegá ya, o apagalo de nuevo:

```sql
alter table public.cards disable trigger cards_notificar_finalizacion;
```

Ese mismo comando es el **rollback**: si hay que revertir el deploy de la Task 11, apagá
el trigger. Ojo: esto **sí tiene una ventana de silencio**, no es instantáneo para todos —
`useTriggerNotificaciones` cachea el valor 5 minutos, así que un usuario con el tablero ya
abierto sigue sin notificar (creyendo que el trigger sigue activo) hasta que ese dato
refresque, en el peor caso hasta ~5 minutos. Recargar la pestaña lo hace inmediato.

> **Nota si ya corriste la migración 30 antes de esta task:** la función
> `public.trigger_notificaciones_activo()` se agregó junto con la Task 11, así que no
> existe en tu base todavía. Volvé a correr `migracion-30-analitica.sql` completo (es
> idempotente y **no** apaga el trigger si ya lo habías activado). Mientras la función no
> exista, el RPC falla, el cliente lo interpreta como "desconocido" y sigue notificando él
> mismo: seguro, pero el trigger no se puede activar sin duplicar hasta que la corras.

Volver a correr la migración 30 **no** apaga un trigger que ya fue activado: el script
lee el estado previo y lo restaura.

### Verificaciones

1. La migración quedó registrada:
   ```sql
   select id, nombre, applied_at from public.schema_migrations where id = 30;
   ```
2. El trigger existe y está **desactivado** (`tgenabled = 'D'`; pasa a `'O'` recién
   cuando se corre el paso manual de arriba, después de desplegar la Task 11):
   ```sql
   select tgname, tgenabled from pg_trigger
     where tgrelid = 'public.cards'::regclass and not tgisinternal;
   ```
   La función que consulta el cliente devuelve lo mismo en booleano (`false` mientras el
   trigger esté apagado, `true` una vez activado):
   ```sql
   select public.trigger_notificaciones_activo();
   ```
3. La columna full-text generada existe:
   ```sql
   select column_name, is_generated from information_schema.columns
     where table_name = 'cards' and column_name = 'tsv';
   ```
   Debe devolver 1 fila con `is_generated = 'ALWAYS'`.
4. El índice GIN existe:
   ```sql
   select indexname from pg_indexes where tablename = 'cards' and indexname = 'cards_tsv_gin';
   ```
5. La búsqueda anda y **respeta RLS** (probala logueado como empleado: solo puede
   devolver tareas suyas o de su equipo, nunca de otro):
   ```sql
   select id, title from public.buscar_cards('arqueo caja');
   ```
6. La vista materializada y su índice único existen:
   ```sql
   select count(*) from public.mv_resumen_mensual;
   select indexname from pg_indexes
     where tablename = 'mv_resumen_mensual' and indexname = 'mv_resumen_mensual_uidx';
   ```
7. Nadie lee la vista materializada directo desde la app (las matviews **no** soportan
   RLS, por eso se lee vía el RPC `public.resumen_mensual()`, que filtra por rol):
   ```sql
   select has_table_privilege('authenticated', 'public.mv_resumen_mensual', 'select'); -- debe dar 'f'
   select * from public.resumen_mensual() limit 5;
   ```

**Nota**: `unaccent` es opcional. Si en este proyecto de Supabase no se puede crear la
extensión, la migración **no falla** (el intento está envuelto en un bloque con
`exception when others then null`) y la búsqueda funciona igual, solo que sensible a
tildes.

### Cron mensual — refrescar la vista materializada

La vista se alimenta de `public.cards_archive`, que se llena al cerrar cada mes. Hay que
refrescarla una vez por mes, después del cierre:

Supabase → **Cron Jobs** (o Database → Cron) → New Cron Job:
- Nombre: `refresh-resumen-mensual`
- Schedule: `0 6 1 * *` (día 1 de cada mes a las 06:00 UTC = **03:00 hora Argentina**, UTC−3)
- Comando:
  ```sql
  refresh materialized view concurrently public.mv_resumen_mensual;
  ```

`concurrently` no bloquea las lecturas mientras refresca — funciona gracias al índice
único `mv_resumen_mensual_uidx` que crea la migración. Si el cron no se configura, la
vista queda con los datos del último `refresh` manual (la migración hace uno al aplicarse);
se puede refrescar a mano en cualquier momento con ese mismo comando.

**Qué significa para quien lee `resumen_mensual()` sin el cron activo**: no hay error ni
aviso — el RPC devuelve igual una respuesta válida, pero con los totales del último
refresh (potencialmente meses viejo). Nadie se entera de que está desactualizado salvo
comparando contra `cards_archive` a mano. Por eso el cron no es opcional en la práctica:
sin él, la vista es un dato mudo que envejece en silencio.

## Migración 31 — Etiquetas, empresas y pausas (spec 28 fase D)

Correr `migracion-31-etiquetas-empresas.sql` completo en Supabase → SQL Editor. Es
idempotente (se puede correr las veces que haga falta, en cualquier orden respecto de la
26/27/28/29/30).

**No es opcional a largo plazo: mientras no se corra, la app funciona pero más lenta.** El fetch
de cards pide las columnas explícitas (`COLUMNAS_CARDS` en `src/lib/esquema.ts`) para no arrastrar
el tsvector `tsv` de la migración 30. Sin la 31 la columna `etiquetas` no existe, ese select falla
entero con 42703/PGRST204 y `useCards` cae al fallback `select("*")`: **dos consultas por cada
refetch de cards, y hay un refetch por cada evento realtime** (cualquier movimiento de tarjeta de
cualquier usuario), trayendo además el tsvector completo que la app nunca lee. O sea: correr la 31
no sólo habilita etiquetas y empresas — también devuelve la app a su rendimiento normal.

Mientras tanto, la UI de etiquetas queda oculta a propósito (editor en la tarjeta y filtro del
tablero muestran "Se habilita tras la migración 31"): sin la columna, guardar una etiqueta no
persiste nada y sólo dejaría una línea falsa en el historial de la tarea.

Habilita:
- `cards.etiquetas`: etiquetas contextuales múltiples por tarea, independientes de
  `categoria` (que sigue siendo una sola categoría por card).
- Tabla `public.empresas`: catálogo de empresas del grupo (cualquier autenticado lee;
  solo el jefe crea/edita/borra).
  - **IMPORTANTE — rango de prioridad**: la columna `prioridad` está acotada a 0–4
    (CHECK constraint en la migración). La fórmula `prioridadEmpresa = prioridad + (reporta_fabrica ? 5 : 0)`
    depende de este rango para garantizar que reportar a fábrica siempre pese más.
    El UI refuerza este rango (max=4 en el input).
- Tabla `public.card_pausas`: registro de pausas del cronómetro por card. Se crea ahora
  aunque el cronómetro esté condicionado a la aprobación del ICR — la tabla vacía no
  molesta y evita una migración extra después.

### Verificaciones

1. La migración quedó registrada:
   ```sql
   select id, nombre, applied_at from public.schema_migrations where id = 31;
   ```
2. La columna `etiquetas` existe y su índice GIN también:
   ```sql
   select column_name, data_type from information_schema.columns
     where table_name = 'cards' and column_name = 'etiquetas';
   select indexname from pg_indexes
     where tablename = 'cards' and indexname = 'cards_etiquetas_gin';
   ```
3. La columna full-text generada `tsv` (migración 30) sigue intacta — agregar
   `etiquetas` no la toca:
   ```sql
   select column_name, is_generated from information_schema.columns
     where table_name = 'cards' and column_name = 'tsv';
   ```
   Debe seguir devolviendo 1 fila con `is_generated = 'ALWAYS'`.
4. Tabla `empresas` existe y sus policies también:
   ```sql
   select count(*) from public.empresas;
   select policyname, cmd from pg_policies where tablename = 'empresas';
   ```
   Deben aparecer `empresas_select`, `empresas_insert`, `empresas_update`,
   `empresas_delete`.
5. Tabla `card_pausas` existe, con su índice por `card_id` y sus policies:
   ```sql
   select count(*) from public.card_pausas;
   select indexname from pg_indexes
     where tablename = 'card_pausas' and indexname = 'card_pausas_card_id_idx';
   select policyname, cmd from pg_policies where tablename = 'card_pausas';
   ```
6. RLS de `empresas`: logueado como no-jefe, un INSERT/UPDATE/DELETE debe fallar por
   policy; el SELECT debe funcionar igual. Logueado como jefe, las cuatro operaciones
   deben andar.
7. RLS de `card_pausas`: logueado como empleado, solo debe ver sus propias pausas (o
   las de su equipo si es encargado, o todas si es jefe); solo puede insertar/editar/
   borrar las propias.

**Nota sobre el índice de búsqueda de texto (mejora futura)**: `etiquetas` NO se sumó al
`tsv` de la migración 30. `to_tsvector` sobre un `text[]` requiere concatenarlo primero
(`array_to_string`), lo que implicaría recrear la columna generada (drop + create). Hoy
alcanza con filtrar por etiqueta en la consulta (`etiquetas && array[...]`) sin pasar por
el buscador full-text; si más adelante se pide "buscar por etiqueta" desde el mismo
cuadro de búsqueda, ahí sí conviene esa migración aparte.

## GitHub Actions (#2) — opcional
El archivo del workflow está en `docs/ci-workflow.yml.txt`. Tu token no tiene scope `workflow`,
así que no se pudo pushear. Para activarlo: GitHub → repo → pestaña **Actions** → New workflow →
pegar ese contenido. (O regenerá el token con scope `workflow`.)

## PWA (#1)
Seguí `docs/PWA-REINSTALL.md`: desinstalar la PWA vieja y reinstalarla desde
`https://tablero-contable-grupo-paris.pages.dev/`.

## Secrets de CI (e2e)
Los specs `e2e/app.spec.ts` y `e2e/a11y.spec.ts` ya NO tienen credenciales hardcodeadas:
leen `process.env.E2E_USER` / `process.env.E2E_PASSWORD` y si faltan, se skipean solos
(el job de CI queda verde igual). Para que el e2e corra de verdad en GitHub Actions:
1. Creá (o pedile a alguien con acceso admin del repo que cree) una cuenta de **PRUEBA**
   en el Supabase real del proyecto — NO la cuenta del jefe real.
2. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `E2E_USER`: email o username de esa cuenta de prueba
   - `E2E_PASSWORD`: su contraseña
3. El workflow (`.github/workflows/main.yml`, job `e2e`) ya pasa esas variables como `env`.

**RECOMENDACIÓN URGENTE**: la contraseña del usuario `jefe1` quedó hardcodeada en commits
anteriores del historial de git (no se puede limpiar sin reescribir el historial). Rotá esa
contraseña cuanto antes desde Supabase Auth o desde la app.

**Orden de migraciones**: corré la 26, 27 y 28 SEGUIDAS y en ese orden. Si corrés solo la 26
o la 27, el chip de Admin puede decir "faltan migraciones 13-25" hasta que corras la 28 (que
hace el backfill del registro) — es cosmético, se arregla solo con la 28.

## Smoke de RLS (manual)
`scripts/rls-smoke.mjs` — verifica a mano (solo lectura + 1 delete a un id que
no existe) que las policies de RLS estén haciendo lo que deben: el empleado
solo ve sus propias cards, no puede borrar avisos ajenos, etc. Ver el detalle
de qué chequea en `docs/BACKUP-RESTORE.md` y en el propio script.

Usá SIEMPRE cuentas de **PRUEBA** (nunca las reales del jefe ni de un
empleado real). En PowerShell:

```powershell
$env:SUPABASE_URL = "https://yyyrlopgwmuvfbzwxiwp.supabase.co"
$env:SUPABASE_ANON_KEY = "sb_publishable_..."
$env:TEST_EMPLEADO_EMAIL = "empleado.prueba@..."
$env:TEST_EMPLEADO_PASS = "..."
$env:TEST_JEFE_EMAIL = "jefe.prueba@..."
$env:TEST_JEFE_PASS = "..."
node scripts/rls-smoke.mjs
```

Si falta alguna variable, el script imprime las instrucciones y sale con
código 1 sin tocar nada. La salida es una tabla PASS/FAIL/SKIP por check;
sale con código 1 si hay algún FAIL.

## Realtime de notificaciones (spec 28, Task 7)
La campana ahora se actualiza en tiempo real vía un canal de Supabase, en vez de esperar
al refresco periódico. Para habilitarlo falta un paso manual (checkbox del dashboard):

1. Supabase → **Database → Replication**.
2. En la publicación `supabase_realtime`, agregá la tabla `notifications`.

Sin este paso **no se rompe nada**: la campana sigue funcionando con el refresco de
respaldo cada 5 minutos (antes era cada 60 segundos), solo que las notificaciones nuevas
tardan un poco más en aparecer.

### PENDIENTE — Web Push (avisos con la app cerrada)

Lo de arriba es realtime **dentro de la app abierta**. Recibir avisos con la app **cerrada**
(Web Push) **todavía no está implementado**. Queda anotado acá para que no se dé por hecho:

- Requiere desplegar una **edge function** que firme y mande los push (VAPID), y eso exige
  `supabase login` + `supabase functions deploy` desde una terminal con la CLI autenticada.
  No se puede hacer desde el dashboard ni desde el repo solo.
- Hay que generar y guardar las **claves VAPID** como secrets del proyecto, y persistir la
  suscripción push de cada dispositivo.
- **En iPhone/iOS sólo funciona con la PWA instalada** ("Agregar a pantalla de inicio"):
  Safari no entrega Web Push a una pestaña común. Es decir que, aun terminado, no alcanza
  con desplegarlo: cada persona con iPhone tiene que instalar la app.

Mientras tanto, el equipo se entera por la campana al abrir el tablero.

## Notas de seguridad del rollout de login (#16)
- El login acepta **usuario O email**. Desplegar antes de cargar usernames NO bloquea a nadie.
- Recién cuando TODO el equipo tenga su username cargado y probado, se puede (a futuro) quitar
  el login por email. Eso es un cambio posterior, no está forzado ahora.
