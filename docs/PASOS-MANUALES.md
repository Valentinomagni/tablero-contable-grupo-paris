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
3. **Desplegá la Edge Function** `eliminar-usuario` (Supabase → Edge Functions → crear `eliminar-usuario` → pegar el contenido de `edge-function-eliminar-usuario.ts` → Deploy). Mismo flujo que `crear-usuario`.
4. **Push del código** (deploy a Cloudflare). Desde la carpeta del proyecto:
   `git push origin main`  (o pedime que lo pushee yo).
5. **Configurar los datos nuevos** (una vez, desde la app como jefe, en Administración → clic en cada persona):
   - **Responsable (manager)** y **Marca** de cada empleado/encargado → activa Resúmenes por rol, Organigrama y permisos del Encargado.
   - **Usuario** (username, ej. `Vmagni`) de cada persona → habilita el login por usuario. **El login por email sigue funcionando** mientras tanto (compatibilidad), así que nadie queda afuera.

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
