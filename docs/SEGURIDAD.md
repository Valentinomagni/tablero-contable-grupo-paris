# Análisis de seguridad — Tablero Contable v2

Spec 28, Fase D, Task 10. Fecha: 22/07/2026. Rama: `dev`.

Este documento **no instala nada ni cambia código**. Releva el estado real de la aplicación,
evalúa las herramientas que se suelen recomendar para "fortalecer" un proyecto como este, y
para cada una da una recomendación explícita: **IMPLEMENTAR / DESCARTAR / ESPERAR**.

## Resumen ejecutivo (léase esto si no se lee nada más)

El proyecto está **bastante mejor parado de lo que se esperaría** para una app mantenida por una
sola persona. Lo importante ya está resuelto en el lugar correcto: la autorización vive en la base
de datos (RLS + triggers `SECURITY DEFINER`), no en el frontend. Eso es lo que de verdad aguanta
200 usuarios; el resto es accesorio.

Los riesgos abiertos hoy **no se arreglan comprando ni instalando herramientas**: se arreglan
rotando dos credenciales y sumando dos archivos chicos. Concretamente:

1. La contraseña de `jefe1` sigue en el historial de git. Severidad **ALTA**. Costo de arreglo: 2 minutos.
2. No hay ninguna forma de enterarse de un error en producción salvo que un usuario avise. Severidad **MEDIA-ALTA** con 200 usuarios.
3. El RPC `email_por_usuario` está expuesto a `anon`: cualquiera sin loguearse puede convertir un nombre de usuario en un email. Severidad **MEDIA**.

Y la conclusión incómoda: **la mayoría del catálogo típico de herramientas de seguridad no aplica
acá y agregarlo sería un retroceso.** WAF, SIEM, gestión de secretos, escáneres SAST comerciales,
pentesting automatizado, gestión de vulnerabilidades — todo eso presupone un equipo que responda
a las alertas. Acá hay una persona. Una alerta que nadie mira es ruido, y el ruido entrena a
ignorar también las alertas que sí importan. **Menos herramientas, mejor elegidas.**

---

## 1. Estado real relevado

### 1.1 Arquitectura y superficie de ataque

- **Frontend puro**: React 19 + Vite, servido estático desde Cloudflare Pages. No hay servidor
  propio, no hay API intermedia, no hay proceso Node en producción. Esto elimina de un plumazo
  categorías enteras de vulnerabilidades (inyección de comandos, SSRF, path traversal en servidor,
  deserialización). Es la decisión de arquitectura que más seguridad aportó al proyecto, y fue gratis.
- **Backend = Supabase** (Postgres gestionado + Auth + Storage + PostgREST). La superficie real de
  ataque es: la API de PostgREST expuesta con la clave publicable, y la protege **exclusivamente RLS**.
- **Una Edge Function** (`edge-function-eliminar-usuario.ts`, `functions/`) para borrado de usuarios.

**Consecuencia clave para todo lo que sigue**: en esta arquitectura, el frontend es *público por
definición*. Todo lo que se ve en el bundle (claves publicables, nombres de tablas, lógica de UI)
se asume conocido por un atacante. La seguridad real está en Postgres. Cualquier herramienta que
proponga "proteger el frontend" está resolviendo un problema que acá no existe.

### 1.2 Autenticación — estado: BIEN, con un agujero

`src/lib/supabase.ts` instancia el cliente con la URL del proyecto y la clave **publicable**
(`sb_publishable_...`), no la `service_role`. Esto es correcto y es la práctica esperada: la clave
publicable está diseñada para vivir en el navegador. No hay ninguna clave de servicio en el repo
(verificado por grep). No hace falta moverla a variables de entorno: no es un secreto.

`src/hooks/useAuth.ts` usa `supabase.auth.signInWithPassword`. Login por email o por nombre de
usuario; si el identificador no tiene `@`, se resuelve el email vía RPC. El cambio de contraseña
(`src/components/AccountModal.tsx`) revalida la contraseña vieja antes de llamar a `updateUser` —
bien hecho, evita el secuestro de sesión abierta.

**Agujero encontrado en este relevamiento** (`migracion-19-username.sql`, línea 15):

```sql
grant execute on function public.email_por_usuario(text) to anon, authenticated;
```

La función es `SECURITY DEFINER` y devuelve el email de cualquier perfil dado su username, **sin
requerir sesión**. Un atacante que conozca (o adivine) nombres de usuario obtiene los emails
corporativos de todo el equipo contable. No permite entrar, pero alimenta phishing dirigido —
que contra un equipo contable de concesionarias es exactamente el ataque que importa (fraude del
CEO, factura falsa). Con 200 usuarios el problema escala linealmente.

### 1.3 Autorización — estado: MUY BIEN, es la fortaleza del proyecto

Es lo mejor resuelto que tiene la aplicación y merece decirse: **la autorización está donde tiene
que estar, en la base, no en el frontend.**

- `migracion-14-FIX-URGENTE-recursion.sql` define `es_jefe()` y `es_encargado_de(uuid)` como
  `SECURITY DEFINER STABLE` con `set search_path = public`. Las tres cosas están bien:
  `SECURITY DEFINER` corta la recursión de políticas (el bug 42P17 que rompía producción),
  `STABLE` permite que el planner las cachee por statement, y fijar `search_path` cierra el vector
  clásico de secuestro de funciones en `SECURITY DEFINER`. Ese último detalle lo suele omitir gente
  con más experiencia que la que se le supone a este proyecto.
- Las policies de las migraciones 22, 27, 29, 30 y 31 son consistentes: `cards`, `cards_archive`,
  `announcements`, `consultas`, `cierre_periodos`, `empresas`, `card_pausas` y `schema_migrations`
  tienen todas RLS habilitada, con el patrón "propio / mi equipo vía `es_encargado_de` / jefe vía
  `es_jefe`". La 27 incluso deja el comentario de por qué `schema_migrations` necesita RLS ("sin RLS
  quedaría expuesta por la API") — el razonamiento correcto: en PostgREST, **toda tabla nueva sin RLS
  es una filtración**.
- `migracion-29-produccion.sql` resuelve elegantemente un problema difícil: la policy de UPDATE de
  `profiles` es amplia a nivel fila (permite editar la propia), y el trigger
  `profiles_bloquear_campos_sensibles` la restringe a nivel **columna**, rechazando cambios de
  `role`, `manager_id`, `oculto`, `username`, `email`, `marca` y `sucursal` a quien no sea jefe.
  Esto cierra la escalación de privilegios más obvia (un empleado se pone `role = 'jefe'`) y también
  la menos obvia (un empleado se cambia `marca`/`sucursal` para salirse de su segmento o entrar a
  otro). Está bien pensado y está comentado en el SQL.
- Storage: el bucket `adjuntos` es **privado** (`migracion-28`) con policies propias de
  select/insert/delete sobre `storage.objects`. Bien.

**Lo que falta**: la corrección de las policies se verifica a mano (`scripts/rls-smoke.mjs`) y sólo
si alguien se acuerda de correrlo. Ver §3, ficha "RLS smoke en CI".

### 1.4 Protección de datos — estado: ACEPTABLE

Cifrado en tránsito y en reposo lo provee Supabase (TLS obligatorio, cifrado de disco). No hay datos
que ameriten cifrado a nivel columna: el tablero maneja tareas contables, no números de cuenta ni
datos de tarjeta. No hay PII sensible más allá de nombre, email y jerarquía laboral.

Los adjuntos (`src/lib/adjuntos.ts`) validan extensión (lista blanca de 9 tipos) y tamaño (10 MB), y
sanitizan el nombre a `<timestamp>-<slug>.<ext>` sin diacríticos ni caracteres especiales — cierra
path traversal en la key del bucket y colisiones de nombre. Correcto.

Backups: `docs/BACKUP-RESTORE.md` documenta el export JSON desde Administración y el orden de
restauración respetando las FKs. Es un procedimiento manual y **depende de que alguien se acuerde**.
Ver §3, ficha "PITR de Supabase".

### 1.5 Validaciones — estado: BIEN para el modelo de amenaza real

`src/lib/schemas.ts` valida con Zod la frontera **de entrada** (lo que devuelve Supabase), de forma
no destructiva: cuenta las filas que no cumplen y avisa por consola, pero devuelve los datos crudos.
La decisión es correcta — un esquema desactualizado no debe romper el tablero — pero hoy ese aviso
**muere en la consola del navegador del usuario** y nadie lo ve. Es un dato de observabilidad
perfectamente bueno tirado a la basura. Ver §3, ficha "monitoreo de errores".

Sobre validación de escritura: no hay una capa de validación de inputs antes de escribir, y **está
bien que no la haya**. Con RLS, un usuario malicioso sólo puede escribir basura en filas que ya le
pertenecen. No hay SQL injection posible (PostgREST parametriza), no hay XSS (React escapa por
defecto y no hay un solo `dangerouslySetInnerHTML` en todo `src/` — verificado). Agregar validación
server-side de cada campo sería trabajo considerable para prevenir que alguien ponga un título feo
en su propia tarea.

### 1.6 Auditoría y registros de actividad — estado: PARCIAL

Existe `activity_log` (usada en `useData.ts`, `Board.tsx`, `CardModal.tsx`) y `cards.history`
(array de `{who, at, txt}`), más `cards_archive`. Es una traza **funcional** (qué se hizo con las
tareas), no una traza **de seguridad** (quién intentó qué y fue rechazado).

Lo que no queda registrado en ningún lado: intentos de login fallidos, cambios de rol, cambios de
`manager_id`, rechazos de RLS. Supabase guarda los logs de Auth y de Postgres, pero con **retención
de 1 día en el plan Free y 7 días en Pro**, y hay que ir a mirarlos a mano.

Con 200 usuarios y un equipo contable, la pregunta que se va a hacer alguna vez es "¿quién cambió
esto?". Ver §3, ficha "tabla de auditoría de campos sensibles".

### 1.7 Monitoreo — estado: INEXISTENTE. Es el hueco más grande.

Relevamiento honesto: **no hay Sentry ni ninguna otra cosa.** No hay dependencia de Sentry en
`package.json`, no hay `sentry` en el código, no hay DSN configurado ni sin configurar. La mención
a Sentry en `src/lib/schemas.ts` es un comentario aspiracional ("Sentry/observabilidad futura puede
engancharse acá"), no una integración a medio hacer.

Tampoco hay Error Boundary de React en ninguna parte (verificado: cero `ErrorBoundary`, cero
`componentDidCatch`). Un error de render no capturado en cualquier componente **deja la pantalla en
blanco**, sin mensaje, sin recuperación, y sin que nadie se entere.

Hoy, con pocos usuarios que están al lado, esto se banca: alguien avisa por WhatsApp. **Con 200
usuarios no se banca**, y este es el punto donde el proyecto tiene el mayor riesgo operativo real.

### 1.8 Seguridad del código — estado: BIEN

- CI en `.github/workflows/main.yml`: `npm ci` → `lint` (oxlint) → `test` (vitest, 64 archivos de
  test en `src/lib` solamente) → `build` (`tsc -b`, o sea typecheck estricto) y un job aparte de
  e2e con Playwright + axe-core (accesibilidad).
- Los specs e2e ya no tienen credenciales hardcodeadas: leen `E2E_USER`/`E2E_PASSWORD` de secrets y
  se auto-skipean si faltan. Corrección correcta y bien documentada.
- `knip` para código muerto, `oxlint` para lint. TypeScript estricto.
- No hay `eval`, no hay `dangerouslySetInnerHTML`, no hay claves de servicio en el código.

Falta: `.gitignore` no incluye `.env` ni `*.env`. Hoy no hay archivos `.env` en el proyecto, así que
no hay filtración — pero es una trampa preparada para el día que se agregue uno. Es una línea.

### 1.9 Dependencias — estado: ACEPTABLE, con una vulnerabilidad conocida sobrevalorada

19 dependencias de producción, todas de primera línea y actuales. No hay CI de auditoría de
dependencias ni Dependabot.

**Sobre `xlsx@0.18.5`**: es la vulnerabilidad conocida del proyecto (prototype pollution
CVE-2023-30533 y ReDoS CVE-2024-22363), sin fix disponible en el registry público de npm — SheetJS
se mudó a su propio CDN. Ahora, el análisis real:

Ambas vulnerabilidades se explotan **parseando** un archivo malicioso. Este proyecto **nunca parsea**:
`src/lib/excel.ts` sólo llama `utils.aoa_to_sheet`, `book_append_sheet` y `writeFile` — es decir,
sólo **escribe** archivos, a partir de datos que salen de la propia base. No hay ni un solo
`XLSX.read` en todo el código (verificado). Encima el import es dinámico, o sea que el módulo ni
siquiera se carga salvo que alguien apriete "descargar Excel".

**La vulnerabilidad es real en el árbol de dependencias y no explotable en este proyecto.** Va a
seguir apareciendo en rojo en cualquier `npm audit` para siempre, y esa es exactamente la razón por
la que hay que tener criterio antes de instalar un escáner que grite todos los días por algo que no
se puede explotar. Sí conviene dejarlo escrito (esta sección) para no volver a analizarlo cada vez.

### 1.10 Errores comunes (OWASP) — estado: mayormente N/A por arquitectura

- **Inyección**: no aplica (PostgREST parametriza; no hay SQL dinámico salvo en funciones con
  `search_path` fijo).
- **XSS**: React escapa por defecto, cero `dangerouslySetInnerHTML`. Residual: no hay CSP.
- **CSRF**: no aplica — Supabase usa Bearer token en header, no cookies de sesión.
- **Broken access control**: es *el* riesgo de esta arquitectura, y está mitigado con RLS (§1.3).
- **Configuración insegura**: no hay cabeceras de seguridad en Cloudflare Pages (no existe
  `public/_headers`). Ver §3, ficha "cabeceras de seguridad".
- **Componentes vulnerables**: §1.9.
- **Fallas de identificación**: la enumeración de emails de §1.2.

### 1.11 Resiliencia — estado: DÉBIL

- Sin Error Boundary: un error de render tumba la pantalla entera (§1.7).
- React Query con `staleTime: 30s` y `refetchOnWindowFocus: false`. Sin política de reintentos
  explícita (usa el default de 3 reintentos con backoff), lo cual es razonable.
- `src/lib/esquema.ts` es un ejemplo de resiliencia bien hecha y vale destacarlo: gatea las columnas
  nuevas según las migraciones aplicadas, con el criterio explícito "ante la duda, asumir esquema
  viejo". Prefiere que una función nueva no guarde un dato antes que romper el tablero entero. Este
  es el tipo de decisión que evita incidentes, y es más valiosa que cualquier herramienta de esta lista.
- Service Worker network-first: nunca sirve versiones viejas. Correcto.
- Backups manuales (§1.4).

---

## 2. Criterio de evaluación

El usuario pidió cinco criterios: valor real, compatibilidad, sin complejidad innecesaria,
arquitectura escalable, preparación para 200+ usuarios. Los aplico con un sesgo declarado:

> **Una sola persona mantiene esto.** El presupuesto de atención es el recurso escaso, no la plata
> ni el CPU. Una herramienta que consume atención sin devolver decisiones accionables tiene valor
> **negativo**: además de no aportar, degrada la respuesta a las que sí importan.

Por eso rechazo explícitamente cualquier cosa que genere alertas recurrentes que nadie va a leer.

---

## 3. Fichas por herramienta

### 3.1 Rotar la contraseña de `jefe1` y el PAT de GitHub

- **Problema real que resuelve**: la contraseña de `jefe1` está en el historial de git
  (`docs/PASOS-MANUALES.md` lo marca como URGENTE y sigue pendiente). Cualquiera con acceso al repo,
  presente o futuro, la lee con `git log -p`. El PAT también quedó comprometido y encima no tiene
  scope `workflow`, así que además molesta operativamente.
- **Costo**: $0. Complejidad: cero.
- **Esfuerzo**: 5 minutos entre las dos.
- **Recomendación: IMPLEMENTAR — HOY.** Es el ítem de mayor relación valor/esfuerzo de todo el
  documento y lleva meses pendiente. Reescribir el historial de git **no hace falta y no lo
  recomiendo**: es riesgoso, rompe clones, y una vez rotada la credencial el secreto viejo no vale
  nada. Rotar > limpiar.

### 3.2 Error Boundary de React

- **Problema real**: hoy un error de render deja pantalla en blanco sin mensaje ni recuperación
  (§1.7, §1.11). Con 200 usuarios eso es "el tablero no anda" multiplicado por 200 y sin ningún dato
  para diagnosticar.
- **Costo**: $0, cero dependencias (viene en React). Complejidad: un componente de ~30 líneas.
- **Esfuerzo**: 1 hora incluyendo tests.
- **Recomendación: IMPLEMENTAR — esta semana.** Es la mejora de resiliencia más barata disponible.
  Ponerlo alrededor de `<App />` en `main.tsx` y, mejor aún, uno por vista para que un error en
  Reportes no tumbe el Tablero.

### 3.3 Monitoreo de errores en producción (Sentry o equivalente)

- **Problema real**: es el hueco más grande (§1.7). Hoy la única detección de errores es que un
  contador avise por WhatsApp. Los warnings de drift de esquema que ya produce `schemas.ts` no
  llegan a nadie. Con 200 usuarios, la diferencia entre enterarse en 5 minutos y enterarse en 3 días
  es la diferencia entre un incidente y un problema de confianza.
- **Costo**: plan Developer de Sentry **gratis** hasta 5.000 errores/mes — de sobra para 200 usuarios
  internos, salvo que algo esté muy roto (y si lo está, querés saberlo). Si se supera: ~USD 26/mes.
  Alternativas: GlitchTip auto-hospedado (descartado: mantener un servidor es peor que el problema),
  o Cloudflare Web Analytics (no sirve, no captura excepciones).
- **Esfuerzo**: 2-3 horas. `@sentry/react` + DSN + `tracesSampleRate: 0` (no hace falta performance
  monitoring) + integración con el Error Boundary de §3.2.
- **Complejidad agregada**: baja, pero **no nula**: hay que filtrar ruido (errores de extensiones del
  navegador, `ResizeObserver loop`, chunks 404 tras un deploy) o se convierte en spam ignorado.
  Presupuestar una segunda sesión de tuning a la semana de instalarlo.
- **Recomendación: IMPLEMENTAR — este mes**, después del Error Boundary. Es la única herramienta
  externa de esta lista que recomiendo incorporar sin reservas. Advertencia de privacidad: activar
  `sendDefaultPii: false` y no mandar contenido de tareas en el contexto — son datos contables de
  clientes.

### 3.4 Restringir `email_por_usuario` a `anon`

- **Problema real**: enumeración de emails corporativos sin autenticación (§1.2), que habilita
  phishing dirigido contra un equipo contable — el blanco predilecto del fraude por transferencia.
- **Costo**: $0.
- **Esfuerzo**: una migración de pocas líneas, pero **requiere pensar el diseño**: quitar el grant a
  `anon` rompe el login por usuario, porque cuando alguien escribe su username todavía no tiene
  sesión. Alternativas: (a) rate-limit por IP vía Edge Function que haga de proxy; (b) una Edge
  Function que reciba username + contraseña, resuelva el email del lado del servidor, haga ella
  misma el `signInWithPassword` contra Supabase Auth y devuelva la sesión — el email nunca sale
  hacia el cliente; (c) devolver el email sólo si la contraseña también coincide.
- **Recomendación: IMPLEMENTAR — este mes, opción (b).** Es la única que cierra la enumeración de
  verdad: el email deja de ser un dato que el cliente puede pedir, y la verificación de credenciales
  la sigue haciendo Supabase Auth. La (a) sólo encarece la enumeración, no la impide.
- **(c) DESCARTADA.** Suena a la más barata y es la más cara: para "devolver el email sólo si la
  contraseña coincide" hay que verificar la contraseña dentro de un RPC `security definer`,
  o sea reimplementar contra `auth.users` con pgcrypto la comparación de hashes que hoy hace
  Supabase Auth — por fuera de Auth, que es exactamente lo que el diseño original evitó. Además
  obliga a pasarle la contraseña en claro a una función propia (queda en los logs de Postgres ante
  cualquier `log_statement` o error), y esa función pasa a ser código de autenticación casero que
  hay que mantener y auditar. Se pierde bloqueo por intentos, MFA y rotación de política de Auth.
  Nota: si se descarta también (b), dejarlo
  documentado como riesgo aceptado, no olvidado. **Esto NO se resuelve con ninguna herramienta**;
  es un cambio de diseño de 20 líneas. Ejemplo de por qué el relevamiento vale más que el catálogo.

### 3.5 Cabeceras de seguridad (`public/_headers` de Cloudflare Pages)

- **Problema real**: hoy no hay CSP, ni `X-Frame-Options`, ni `Referrer-Policy`. El riesgo residual
  es bajo (React ya cubre XSS), pero el clickjacking es real y gratis de prevenir, y una CSP acota
  el daño de un eventual XSS o de una dependencia comprometida en la cadena de suministro.
- **Costo**: $0. Un archivo de texto en `public/`, Cloudflare Pages lo aplica solo.
- **Esfuerzo**: 1-2 horas, la mayor parte en afinar la CSP para que no rompa Supabase (necesita
  `connect-src` al proyecto y a `wss://` para realtime) ni el service worker.
- **Riesgo**: una CSP mal puesta rompe la app en producción y no se nota en dev. Empezar con
  `Content-Security-Policy-Report-Only`, mirar una semana, después endurecer.
- **Recomendación: IMPLEMENTAR — este mes**, empezando por lo que no puede romper nada
  (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictiva) y dejando la
  CSP en modo reporte.

### 3.6 `npm audit` en CI

- **Problema real**: hoy nadie se entera si una dependencia saca un CVE. Con 19 dependencias de
  producción de proyectos serios, esto pasa un par de veces al año.
- **Costo**: $0. Ya viene con npm.
- **Esfuerzo**: una línea en `main.yml`.
- **La trampa**: `npm audit` va a fallar **siempre** por `xlsx` (§1.9), que no es explotable acá y no
  tiene fix. Un CI que está en rojo permanentemente es un CI que se ignora, y eso es peor que no
  tenerlo. Hay que correrlo con `--audit-level=high --omit=dev` **y** un allowlist explícito de
  `xlsx`, o directamente como paso informativo con `continue-on-error: true`.
- **Recomendación: IMPLEMENTAR con la salvedad anterior** — este mes. Si no se puede configurar sin
  falsos rojos permanentes, **DESCARTAR**: el valor no justifica normalizar un CI roto.

### 3.7 Dependabot / Renovate

- **Problema real**: mantener dependencias al día. Hoy se hace a mano y, mirando `package.json`, se
  hace bien: todo está en versiones actuales.
- **Costo**: $0 (Dependabot es nativo de GitHub, un archivo YAML).
- **Complejidad**: aparentemente nula, en la práctica **alta para una sola persona**: genera un flujo
  constante de PRs que hay que revisar, mergear y verificar. Es la herramienta que más veces vi
  terminar como 40 PRs abiertos que nadie mira, lo cual es peor que no tenerla porque esconde el PR
  de seguridad que sí importaba.
- **Recomendación: IMPLEMENTAR SOLO EN MODO `security-updates`.** Configurar Dependabot **únicamente
  para alertas de seguridad** (`Settings → Code security → Dependabot alerts`), sin actualizaciones
  de versión automáticas. Se obtiene el aviso cuando una dependencia tiene un CVE, sin el ruido de
  los bumps de patch. **DESCARTAR** `dependabot.yml` con `version-updates`.

### 3.8 RLS smoke automatizado en CI

- **Problema real**: la autorización es lo más importante del proyecto (§1.3) y su verificación es
  manual y opcional. Un `drop policy` mal puesto en una futura migración 32 no lo detecta nada. Con
  200 usuarios, una policy rota significa que un empleado ve las tareas de otra sucursal — que es
  exactamente el escenario que las migraciones 14/22/29 se tomaron el trabajo de prevenir.
- **Costo**: $0. `scripts/rls-smoke.mjs` **ya existe y ya está escrito**; sólo lee, con cuentas de
  prueba, y no agrega dependencias (usa `fetch` nativo).
- **Esfuerzo**: 1-2 horas. Un job en `main.yml` con los secrets de las cuentas de prueba (las mismas
  `E2E_USER`/`E2E_PASSWORD` más un empleado de prueba), corriendo con `continue-on-error: false`.
- **Recomendación: IMPLEMENTAR — este mes.** Es la mejor inversión de las que quedan porque
  **convierte trabajo ya hecho en una garantía permanente**. El trabajo duro (escribir el script) ya
  se pagó; falta enchufarlo. También conviene ampliarlo a cada tabla nueva de las migraciones 30/31.

### 3.9 Tabla de auditoría de campos sensibles

- **Problema real**: hoy no queda registro de quién cambió un `role` o un `manager_id` (§1.6). El
  trigger de la migración 29 **bloquea** el cambio no autorizado pero **no registra** los que sí lo
  están (los que hace el jefe). Con 200 usuarios y varias sucursales, "¿quién sacó a Fulano del
  equipo de Mengano?" se va a preguntar.
- **Costo**: $0 (una tabla y un trigger, ~40 líneas de SQL en la próxima migración).
- **Esfuerzo**: 2 horas. El trigger `profiles_bloquear_campos_sensibles` ya compara exactamente los
  campos que interesan — se le agrega un `insert into profiles_audit` en la rama permitida.
- **Recomendación: ESPERAR** hasta que la organización pase de ~50 personas o hasta el primer
  "¿quién cambió esto?". No es un riesgo de seguridad hoy; es una necesidad operativa que llega con
  la escala. Anotado acá para no re-analizarlo desde cero.

### 3.10 PITR (Point-in-Time Recovery) de Supabase

- **Problema real**: hoy el backup es un JSON manual que alguien tiene que acordarse de bajar
  (§1.4). Si el 12 de agosto alguien borra medio tablero, se restaura al último backup que exista —
  que puede ser de hace tres semanas.
- **Costo**: requiere plan **Pro (USD 25/mes)** más el add-on de PITR (**USD 100/mes** por 7 días de
  retención). El plan Pro solo ya incluye backups diarios automáticos, que es probablemente
  suficiente.
- **Esfuerzo**: cero técnico, es un toggle. El esfuerzo es la decisión de gasto.
- **Recomendación: ESPERAR — pero pasar a Pro antes de los 200 usuarios.** El PITR completo (USD
  125/mes) es caro para el riesgo real. Los **backups diarios automáticos del plan Pro** cubren el
  95% del escenario a 1/5 del precio, y además el plan Free tiene pausa automática por inactividad y
  retención de logs de 1 día, dos cosas inaceptables en producción con 200 usuarios. **El upgrade a
  Pro es un requisito de los 200 usuarios, no una opción.**

### 3.11 MFA / 2FA para los jefes

- **Problema real**: hoy una contraseña de jefe comprometida da acceso a todos los datos de todas
  las sucursales. Supabase Auth soporta TOTP nativamente.
- **Costo**: $0 en licencias. El costo es de UX y de soporte: reset de MFA cuando alguien cambia de
  teléfono, y esa carga cae sobre la misma persona que mantiene todo.
- **Esfuerzo**: 1-2 días (enrolamiento, verificación, flujo de recuperación, y un modo de forzarlo
  sólo para el rol `jefe`).
- **Recomendación: ESPERAR** hasta los 200 usuarios o hasta que se sume un segundo jefe. Con la
  cantidad actual de cuentas privilegiadas, una contraseña fuerte y única alcanza. **Cuando lleguen
  a 200 usuarios, esto pasa a ser IMPLEMENTAR obligatorio**: la superficie de cuentas comprometibles
  crece y el daño de una cuenta de jefe filtrada es total.

### 3.12 Escáner SAST (Snyk, SonarQube, Semgrep, CodeQL)

- **Problema real que resolvería**: encontrar vulnerabilidades en el código propio. Pero el código
  propio es un frontend React sin `eval`, sin `dangerouslySetInnerHTML`, sin SQL dinámico y sin
  servidor. Las clases de bug que estas herramientas encuentran **no existen en esta arquitectura**.
- **Costo**: CodeQL es gratis en repos públicos (este es privado; en privado requiere GitHub Advanced
  Security, que se cotiza por usuario y es caro). Snyk/Sonar tienen planes gratis limitados.
- **Recomendación: DESCARTAR.** Alto ruido, hallazgos irrelevantes, y compite por la atención de la
  única persona disponible. La revisión de las **policies de RLS** es donde están los bugs de
  seguridad reales de este proyecto, y ningún SAST las mira. Si alguna vez se quiere algo, Semgrep
  gratis con reglas de React es lo menos malo — pero hoy no aporta.

### 3.13 WAF / rate limiting / protección DDoS

- **Recomendación: DESCARTAR.** Cloudflare Pages ya provee mitigación DDoS y CDN en el plan gratuito,
  y Supabase tiene rate limiting propio en Auth (contra fuerza bruta de login). Es una app interna
  detrás de login para 200 empleados, no un e-commerce público. Un WAF acá agregaría configuración,
  costo y falsos positivos para prevenir un ataque que no tiene motivo de existir.

### 3.14 SIEM / gestión centralizada de logs (Datadog, Better Stack, Logtail)

- **Recomendación: DESCARTAR.** Presuponen a alguien que mire los dashboards. El monitoreo de errores
  de §3.3 cubre el 90% del valor (te avisa cuando algo se rompe) por $0 y sin dashboards que mantener.
  Reconsiderar sólo si aparece un requisito de cumplimiento formal que exija retención de logs.

### 3.15 Gestor de secretos (Vault, Doppler, AWS Secrets Manager)

- **Recomendación: DESCARTAR.** Los secretos de este proyecto son: dos secrets de e2e en GitHub
  Actions y el PAT. GitHub Secrets ya es un gestor de secretos adecuado para ese volumen. La clave
  publicable de Supabase no es un secreto. Un gestor externo agregaría una dependencia de
  infraestructura para gestionar dos strings.

### 3.16 Pentesting / bug bounty / auditoría externa

- **Recomendación: DESCARTAR hoy, RECONSIDERAR a los 200 usuarios** si el grupo lo exige por
  política. Una auditoría externa cuesta entre USD 3.000 y 15.000 y, en una app cuya única superficie
  real es RLS, lo que encontraría es esencialmente lo que ya está escrito en este documento. Si algún
  día se hace, que sea **específicamente una revisión de las policies de RLS**, no un pentest genérico.

### 3.17 `.env` en `.gitignore`

- **Problema real**: hoy no hay archivos `.env` y no hay filtración. Pero `.gitignore` no los
  contempla, así que el día que alguien cree uno (por ejemplo para correr `rls-smoke.mjs` cómodo, con
  contraseñas de cuentas de prueba adentro) va derecho al commit. Es exactamente la mecánica por la
  que la contraseña de `jefe1` terminó en el historial.
- **Costo/esfuerzo**: dos líneas.
- **Recomendación: IMPLEMENTAR — esta semana.** Trivial, y previene la repetición del único incidente
  de seguridad real que tuvo el proyecto.

---

## 4. Riesgos abiertos hoy

| # | Riesgo | Severidad | Qué hacer | Cuándo |
|---|--------|-----------|-----------|--------|
| 1 | Contraseña de `jefe1` en el historial de git | **ALTA** | Rotarla desde Supabase Auth. No reescribir el historial. | Hoy |
| 2 | PAT de GitHub comprometido (y sin scope `workflow`) | **MEDIA-ALTA** | Revocar y generar uno nuevo con el scope correcto. | Hoy |
| 3 | Sin monitoreo de errores en producción | **MEDIA** hoy, **ALTA** a 200 usuarios | Error Boundary + Sentry plan gratis (§3.2, §3.3). | Este mes |
| 4 | `email_por_usuario` expuesto a `anon` → enumeración de emails | **MEDIA** | Rediseñar el RPC (§3.4). Habilita phishing dirigido a contadores. | Este mes |
| 5 | RLS verificada sólo a mano | **MEDIA** | `rls-smoke.mjs` en CI (§3.8). El script ya existe. | Este mes |
| 6 | `xlsx@0.18.5` con CVEs conocidos | **BAJA** | Ninguna acción. **No explotable**: el proyecto sólo escribe, nunca parsea (§1.9). Revisar si algún día se agrega importación de Excel — ahí pasa a ALTA. | Documentado |
| 7 | Sin cabeceras de seguridad ni CSP | **BAJA** | `public/_headers` (§3.5). | Este mes |
| 8 | Backups manuales, plan Free (pausa por inactividad, logs 1 día) | **BAJA** hoy, **ALTA** a 200 usuarios | Upgrade a Pro (§3.10). | Antes de escalar |
| 9 | Sin traza de auditoría de cambios de rol/jerarquía | **BAJA** | Tabla de auditoría (§3.9). | Esperar |
| 10 | `.env` fuera de `.gitignore` | **BAJA** (preventivo) | Dos líneas (§3.17). | Esta semana |

**Aclaración sobre el ítem 3**: en el brief inicial figuraba "Sentry sin DSN". El relevamiento
muestra que la situación es distinta y peor: **Sentry no está instalado en absoluto**. No es que
falte configurar un DSN; falta todo. Se corrige acá para que no quede la impresión de que hay algo
a medio andar.

---

## 5. Plan priorizado

### Esta semana (todo gratis, ~2 horas en total)

1. **Rotar la contraseña de `jefe1`.** 2 minutos. Lleva meses pendiente. Es el ítem número uno.
2. **Revocar y regenerar el PAT** con scope `workflow`. 3 minutos. De paso desbloquea el CI.
3. **Agregar `.env` y `*.env` a `.gitignore`.** 1 minuto.
4. **Error Boundary de React** alrededor de `<App />` y de cada vista principal. 1 hora.

### Este mes (~1 día de trabajo, ~$0)

5. **Sentry** (plan gratis) enganchado al Error Boundary, con `sendDefaultPii: false`, sin performance
   monitoring, y una sesión de filtrado de ruido a la semana.
6. **`rls-smoke.mjs` como job de CI** con cuentas de prueba en secrets. Convierte en garantía
   permanente un trabajo ya pagado.
7. **`public/_headers`** con las cabeceras que no pueden romper nada, y CSP en `Report-Only`.
8. **Rediseñar `email_por_usuario`** para que no filtre emails a `anon`: opción (b) de §3.4 — una
   Edge Function que hace el `signInWithPassword` del lado del servidor y nunca devuelve el email.
   NO la opción (c) (devolver el email si la contraseña coincide): obliga a verificar credenciales
   dentro de un RPC `security definer` con pgcrypto, por fuera de Supabase Auth.
9. **Alertas de seguridad de Dependabot** (solo `security-updates`, sin bumps de versión) y
   `npm audit` en CI con `xlsx` en allowlist — o sin `npm audit`, si no se puede evitar el rojo permanente.

### Recién cuando lleguen a 200 usuarios

10. **Upgrade a Supabase Pro** (USD 25/mes). No es opcional: el plan Free pausa por inactividad y
    retiene logs 1 día. Los backups diarios que trae alcanzan; el add-on de PITR (USD 100/mes) no
    se justifica.
11. **MFA obligatorio para el rol `jefe`.** Con esa escala, el daño de una cuenta de jefe comprometida
    deja de ser aceptable.
12. **Tabla de auditoría de campos sensibles.**
13. **Revisar rendimiento de las policies de RLS.** Con 200 usuarios y muchas filas, `es_jefe()` y
    `es_encargado_de()` se evalúan por fila; hay que confirmar que `STABLE` esté haciendo su trabajo y
    que existan índices en `profiles.manager_id` y `cards.owner`. Nota: esto es *performance*, pero
    una policy lenta que alguien "optimice" simplificándola es una brecha de seguridad esperando.

### Nunca (salvo que cambie el contexto)

WAF, SIEM, gestor de secretos externo, SAST comercial, pentesting genérico, PITR completo. Cada uno
resuelve un problema que este proyecto no tiene, a cambio de atención que este proyecto no tiene de sobra.

---

## 6. Conclusión

La pregunta era qué herramientas hacen falta para fortalecer la aplicación. La respuesta honesta es
**casi ninguna**: de 17 candidatas evaluadas, una sola dependencia externa nueva se justifica (Sentry,
gratis). Todo lo demás que mueve la aguja es configuración, un componente de React, y dos credenciales
que hay que rotar.

Eso no es un diagnóstico de pobreza sino de que las decisiones estructurales ya se tomaron bien: sin
servidor propio, con la autorización en la base y no en el frontend, y con una capa de compatibilidad
de esquema que prefiere degradar antes que romper. Sobre esa base, el catálogo habitual de
herramientas de seguridad no tiene mucho que agregar.

**El riesgo real de este proyecto no es un ataque: es la ausencia de visibilidad.** Hoy nadie se
entera cuando algo se rompe. Ese es el hueco a tapar, y se tapa con un Error Boundary y un Sentry
gratis en una tarde.
