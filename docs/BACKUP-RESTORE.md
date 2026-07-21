# Backup y restore — cómo es esto en la vida real

## Qué exporta el botón "Descargar backup completo (JSON)" del Admin

Está en `src/features/admin/Admin.tsx`, función `backup()` (línea ~135). Hace un
`select *` tabla por tabla y arma un JSON con esta forma:

```json
{
  "generado": "2026-07-20T...",
  "por": "<nombre de quien lo generó>",
  "tablas": {
    "profiles": [...],
    "cards": [...],
    "objectives": [...],
    "announcements": [...],
    "activity_log": [...],
    "daily_snapshots": [...],
    "settings": [...]
  }
}
```

Las tablas son EXACTAMENTE estas 7 (arreglo `tablas` hardcodeado en el código,
si agregás una tabla nueva y no la sumás ahí, el backup no la incluye — chequealo
cada vez que toques el schema):

`profiles, cards, objectives, announcements, activity_log, daily_snapshots, settings`

Si una tabla da error al leerla (por RLS, por ejemplo, si quien exporta no es
jefe), el JSON guarda `{ "error": "<mensaje>" }` en ese lugar en vez de las filas
— no te des cuenta tarde: abrí el archivo y confirmá que ninguna clave de
`tablas` tenga `error`.

## Qué NO incluye (y por qué importa)

- **`auth.users`**: los usuarios de Supabase Auth (email, password hash, metadata
  de auth) NO están en ninguna tabla de `public`, viven en el schema `auth` que
  el cliente anon/publishable no puede leer. El JSON de `profiles` tiene el
  perfil (nombre, rol, manager_id, etc.) pero el `id` de cada fila es una FK a
  un usuario de `auth.users` que este backup no reconstruye.
- **`task_occurrences`**: tabla de arqueos/ocurrencias (migración 23+), leída
  por `resumen_semanal()` en `migracion-28-infraestructura.sql`. NO está en el
  arreglo `tablas` del backup — verificado leyendo `Admin.tsx` línea 137. Si la
  usás para arqueos con diferencia, hoy no se respalda con este botón.
- **`cards_archive`**: el snapshot mensual que arma `archivar_mes()` (migración
  22). Tampoco está en la lista. El "Archivo mensual" del Admin vive en esta
  tabla y este backup no la toca.
- **`schema_migrations`**: tabla de control (migración 28). Tampoco incluida —
  no es grave, se puede reconstruir mirando qué archivos `migracion-*.sql` ya
  corriste.
- **Storage** (bucket `adjuntos`, adjuntos de las cards, migración 28): un
  export JSON de tablas no toca archivos binarios en Storage. Los adjuntos que
  suban los empleados NO están en este backup bajo ningún concepto.
- **Cualquier función, trigger, policy o definición de schema**: el JSON es
  solo datos, no DDL. Si perdés el proyecto de Supabase entero, este archivo no
  te recrea las tablas, RLS, triggers ni funciones — para eso hace falta correr
  de nuevo todos los `migracion-*.sql` en orden.

## Cómo restaurar

Esto es para el escenario "necesito reconstruir datos de estas 7 tablas en un
proyecto de Supabase que YA tiene el schema (tablas, RLS, funciones, triggers)
corriendo" — es decir, corriste todos los `migracion-*.sql` antes de esto.

### Orden por FKs (importante, no es arbitrario)

1. **`profiles`** primero, siempre. Cada fila de `profiles` tiene `id = auth.uid()`
   de un usuario real. **Los usuarios de auth deben existir ANTES que las filas
   de `profiles`** — si el proyecto destino es nuevo, primero creá cada usuario
   en Supabase Auth (Dashboard → Authentication → Users, o vía API con la
   service key) usando el MISMO `id` (uuid) que tenía en el proyecto origen, y
   recién ahí insertá `profiles`. Si insertás `profiles` con un `id` que no
   existe en `auth.users`, la FK falla (o si no hay FK explícita, vas a tener
   perfiles huérfanos que rompen `es_jefe()`/`es_encargado_de()`).
2. **`cards`** (depende de `profiles.owner`, `manager_id` indirectamente).
3. **`objectives`** (depende de `profiles`).
4. **`announcements`** (depende de `profiles.owner_id`/`created_by`).
5. **`activity_log`** (depende de `profiles` y típicamente de `cards`).
6. **`daily_snapshots`** (snapshot histórico, sin dependientes).
7. **`settings`** (config global, sin FKs a las anteriores — va al final o al
   principio, no importa, pero dejalo al final para no bloquearte si falla algo
   antes).

### Cómo insertar

Dos vías, elegí según cuánta data es:

- **SQL Editor de Supabase (pocas filas / a mano)**: generá `insert into ...`
  con `on conflict (id) do update set ...` (upsert) para cada tabla, en el
  orden de arriba. Copiá los valores del JSON a mano o con un script que arme
  el SQL.
- **API con service key (recomendado para volumen)**: un script Node
  standalone que lea el JSON y haga `POST /rest/v1/<tabla>` con header
  `Prefer: resolution=merge-duplicates` (upsert) y la **service_role key** (NO
  la publishable/anon — la anon no puede escribir en `profiles` de otra
  persona por RLS). Recorré `tablas` en el orden de la sección anterior.

### Advertencias

- **Nunca upsertees con la key publishable/anon**: las policies de RLS (ver
  `migracion-14-FIX-URGENTE-recursion.sql`, `migracion-22-gestion-tareas.sql`)
  limitan quién puede escribir qué. Para una restauración completa necesitás
  la service key, que bypassea RLS.
- **Los `id` de `profiles` DEBEN preexistir en `auth.users`** del proyecto
  destino antes de insertar `profiles`. Es el error más común al restaurar en
  un proyecto nuevo: se sube `profiles` primero y explota (o queda un perfil
  fantasma sin login posible).
- Este JSON es un dump de datos en un momento dado. Si restaurás sobre un
  proyecto con datos más nuevos, un upsert por `id` puede pisar cambios
  posteriores — restaurá contra un proyecto vacío o de prueba, no contra
  producción con datos frescos, salvo que sepas exactamente qué estás haciendo.

## El backup real: activá los backups diarios de Supabase

El JSON del botón Admin es un complemento manual, NO el respaldo real del
proyecto. Supabase (en planes Pro y superiores) hace backups diarios
automáticos del proyecto completo — schema, datos, storage metadata, todo —
con restore point-in-time según el plan.

**Activalo en**: Dashboard de Supabase → tu proyecto → **Database → Backups**.
Confirmá que esté prendido y revisá cada tanto que el backup más reciente sea
de menos de 24-48hs.

Este es el respaldo del que depende la continuidad real del negocio. El JSON
del Admin sirve para: (a) tener una copia rápida fuera de Supabase antes de un
cambio riesgoso, (b) inspeccionar datos sin entrar al SQL Editor, (c) un
respaldo extra en el Drive del estudio como dice el texto del botón. No
reemplaza el backup de plataforma.

---

Probá el restore una vez en un proyecto de prueba: un backup sin restore
probado es una esperanza.
