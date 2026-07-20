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
   - Schedule: `0 12 * * 1` (todos los lunes a las 12:00 UTC)
   - Comando: `select public.resumen_semanal();`

   Esto publica un aviso en el tablón cada lunes con tareas cerradas, vencidas abiertas y arqueos
   con diferencia de la semana. Es opcional: si no lo configurás, nada cambia.

## GitHub Actions (#2) — opcional
El archivo del workflow está en `docs/ci-workflow.yml.txt`. Tu token no tiene scope `workflow`,
así que no se pudo pushear. Para activarlo: GitHub → repo → pestaña **Actions** → New workflow →
pegar ese contenido. (O regenerá el token con scope `workflow`.)

## PWA (#1)
Seguí `docs/PWA-REINSTALL.md`: desinstalar la PWA vieja y reinstalarla desde
`https://tablero-contable-grupo-paris.pages.dev/`.

## Notas de seguridad del rollout de login (#16)
- El login acepta **usuario O email**. Desplegar antes de cargar usernames NO bloquea a nadie.
- Recién cuando TODO el equipo tenga su username cargado y probado, se puede (a futuro) quitar
  el login por email. Eso es un cambio posterior, no está forzado ahora.
