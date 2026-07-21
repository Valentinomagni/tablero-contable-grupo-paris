# Spec 28 — Fase A: preparación para producción con 30 empleados

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el sistema listo para que lo usen ~30 empleados: usuario administrador oculto, canal interno de consultas, control de tiempos de ejecución, presencia en línea, cierre mensual por persona, dato de control en operativas y agrupación realmente independiente del estado.

**Architecture:** Misma arquitectura (React 19 + TanStack Query 5 + Supabase con RLS). Una sola migración aditiva (29) cubre todo el esquema de la fase. El "administrador fantasma" se resuelve con una columna `oculto` en `profiles` y un único predicado compartido `esVisible()` aplicado en TODA lectura de personas — mismo patrón ya probado con `esSinAsignar`. El cierre pasa de global a por-persona con una tabla `cierre_periodos`.

**Tech Stack:** React 19, TypeScript, TanStack Query 5, Supabase (Postgres + RLS), Tailwind (tokens monocromos), vitest, Lucide.

## Global Constraints

- **Foco del producto (regla de aceptación de toda tarea):** el sistema NO es un ERP y NO reemplaza a Quiter (conciliaciones, proveedores, facturación, gestión comercial, registraciones). Antes de implementar cualquier cosa, responder: *¿ayuda a organizar, controlar o analizar el trabajo del equipo?* Si la respuesta es no, no se implementa. La simplicidad tiene prioridad sobre agregar funcionalidades.
- **Cero emojis** en la UI: solo íconos Lucide o SVG propios monocromáticos. Estética premium negro/blanco marca Paris.
- **Español rioplatense (voseo)** en toda la UI, comentarios y documentación.
- **Código defensivo ante migración 29 no aplicada:** columnas nuevas `?` opcionales, queries con catch → `[]`/null, la app nunca crashea. Hay cola: 26, 27 y 28 tampoco están corridas.
- **TDD** para toda lógica en `src/lib/*`. Gates por commit: `tsc -b` + vitest (los corre el pre-commit, ~80 s). Tests base al empezar: **368**.
- **Regla de release (CLAUDE.md):** entrada nueva en `CHANGELOG` de `src/lib/version.ts` antes del push final (v2.4.0). `APP_VERSION` se deriva sola.
- Migración en `migracion-29-*.sql` en la raíz, idempotente, documentada en `docs/PASOS-MANUALES.md`. La corre el usuario a mano.
- NO pushear hasta la task final (review de rama completa primero).
- Trabajar en la rama `dev` (ver `docs/FLUJO-DEV.md`); el merge a `main` se decide en la task final.

---

### Task 1: Migración 29 — esquema completo de la Fase A

**Files:**
- Create: `migracion-29-produccion.sql`
- Modify: `src/lib/types.ts`, `docs/PASOS-MANUALES.md`

**Interfaces:**
- Produces (DB): `profiles.oculto boolean not null default false`; `profiles.last_seen timestamptz`; `cards.proc_at timestamptz`; `cards.tiempo_max_horas int`; `cards.dato_control text`; tabla `consultas`; tabla `cierre_periodos`.
- Produces (TS): `Profile.oculto?: boolean`, `Profile.last_seen?: string | null`, `Card.proc_at?: string | null`, `Card.tiempo_max_horas?: number | null`, `Card.dato_control?: string | null`, `interface Consulta`, `interface CierrePeriodo`.

- [ ] **Step 1: Escribir el SQL** (idempotente, comentado en rioplatense, estilo de `migracion-28-infraestructura.sql`)

```sql
-- Migración 29 — Preparación para producción (spec 28 fase A)
alter table public.profiles add column if not exists oculto boolean not null default false;
alter table public.profiles add column if not exists last_seen timestamptz;
alter table public.cards    add column if not exists proc_at timestamptz;
alter table public.cards    add column if not exists tiempo_max_horas int;
alter table public.cards    add column if not exists dato_control text;

-- Consultas internas: canal de feedback del equipo hacia la administración.
create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references auth.users(id),
  tipo text not null default 'consulta',      -- consulta | sugerencia | error
  texto text not null,
  estado text not null default 'nueva',       -- nueva | leida | archivada
  respuesta text,
  created_at timestamptz not null default now(),
  respondida_at timestamptz
);
alter table public.consultas enable row level security;

-- Cierre mensual POR PERSONA: cada quien cierra su mes cuando terminó.
create table if not exists public.cierre_periodos (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id),
  mes text not null,                          -- 'YYYY-MM'
  cerrado_at timestamptz not null default now(),
  nota text,
  unique (owner, mes)
);
alter table public.cierre_periodos enable row level security;

insert into public.schema_migrations (id, nombre)
  select 29, 'migracion-29-produccion.sql'
  where not exists (select 1 from public.schema_migrations where id = 29);
```

- [ ] **Step 2: Políticas RLS** — en el mismo archivo, con `drop policy if exists` + `create policy`:
  - `consultas`: SELECT propio (`autor = auth.uid()`) **o** `public.es_jefe()`; INSERT propio; UPDATE solo `es_jefe()` (para estado/respuesta); sin DELETE.
  - `cierre_periodos`: SELECT propio o `es_jefe()` o `es_encargado_de(owner)`; INSERT/DELETE propio (cerrar y reabrir el mes propio); UPDATE propio.
  - `profiles.last_seen`: verificar la policy de UPDATE existente de `profiles` — si no permite que cada uno actualice su propia fila, agregar una policy de UPDATE con `using (id = auth.uid())`. Leé las policies de `migracion-14-FIX-URGENTE-recursion.sql` antes de tocar nada: **no rompas `es_jefe()`/`es_encargado_de()`**.

- [ ] **Step 3: Types defensivos** — agregar los campos opcionales listados en Interfaces, más:

```ts
export interface Consulta {
  id: string; autor: string; tipo: "consulta" | "sugerencia" | "error";
  texto: string; estado: "nueva" | "leida" | "archivada";
  respuesta: string | null; created_at: string; respondida_at: string | null;
}
export interface CierrePeriodo { id: string; owner: string; mes: string; cerrado_at: string; nota: string | null }
```

- [ ] **Step 4: Gates** — `npx tsc -b` limpio + `npx vitest run` (368 verdes, no deberían cambiar).
- [ ] **Step 5: `docs/PASOS-MANUALES.md`** — sección "Migración 29" con la verificación: `select column_name from information_schema.columns where table_name='profiles' and column_name in ('oculto','last_seen');` debe devolver 2 filas.
- [ ] **Step 6: Commit** — `feat(prod): migración 29 — esquema de preparación para producción`

---

### Task 2: Administrador fantasma — predicado único y filtrado transversal

**Files:**
- Create: `src/lib/visibilidad.ts` + `src/lib/visibilidad.test.ts`
- Modify: todos los consumidores de listas de personas (buscarlos con grep, ver Step 1)

**Interfaces:**
- Produces: `esVisible(p: Pick<Profile, "id" | "email" | "oculto">): boolean` — `false` si `p.oculto === true` **o** si `esSinAsignar(p)`; `true` en cualquier otro caso (incluido `oculto` undefined, base sin migración 29).
- Produces: `personasVisibles<T extends Pick<Profile,"id"|"email"|"oculto">>(ps: T[]): T[]`.

- [ ] **Step 1: Relevamiento obligatorio** — `grep -rn "team\b\|profiles" src/features src/hooks --include="*.tsx" --include="*.ts" | grep -v test` y listar en el reporte TODOS los lugares donde se muestran o cuentan personas: organigrama, admin/equipo, selects de responsable (NuevaTareaModal, DelegarModal, ReasignarModal, UserModal), donut y ranking del reporte, análisis por persona, resumen, calendario, vacaciones, menciones (@), alertas, ociosidad.
- [ ] **Step 2: Test que falla** (`visibilidad.test.ts`): perfil normal → visible; `oculto: true` → no; email `sin-asignar@grupoparis.com` → no; `oculto` undefined → visible (defensivo); `personasVisibles` conserva el orden.
- [ ] **Step 3: Implementar** `visibilidad.ts` reutilizando `esSinAsignar` de `jerarquia.ts` (no dupliques la regla).
- [ ] **Step 4: Aplicar en TODOS los puntos del Step 1.** En `src/lib/analisis.ts` reemplazar el filtro actual `p.role !== "jefe" && !esSinAsignar(p)` por `p.role !== "jefe" && esVisible(p)`. **Excepción única:** el panel de Administración del jefe SÍ debe poder ver al usuario oculto (para poder administrarlo), marcado con un chip "Oculto" — ahí no filtres.
- [ ] **Step 5: Toggle en UserModal** — checkbox "Usuario oculto (no aparece en listados ni métricas)" visible SOLO para rol jefe, guardando `oculto`.
- [ ] **Step 6: Gates + smoke** — `npx tsc -b` + `npx vitest run`. Verificar que ningún test existente asumiera el conteo de personas sin filtrar.
- [ ] **Step 7: Commit** — `feat(admin): usuario oculto excluido de listados, organigrama y métricas`

---

### Task 3: Módulo Consultas — canal interno de feedback

**Files:**
- Create: `src/lib/consultas.ts` + `src/lib/consultas.test.ts`, `src/features/consultas/ConsultasModal.tsx`, `src/features/consultas/BandejaConsultas.tsx`
- Modify: `src/components/Shell.tsx` (ítem en el menú del perfil), `src/hooks/useData.ts` (hooks), `src/features/admin/Admin.tsx` (bandeja para el jefe)

**Interfaces:**
- Consumes: tabla `consultas` e `interface Consulta` (Task 1).
- Produces: `validarConsulta(texto: string): string | null` (vacío → "Escribí tu consulta."; > 2000 → "Máximo 2000 caracteres."; si no → null); `ordenarConsultas(cs: Consulta[]): Consulta[]` (nuevas primero, luego leídas, archivadas al final; dentro de cada grupo por fecha desc); `contarNuevas(cs: Consulta[]): number`.
- Produces (hooks): `useConsultas()` (las del usuario actual o todas si es jefe; error → `[]`), `useConsultasNuevas()` para el badge.

- [ ] **Step 1: Tests que fallan** de las 3 funciones puras, incluyendo bordes (lista vacía, todas archivadas, texto de 2000 y 2001 caracteres).
- [ ] **Step 2: Implementar** `consultas.ts`.
- [ ] **Step 3: UI del empleado** — `ConsultasModal.tsx`: se abre desde el **menú del perfil**, junto a Modo claro/oscuro, Densidad y Cambiar contraseña (mirá cómo están montados esos ítems en `Shell.tsx`/`AccountModal.tsx` y seguí ese patrón exacto). Contenido: selector de tipo (Consulta / Sugerencia / Error), textarea, botón Enviar, y debajo el historial de las consultas propias con su estado y la respuesta si la hay. Ícono: `MessageSquarePlus` de Lucide.
- [ ] **Step 4: Bandeja del administrador** — `BandejaConsultas.tsx` dentro de Administración, visible solo para jefe: lista ordenada con `ordenarConsultas`, filtro por estado, acciones "Marcar leída", "Archivar" y "Responder" (textarea que guarda `respuesta` + `respondida_at`). Badge con `contarNuevas` en el ítem de Administración.
- [ ] **Step 5: Defensivo** — si la tabla no existe (migración 29 sin correr), el modal muestra "Las consultas se habilitan tras la migración 29." y no rompe nada.
- [ ] **Step 6: Gates + commit** — `feat(consultas): canal interno de consultas, sugerencias y errores`

---

### Task 4: Tiempo máximo de ejecución

**Files:**
- Create: `src/lib/tiempos.ts` + `src/lib/tiempos.test.ts`
- Modify: `src/features/board/Board.tsx` (sellar `proc_at` al pasar a "En proceso"), `src/features/board/card/MetaSection.tsx` (campo por tarea + indicador), `src/features/admin/Admin.tsx` (configuración parametrizable)

**Interfaces:**
- Consumes: `Card.proc_at`, `Card.tiempo_max_horas` (Task 1).
- Produces:
```ts
export interface EstadoTiempo { maxHoras: number | null; horas: number | null; excedido: boolean; restanteHoras: number | null }
export function tiempoMaxDe(c: Card, config: Record<string, number>): number | null
export function estadoTiempo(c: Card, config: Record<string, number>, ahoraISO: string): EstadoTiempo
export function incumplimientos(cards: Card[], config: Record<string, number>, ahoraISO: string): Card[]
```
- Reglas: `tiempoMaxDe` = `c.tiempo_max_horas` si está, si no `config[c.categoria ?? ""]`, si no `null`. `estadoTiempo` mide desde `proc_at`; si la card está en `term` mide `proc_at → done_at`, si está en `proc` mide `proc_at → ahora`, si está en `pend` o no hay `proc_at` devuelve todo en `null`/`false`. `excedido` = hay máximo **y** horas > máximo.

- [ ] **Step 1: Tests que fallan** — mínimo 8 casos: sin config ni campo → null; config por categoría aplicada; campo por tarea pisa la config; en proceso dentro del límite; en proceso excedido; terminada dentro; terminada excedida; pendiente → todo null; `proc_at` ausente en card `proc` (base vieja) → null sin crashear.
- [ ] **Step 2: Sellar `proc_at`** en la mutación de cambio de estado de `Board.tsx`: cuando pasa a `proc` y `proc_at` es null, setear `proc_at = new Date().toISOString()`. Al volver a `pend`, limpiar `proc_at = null`. **No toques** la lógica existente de `done_at`.
- [ ] **Step 3: Registro del incumplimiento** — al pasar a `term`, si `estadoTiempo` da `excedido`, agregar una entrada al `history` de la card: `"Superó el tiempo máximo (Xh de Yh)"`. Así queda registrado para análisis posterior sin tabla nueva, y la Bitácora ya lo muestra.
- [ ] **Step 4: Configuración parametrizable** en Administración (solo jefe): tabla editable categoría → horas, guardada en `settings` con key `tiempos_max` (patrón idéntico al de `plantillas` en `Admin.tsx`). Permitir agregar y borrar filas.
- [ ] **Step 5: Indicador en la tarjeta** — en `MetaSection.tsx`, campo numérico opcional "Tiempo máximo (horas)" y un chip que muestra el estado: dentro del límite en `text-ink2`, excedido en `text-danger` con `AlertTriangle`. Sin emojis.
- [ ] **Step 6: Gates + commit** — `feat(tiempos): tiempo máximo de ejecución configurable con registro de incumplimientos`

---

### Task 5: Indicador de presencia en línea

**Files:**
- Create: `src/hooks/usePresencia.ts`, `src/lib/presencia.ts` + `src/lib/presencia.test.ts`
- Modify: `src/App.tsx` (heartbeat), `src/features/organigrama/Organigrama.tsx` y `src/features/admin/Admin.tsx` (indicador)

**Interfaces:**
- Consumes: `Profile.last_seen` (Task 1).
- Produces: `enLinea(lastSeenISO: string | null | undefined, ahoraISO: string, umbralMin = 3): boolean`; `textoUltimaConexion(lastSeenISO: string | null | undefined, ahoraISO: string): string` → `"En línea"` | `"Hace 12 minutos"` | `"Hace 3 horas"` | `"Ayer 14:30"` | `"Sin registro"`.
- Produces (hook): `usePresencia()` — actualiza `profiles.last_seen` del usuario actual al montar y cada 2 minutos mientras la pestaña esté visible (usá `document.visibilityState` para no escribir con la pestaña en segundo plano).

- [ ] **Step 1: Tests que fallan** de `enLinea` y `textoUltimaConexion`: null → "Sin registro"; hace 1 min → "En línea"; hace 12 min → "Hace 12 minutos"; hace 3 h → "Hace 3 horas"; ayer → "Ayer HH:MM"; borde exacto del umbral.
- [ ] **Step 2: Implementar** las dos funciones puras (fechas en zona Argentina: reusá `toARTDate` de `metrics.ts` donde corresponda).
- [ ] **Step 3: Hook `usePresencia`** con `setInterval` de 2 min + limpieza en el `return` del `useEffect`. Escritura: `supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", meId)` con el error ignorado (base sin migración 29 → no rompe).
- [ ] **Step 4: Montarlo una sola vez** en `App.tsx`, después de tener sesión.
- [ ] **Step 5: Indicador** — punto verde (`bg-done`, 8 px, `rounded-full`) + texto de `textoUltimaConexion` junto al nombre en Organigrama y en la tabla de Equipo de Administración. El punto solo aparece si `enLinea`; si no, solo el texto en `text-ink2`.
- [ ] **Step 6: Gates + commit** — `feat(presencia): indicador de usuario en línea y última conexión`

---

### Task 6: Cierre mensual por persona (múltiples períodos abiertos)

**Files:**
- Create: `src/lib/periodos.ts` + `src/lib/periodos.test.ts`, `src/hooks/usePeriodos.ts`
- Modify: `src/features/cierre/Cierre.tsx` (botón de cierre propio + navegación libre), `src/lib/cierre-unificado.ts` (el semáforo pasa a ser personal)

**Interfaces:**
- Consumes: tabla `cierre_periodos`, `CierrePeriodo` (Task 1); `estadoCierre` de `cierre-unificado.ts`.
- Produces:
```ts
export function mesCerradoPor(periodos: CierrePeriodo[], ownerId: string, mes: string): CierrePeriodo | null
export function mesesAbiertos(periodos: CierrePeriodo[], ownerId: string, mesesConTrabajo: string[]): string[]
export function resumenEquipo(periodos: CierrePeriodo[], personas: Profile[], mes: string):
  { cerraron: Profile[]; pendientes: Profile[]; pct: number }
```
- Reglas: un mes está abierto para una persona si tiene trabajo de ese mes y **no** tiene fila en `cierre_periodos`. `mesesConTrabajo` sale de las cards de esa persona ancladas a cada mes. Varios meses pueden estar abiertos a la vez, sin conflicto: cerrar julio no toca junio.

- [ ] **Step 1: Tests que fallan** — persona sin filas → todos los meses con trabajo abiertos; cerró junio pero no julio → solo julio abierto; `resumenEquipo` con 3 personas y 1 cerrada → pct 33 y listas correctas; mes sin trabajo no cuenta como abierto; equipo vacío → pct 0 sin dividir por cero.
- [ ] **Step 2: Implementar** `periodos.ts` (pura) y `usePeriodos.ts` (query `["periodos"]`, error → `[]`; mutaciones cerrar/reabrir con invalidate).
- [ ] **Step 3: UI del empleado en `Cierre.tsx`** — sacar la restricción de "solo el mes en curso": se puede navegar y trabajar cualquier mes. Cuando el mes navegado NO está cerrado por vos, mostrar el semáforo personal (`estadoCierre`) y un botón "Cerrar mi mes" (habilitado siempre, con confirmación inline: "Vas a cerrar tu junio 2026. Podés reabrirlo si hace falta."). Si ya está cerrado: banda "Cerraste este mes el {fecha}" + botón "Reabrir".
- [ ] **Step 4: Aviso de meses abiertos** — si `mesesAbiertos` devuelve más de uno, chip discreto arriba: "Tenés 2 meses abiertos: junio, julio". Sin alarmismo — trabajar en paralelo es válido y esperado.
- [ ] **Step 5: Vista del jefe** — en `Cierre.tsx`, si el rol es jefe o encargado, tabla `resumenEquipo` del mes navegado: quién cerró (con fecha) y quién no. Ordenada: pendientes primero.
- [ ] **Step 6: Gates + commit** — `feat(cierre): cierre mensual por persona con múltiples períodos abiertos`

---

### Task 7: Dato de control en tareas operativas

**Files:**
- Modify: `src/features/board/card/MetaSection.tsx`, `src/features/board/NuevaTareaModal.tsx`

**Interfaces:**
- Consumes: `Card.dato_control` (Task 1).

**Requisito literal del spec:** la etiqueta es exactamente **"Dato de control a adjuntar"**, sin ningún texto adicional, sin ayuda, sin placeholder explicativo. Campo de texto libre, opcional.

- [ ] **Step 1: Campo en la edición** — en `MetaSection.tsx`, junto a los otros metadatos, `<label>Dato de control a adjuntar<input ... /></label>` con el estilo exacto de los inputs vecinos, guardando con el mismo patrón `patch.mutate({ dato_control: v.trim() || null })` en `onBlur` y comparando contra el valor actual antes de mutar (para no disparar mutaciones espurias, igual que el campo de categoría).
- [ ] **Step 2: Campo en el alta** — mismo campo en `NuevaTareaModal.tsx`, guardando `dato_control: valor.trim() || null`.
- [ ] **Step 3: Mostrarlo en la tarjeta** — si la card tiene `dato_control`, chip discreto en el frente de la tarjeta del tablero (`bg-chip`, `text-[11px]`, `tnum`) para que se lea sin abrir la tarea.
- [ ] **Step 4: Gates + commit** — `feat(tareas): campo Dato de control a adjuntar`

---

### Task 8: Agrupación totalmente independiente del estado (carriles)

**Diagnóstico (ya verificado, no lo repitas — implementalo):** `agruparCards` en `src/lib/agrupar.ts` YA es pura y no toca el estado. El acoplamiento real está en `Board.tsx:256-263`: las columnas se arman con `mine.filter(c => c.status === k)` y los grupos se dibujan DENTRO de cada columna. Por eso al cambiar de estado la tarjeta salta de columna y el grupo se rearma. La corrección es invertir la jerarquía visual: **carriles horizontales por grupo, que atraviesan las tres columnas de estado**.

**Files:**
- Modify: `src/features/board/Board.tsx`
- Create: `src/features/board/Carriles.tsx`

**Interfaces:**
- Consumes: `agruparCards(cards, modo, { profiles })` y `ModoAgrupar` (sin cambios en la lib).
- Produces: `Carriles({ cards, modo, profiles, columnas, renderCard, contarPor })` — por cada grupo devuelto por `agruparCards` sobre el conjunto COMPLETO de cards (no por columna), renderiza una franja con el nombre del grupo y, dentro, las tres columnas de estado con las cards de ese grupo.

- [ ] **Step 1: Reordenar el cálculo** — hoy: `filtrar por estado` → `agrupar`. Nuevo: `agrupar el conjunto completo` → dentro de cada grupo, `repartir por estado`. Así el grupo existe aunque todas sus tareas estén terminadas, y una card que cambia de estado se mueve de columna **sin salir de su carril**.
- [ ] **Step 2: Grupos estables** — el orden y la presencia de los carriles NO puede depender de cuántas cards tenga cada estado. Un grupo con todas las tareas terminadas sigue mostrándose (con sus columnas pend/proc vacías). Documentalo con un comentario en el código.
- [ ] **Step 3: Modo "ninguno"** — sin agrupar, el tablero renderiza exactamente como hoy (tres columnas planas). Verificá que el render sea idéntico al actual: es la ruta por defecto y no debe cambiar.
- [ ] **Step 4: Colapsar carriles** — cada carril con cabecera clicable que lo colapsa/expande, guardando el estado en `localStorage` vía `PREF` (patrón de `prefs.ts`, key `carriles-colapsados` con la lista de grupos colapsados). Es preferencia de vista pura.
- [ ] **Step 5: Arrastrar y soltar** — verificá que mover una card entre columnas DENTRO de un carril siga funcionando y que el drop calcule bien el estado destino. Probalo en el preview con el tablero agrupado por categoría.
- [ ] **Step 6: Gates + smoke visual + commit** — `fix(board): la agrupación deja de depender del estado — carriles por grupo`

---

### Task 9: Propuestas de adopción (item 5 — SOLO análisis, no implementar)

**El spec es explícito: no implementar nada de este punto. Esta task produce únicamente un documento.**

**Files:**
- Create: `docs/PROPUESTAS-ADOPCION.md`

- [ ] **Step 1: Analizar el problema real** — con 30 empleados, el riesgo no es que no entren al sistema: es que **el estado de las tareas quede desactualizado** y las métricas mientan. Leé `src/lib/alertas.ts`, `midia.ts`, `ociosidad.ts` y `notificaciones.ts` para saber qué señales ya existen.
- [ ] **Step 2: Proponer 8-10 mecanismos** de generación de hábito, **no invasivos**. Incluí sí o sí el ejemplo del usuario (tarea abierta más de 2 días → "¿Seguimos con esta tarea o ya la terminaste?" con botón para cerrarla en el momento) y ampliá con otros ángulos: rituales de inicio y fin de jornada, resúmenes personales de logro semanal, reconocimiento entre pares, valores por defecto inteligentes que reduzcan la fricción de actualizar, recordatorios contextuales en vez de genéricos, y hacer visible el costo de no actualizar (la métrica del equipo se distorsiona).
- [ ] **Step 3: Para cada propuesta** — problema que ataca, cómo funcionaría, esfuerzo, **riesgo de resultar invasiva o molesta** (columna obligatoria: una herramienta que fastidia se abandona), y qué datos existentes reutiliza.
- [ ] **Step 4: Cerrá con una recomendación** de las 3 a empezar y una advertencia honesta sobre las que podrían generar rechazo del equipo.
- [ ] **Step 5: Commit** — `docs(adopcion): propuestas para generar el hábito de uso diario`

---

### Task 10: Cierre de la Fase A

- [ ] **Step 1: Changelog 2.4.0** en `src/lib/version.ts`, en lenguaje de usuario y sin jerga: consultas desde tu perfil, tiempo máximo por tarea, ver quién está en línea, cerrar tu mes cuando terminás vos, dato de control, tablero agrupado en carriles. **No menciones** el usuario oculto (es administración interna).
- [ ] **Step 2: Gates completos** — `npx tsc -b && npx vitest run && npm run -s lint && npm run -s build`.
- [ ] **Step 3: `docs/PASOS-MANUALES.md` al día** — migración 29 sumada a la cola (26, 27, 28, 29) con el orden recomendado.
- [ ] **Step 4: Review final de rama** con el paquete completo de diff, con foco transversal: ¿el filtro de `esVisible` quedó aplicado en TODOS los puntos de lectura de personas? ¿los carriles no rompieron el drag and drop? ¿el cierre por persona convive con el semáforo? ¿algo de lo implementado se fue de foco hacia territorio ERP/Quiter?
- [ ] **Step 5: Fix de los hallazgos** en un solo subagente con la lista completa.
- [ ] **Step 6: Merge de `dev` a `main` y push** — presentando primero el resumen al usuario.

---

## Fases siguientes (documentadas, se planifican al terminar la A)

- **Fase B — Tier 1 completo (9 items):** E1 Mis arqueos, E5 Cierre del día, E8 aviso "vence hoy y es tuyo", J1 índice de retrabajo, J3 radar de vencimientos fiscales, J10 tendencia de diferencias de arqueo, T1 notificaciones en tiempo real, T2 partir el bundle, T5 activar el cron del resumen semanal.
- **Fase C — Tier 2 (sin E4) + Tier 3 (sin E7/E9) + revisión integral:** E3 calendario fiscal, E2 checklist cuantitativo, E6 traspaso al reemplazante, J4 comparador de sucursales, J5 curva de mejora individual, J6 delegaciones vivas, J7 impacto de licencias, J8 cierre en riesgo, T3 notificaciones por trigger, T6 mutaciones optimistas, T4 buscador full-text, J9 bus factor, T8 vista materializada. **T7 (Web Push) queda fuera hasta que se resuelva el `supabase login`.** Cierra con la revisión integral de arquitectura, escalabilidad, rendimiento, deuda técnica y redundancias que pide el spec.

---

## Self-Review

- **Cobertura del spec:** item 1 → Task 2; item 2 → Task 3; item 3 → Task 4; item 4 → Task 5; item 5 → Task 9 (solo análisis, como pide); item 6 → Task 6; item 7 → Task 7; item 8 → Task 8; esquema de todo → Task 1; release y revisión → Task 10. Tiers y revisión integral → Fases B y C, documentadas arriba. ✔
- **Foco del producto:** ninguna task de esta fase agrega funcionalidad de ERP. Las tres ideas que rozaban Quiter (cheques, conciliación, saldos de proveedores) quedaron explícitamente excluidas por el usuario y no aparecen en ninguna fase. ✔
- **Sin placeholders:** cada task define archivos exactos, firmas completas y reglas de cálculo; donde hace falta relevar antes (consumidores de personas, patrón del menú de perfil, policies de profiles), el paso lo indica como diagnóstico explícito con el comando a correr. ✔
- **Consistencia de tipos:** `esVisible` (Task 2) la consume `analisis.ts` y toda la UI; `estadoCierre` (existente) la consume Task 6; `Card.proc_at`/`tiempo_max_horas`/`dato_control` y `Profile.oculto`/`last_seen` se crean todos en Task 1 antes de cualquier consumidor. ✔
