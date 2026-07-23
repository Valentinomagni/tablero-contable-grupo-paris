# Spec 28-Correcciones — consolidar antes de seguir

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver definitivamente 8 comportamientos pendientes o mal interpretados, priorizando estabilidad y coherencia por sobre agregar módulos.

**Architecture:** Misma arquitectura (React 19 + TS + TanStack Query 5 + Supabase RLS). Dos decisiones tomadas por el usuario: el PDF se rehace con **vista de impresión dedicada** (sin librería); el modelo de datos de períodos (items 2+8) va con **documento de diseño y aprobación previa** antes de tocar la base.

**Tech Stack:** React 19, TypeScript, TanStack Query 5, Supabase (Postgres + RLS + pg_cron), vitest, GitHub Actions, Lucide.

## Global Constraints

- **Prioridad: consolidar, no agregar.** Estable, consistente, intuitivo, escalable, listo para producción.
- **Cero emojis**; estética monocroma; **español rioplatense (voseo)**.
- Migraciones 26-31 aplicadas salvo la 31 (pendiente del usuario). Trigger de notificaciones apagado. Escrituras de columnas nuevas por `payloadCards`/`payloadProfiles`.
- **TDD** para `src/lib/*`. Gates: `tsc -b` + vitest (pre-commit). Tests base: **736**.
- **Los deploys los hace el ejecutor** (push a `main`), no el usuario. Cada corrección: commit + verificación.
- **Todo respaldado**: cada tarea deja su rastro en commit y, donde aplique, documento.
- Changelog v2.8.0 antes del push final. Rama `dev`; merge a `main` en la task final.
- **Un solo subagente escribiendo por vez.**

---

### Task 1: PDF — vista de impresión dedicada (item 1)

**Decisión del usuario: vista dedicada, sin librería.** El `@media print` falló dos veces y es casi imposible de verificar.

**Files:** Create `src/features/reporte/ReportePrint.tsx`, `src/features/reporte/print.css`; Modify `src/features/reporte/Reporte.tsx`, `src/App.tsx` (ruta `/imprimir-reporte` o estado equivalente), `src/index.css` (limpiar el `@media print` viejo)

**Enfoque:** el botón "Imprimir / PDF" abre una **ventana/ruta limpia** que renderiza SOLO el contenido del reporte (los mismos datos ya calculados), sin `aside`, sin topbar, sin nav — un documento plano en flujo normal, con su propia hoja de estilos pensada para papel (A4, márgenes, sin fondos oscuros). Al montar, dispara `window.print()`; al terminar o cancelar, se cierra/vuelve. Como no hay armazón de app tapando nada, la causa raíz del blanco (contenido recortado por el layout con alturas fijas + overflow) desaparece.

- [ ] **Step 1: Relevar** exactamente qué se imprime hoy (bloques del Reporte + AnalisisMensual + Comparador) y qué datos necesita la vista de impresión. La vista NO recalcula: recibe por props/estado lo ya calculado, o reusa los mismos hooks en modo lectura.
- [ ] **Step 2:** `ReportePrint.tsx` — layout plano en bloque, tipografía para papel, encabezado con la marca (isotipo negro), sin ningún elemento `no-print`. `print.css` con `@page { size: A4; margin: 14mm }` y colores claros forzados.
- [ ] **Step 3:** Wiring — el botón del Reporte navega a la vista de impresión (ventana nueva con `window.open` a una ruta hash dedicada, o un estado `imprimiendo` que reemplaza todo el render). Al montar: `requestAnimationFrame` → `window.print()`. `onafterprint` → cerrar/volver.
- [ ] **Step 4: Limpiar** el `@media print` viejo de `index.css` y de `Reporte.tsx` que quedó sin efecto, para no dejar dos mecanismos peleando.
- [ ] **Step 5: Verificación** — smoke en preview: abrir la vista de impresión, confirmar por `read_page`/JS que el contenido está presente y visible (no `display:none`, no altura 0), y que no hay armazón de app. Documentar que la confirmación final "Imprimir → PDF" la hace el usuario (no simulable con fidelidad).
- [ ] **Step 6: Commit** — `fix(reporte): impresión y PDF con vista dedicada, sin depender de @media print`

---

### Task 2: Usuario fantasma — usuario propio e independiente (item 3)

**Corrección de interpretación:** no es una marca sobre Juan; es un usuario **aparte**, del dueño/desarrollador, invisible para todos.

**Files:** Create `edge-function-crear-fantasma.ts` o script SQL `migracion-32-usuario-fantasma.sql`; Modify `docs/PASOS-MANUALES.md`, `src/lib/visibilidad.ts` (reforzar), `src/features/admin/*` (que el jefe NO lo vea salvo… ver abajo)

**Interfaces/decisiones:**
- El fantasma es un auth user REAL (para no violar FKs), marcado `oculto = true`, con un email/username reservado (ej. `fantasma@grupoparis.com`). Se crea una sola vez.
- Invisible en TODOS lados: organigramas, equipos, búsquedas, métricas, estadísticas. `esVisible`/`cardsVisibles`/`archivesParaMetricas`/`enAlcanceDeMetricas` ya lo excluyen por `oculto`; verificá que NINGÚN listado se le escape (mismo relevamiento transversal que en la Fase A, pero ahora con un usuario real cargado).
- NO puede ser asignado como empleado: excluido de los selects de responsable/manager (ya lo está por `personasVisibles`, verificá).
- Se loguea como cualquiera (es un auth user), pero solo lo usa el dueño.

- [ ] **Step 1:** SQL/edge para crear el fantasma idempotente (si ya existe por email, no duplica). Documentá cómo se crea y con qué credenciales (que el usuario define).
- [ ] **Step 2:** Grep transversal de todos los consumidores de personas; confirmá exclusión con un usuario `oculto` REAL en los datos (no solo en tests). Tests de que no aparece en organigrama, equipo, buscador, métricas.
- [ ] **Step 3:** Que el fantasma tampoco cuente como "licencia visible" ni en conteos de dotación.
- [ ] **Step 4: Commit** — `feat(fantasma): usuario de administración y pruebas, invisible e independiente`

---

### Task 3: Consultas al buzón del fantasma (item 4)

**Files:** Modify `migracion-32-usuario-fantasma.sql` (o una 33), `src/lib/consultas.ts`, `src/features/consultas/*`, `src/hooks/useData.ts`

**Cambio:** hoy las consultas las lee `es_jefe()`. Deben ir al **fantasma** (buzón único de administración/pruebas), no a Juan ni a ningún jefe.

- [ ] **Step 1:** Ajustar la policy SELECT de `consultas`: en vez de `autor = auth.uid() or es_jefe()`, que sea `autor = auth.uid() or auth.uid() = <id del fantasma>`. Como el id del fantasma no es fijo (se identifica por email, patrón de "Sin asignar"), resolvé con una función `public.es_fantasma()` SECURITY DEFINER análoga a `es_jefe()`, que compare el email. La bandeja de consultas se muestra solo si `es_fantasma()`.
- [ ] **Step 2:** UPDATE (responder/archivar) también solo el fantasma.
- [ ] **Step 3:** La UI de la bandeja (`BandejaConsultas`) pasa de gatearse por rol jefe a gatearse por `es_fantasma()`. Cualquier empleado sigue pudiendo ENVIAR consultas (sin cambio).
- [ ] **Step 4:** Tests de la lógica de a quién se muestran; verificar que un jefe común ya NO ve la bandeja.
- [ ] **Step 5: Commit** — `fix(consultas): todas van al buzón del usuario fantasma, no al jefe`

---

### Task 4: Pantalla inicial carga el tablero (item 5)

**Files:** Modify `src/App.tsx` (y donde esté el estado inicial de vista/carga)

**Diagnóstico requerido:** hoy `const view = viewing || (esGestor ? "__resumen" : me.id)` — para un empleado ya debería ser su tablero. Reproducí el síntoma real ("vacío hasta apretar Mi tablero") antes de tocar: ¿es un empleado que ve su board vacío mientras cargan las cards? ¿es un gestor que cae en `__resumen` y espera su board? ¿es el `mode` inicial? Documentá la causa exacta.

- [ ] **Step 1: Reproducir** con cada rol (jefe, encargado, empleado) qué se ve al entrar. Anotar el estado exacto (`view`, `mode`, si `cards` cargó).
- [ ] **Step 2: Corregir** para que al autenticarse se cargue directo el tablero correspondiente sin estado intermedio vacío. Si el vacío es por carga de datos, mostrar un estado de carga real (no un tablero vacío que parece "sin tareas"). Si es por el default de vista, ajustar el default.
- [ ] **Step 3:** Verificar en preview con los 3 roles.
- [ ] **Step 4: Commit** — `fix(inicio): al entrar se carga el tablero del usuario, sin pantalla vacía`

---

### Task 5: Agrupación y orden por columna (item 7)

**Reemplaza los carriles de la Fase A.** El usuario quiere que **cada columna** administre su propia agrupación/orden/colapso, con un menú desplegable propio.

**Files:** Modify `src/features/board/Board.tsx`, `src/features/board/Carriles.tsx` (o reemplazarlo), `src/lib/agrupar.ts` + test, `src/lib/prefs.ts`; Create `src/features/board/ColumnaMenu.tsx`

**Interfaces:**
- Estado POR COLUMNA (pend/proc/term/operativa), persistido en `PREF` con clave por `(owner, columna)`: `{ agrupar: ModoAgrupar; orden: ModoOrden; colapsada: boolean }`.
- `ModoOrden = "az" | "za" | "prioridad" | "complejidad" | "fecha" | "tipo"`; `ordenarCards(cards, orden): Card[]` puro y testeado (complejidad = `effort`; fecha = `due_date`/`created_at`; tipo = `card_type`/categoría).
- `agrupar` por columna: ninguno / categoría / etiquetas (item 7 menciona ambas). Reusar `agruparCards`.
- Menú desplegable por columna (`ColumnaMenu`) con: ordenar A-Z, Z-A, prioridad, complejidad, fecha, tipo; agrupar por categoría, por etiquetas; y colapsar/expandir la columna.

- [ ] **Step 1: Tests** de `ordenarCards` (los 6 modos + estabilidad) y de que el estado por columna es independiente (colapsar "Terminadas" no toca "Pendientes").
- [ ] **Step 2:** `prefs.ts` — clave por columna; migrar/limpiar la key global de carriles anterior.
- [ ] **Step 3:** `ColumnaMenu` + wiring en Board: cada columna renderiza su menú y aplica SU estado. El tablero deja de tener un modo de agrupación global.
- [ ] **Step 4:** Verificar drag&drop entre columnas con distintos estados de agrupación/orden; que mover una card no rompa el estado de las columnas.
- [ ] **Step 5: Commit** — `feat(board): agrupación, orden y colapso independientes por columna`

---

### Task 6: Automatizar el mantenimiento (item 6)

**Files:** Create `.github/workflows/` (jobs nuevos), `.github/dependabot.yml`; Modify `docs/PASOS-MANUALES.md`

Automatizar todo lo que no dependa de credenciales/aprobaciones externas:
- **Dependabot** (o Renovate) para actualizaciones de dependencias con PR automático.
- CI ya corre lint+test+build; agregar **type-check explícito** (`tsc -b`) y el **e2e** si no está en el pipeline principal, y el **smoke de RLS** como job (necesita secrets → queda documentado como el único paso manual).
- **Análisis estático**: sumar `knip` (dead code, ya está como script) y `oxlint` al CI si no están.
- Documentar qué quedó automático y qué sigue siendo manual por depender de credenciales (auth GitHub, tokens, aprobaciones).

- [ ] **Step 1:** `dependabot.yml` para npm, semanal, agrupado.
- [ ] **Step 2:** Ampliar el workflow: type-check, knip, (e2e/rls-smoke gateados por secrets, documentados).
- [ ] **Step 3:** YAML válido, no romper el CI existente. Documentar el estado de automatización.
- [ ] **Step 4: Commit** — `ci: automatizar mantenimiento (dependabot, type-check, análisis estático)`

---

### Task 7: DISEÑO del modelo de períodos y ejecuciones (items 2 + 8) — GATE

**Decisión del usuario: diseño primero, con su OK antes de implementar.** NO se toca la base en esta task.

**Files:** Create `docs/PROPUESTA-PERIODOS.md`

Cubrir de una sola vez los items 2 (recurrencia diaria conserva su propio checklist/observaciones/evidencia por ejecución) y 8 (períodos de trabajo por empleado: varios meses abiertos, cada uno con sus tareas/checklist/estados/observaciones/tiempos/indicadores/evidencia, sin pisarse), porque comparten la misma raíz: **hoy hay UNA card con UN checklist/estado mutable, y ambos requieren instancias independientes por período/ejecución.**

- [ ] **Step 1: Relevar** el modelo actual: `cards`, `task_occurrences` (migración 16/23), `cards_archive` (snapshot mensual), `cierre_periodos` (Fase A), la navegación por mes del Cierre. Entender qué ya existe y qué no.
- [ ] **Step 2: Diseñar** cómo cada período/ejecución guarda lo suyo sin sobrescribir: opciones (ej. checklist/observaciones migran a `task_occurrences` por fecha; períodos como instancias de card por mes; selector de período en el perfil del empleado tipo el del calendario). Con ventajas, desventajas, esfuerzo, impacto en migraciones y en las métricas existentes.
- [ ] **Step 3: Recomendación** clara + qué vería el empleado en pantalla (selector de períodos Junio/Julio/Agosto en su perfil, cada uno con su estado independiente).
- [ ] **Step 4:** Presentar al usuario. **NO implementar hasta su OK.** La implementación es un spec aparte.
- [ ] **Step 5: Commit** — `docs(periodos): propuesta de modelo de períodos y ejecuciones independientes`

---

### Task 8: Cierre — estado, changelog 2.8.0, review, deploy

- [ ] **Step 1:** `docs/ESTADO-DEL-PROYECTO.md` al día con lo que se resolvió en este spec.
- [ ] **Step 2:** Changelog 2.8.0 en lenguaje de usuario (PDF que funciona, consultas al buzón de admin, entrar directo al tablero, agrupar y ordenar cada columna a tu gusto).
- [ ] **Step 3:** Gates completos (`tsc -b`, vitest, lint, build).
- [ ] **Step 4:** Review final transversal: ¿el PDF nuevo no dejó el viejo peleando? ¿el fantasma no aparece en ningún lado? ¿las consultas ya no las ve el jefe? ¿el estado por columna es realmente independiente? ¿algo se fue de foco?
- [ ] **Step 5:** Fix de hallazgos en un solo subagente.
- [ ] **Step 6:** Merge `dev` → `main` y **deploy (lo hago yo)**. Resumen al usuario con lo hecho y lo que queda (períodos, esperando su OK del diseño).

---

## Self-Review

- **Cobertura:** item 1 → T1; item 2 → T7 (diseño, luego implementación aparte); item 3 → T2; item 4 → T3; item 5 → T4; item 6 → T6; item 7 → T5; item 8 → T7. ✔
- **Decisiones del usuario respetadas:** PDF con vista dedicada (T1); períodos con diseño+gate (T7). ✔
- **Correcciones de interpretación reconocidas:** fantasma (T2, usuario real aparte), agrupación (T5, por columna). ✔
- **Sin placeholders:** los items con diagnóstico pendiente (PDF, login) tienen un paso explícito de reproducción antes de tocar. ✔
