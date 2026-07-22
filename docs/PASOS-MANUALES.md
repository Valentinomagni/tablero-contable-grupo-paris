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

### AVISO IMPORTANTE — el trigger de notificaciones nace DESACTIVADO

La migración crea el trigger `cards_notificar_finalizacion` sobre `public.cards`, que
avisa al encargado/jefe cuando alguien termina una tarea con impacto. **Hoy la app
(cliente) ya inserta esa misma notificación** al finalizar una tarea. Si el trigger
quedara activo mientras el cliente sigue insertando, **cada finalización generaría DOS
notificaciones idénticas** y el equipo recibiría todo duplicado.

Por eso el trigger se crea **desactivado**: correr la migración 30 hoy es seguro y no
cambia nada de lo que ve el usuario.

Se activa **con un solo comando, y SOLO en el mismo momento en que se despliega la
Task 11** de esta fase (la que quita el insert del cliente en `CardModal.tsx`):

```sql
alter table public.cards enable trigger cards_notificar_finalizacion;
```

Si hay que revertir ese deploy, revertir también el trigger:

```sql
alter table public.cards disable trigger cards_notificar_finalizacion;
```

Volver a correr la migración 30 **no** apaga un trigger que ya fue activado: el script
lee el estado previo y lo restaura.

### Verificaciones

1. La migración quedó registrada:
   ```sql
   select id, nombre, applied_at from public.schema_migrations where id = 30;
   ```
2. El trigger existe y está **desactivado** (`tgenabled = 'D'`; pasa a `'O'` recién
   cuando se despliega la Task 11):
   ```sql
   select tgname, tgenabled from pg_trigger
     where tgrelid = 'public.cards'::regclass and not tgisinternal;
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

## Notas de seguridad del rollout de login (#16)
- El login acepta **usuario O email**. Desplegar antes de cargar usernames NO bloquea a nadie.
- Recién cuando TODO el equipo tenga su username cargado y probado, se puede (a futuro) quitar
  el login por email. Eso es un cambio posterior, no está forzado ahora.
