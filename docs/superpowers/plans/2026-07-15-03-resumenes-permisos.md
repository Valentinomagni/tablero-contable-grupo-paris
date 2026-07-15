# Plan 03 — Resúmenes y Permisos Jerárquicos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Checkbox steps.

**Goal:** Que Resumen y Reporte muestren el alcance correcto según rol (empleado=solo él, encargado=su equipo, jefe=todo) y que el Encargado tenga un panel de administración acotado.

**Architecture:** Se reutilizan `Resumen`, `Reporte` y `Admin` existentes, filtrando `team`/`cards` con `visiblesPara(me, profiles)` del Plan 02. El Encargado obtiene una versión limitada de `Admin` (reasignar dentro de su equipo, sin permisos globales).

**Tech Stack:** React, TanStack Query, lib/jerarquia (Plan 02).

## Global Constraints
- Requiere Plan 02 aplicado (`manager_id`, `visiblesPara`, RLS).
- Cero regresión para jefe (hoy ve todo → debe seguir viendo todo).

---

### Task 1: Alcance del equipo por rol en App

**Files:**
- Modify: `src/App.tsx` (cálculo de `fullTeam` y navegación, ~37-42, 71-73)
- Modify: `src/hooks/useData.ts` (`useTeam` hoy `enabled: isJefe` — habilitarlo también para encargado)

**Interfaces:**
- Consumes: `visiblesPara(me, allProfiles)`.
- Produces: `fullTeam` = personas visibles para `me` (no solo jefe).

- [ ] **Step 1:** `useTeam` pasa a `enabled: me.role !== "empleado"` (jefe y encargado traen profiles; RLS del Plan 02 ya limita lo que ve el encargado). Empleado sigue con `[me]`.
- [ ] **Step 2:** en `App.tsx`, `const isJefe = me?.role === "jefe"; const esEncargado = me?.role === "encargado";` y `const fullTeam = visiblesPara(me, team)` cuando `team` disponible, si no `[me]`.
- [ ] **Step 3:** habilitar navegación de Resumen/Reporte para encargado (hoy el sidebar sólo muestra "General" a jefe). Mostrar los ítems "Resumen"/"Reporte"/"Cierre" también a encargado, con `fullTeam` = su equipo.
- [ ] **Step 4:** Build + smoke (loguear como encargado en smoke — agregar credencial si existe). Commit — `git commit -m "feat(permisos): alcance de equipo por rol (empleado/encargado/jefe) en App"`

---

### Task 2: Resumen y Reporte respetan el alcance (spec #5, #10)

**Files:**
- Modify: `src/features/resumen/Resumen.tsx` (ya recibe `team`/`cards` por props → alcanza con pasar el `fullTeam` filtrado)
- Modify: `src/features/reporte/Reporte.tsx` (idem)

**Interfaces:**
- Consumes: `fullTeam` (ya filtrado en App). `cards` debe filtrarse a los dueños visibles.

- [ ] **Step 1: Helper** — `cardsDeEquipo(cards, team): Card[]` en jerarquia.ts: `cards.filter(c => team.some(u => u.id === c.owner))`. Test.
- [ ] **Step 2: FAIL → implementar → PASS.**
- [ ] **Step 3:** en App, pasar `cardsDeEquipo(cards, fullTeam)` a Resumen/Reporte para no-jefe. Jefe pasa todas.
- [ ] **Step 4:** Verificar: empleado ve solo su rendimiento (Resumen ya muestra su tablero; el ítem Resumen del equipo no aparece para empleado). Encargado ve su equipo. Jefe ve todo. Build + smoke. Commit — `git commit -m "feat(resumen): alcance por rol en Resumen y Reporte (spec #5,#10)"`

---

### Task 3: Panel Administración limitado para Encargado (spec #9)

**Files:**
- Modify: `src/features/admin/Admin.tsx` (recibir `me` y renderizar acotado)
- Create: `src/features/admin/ReasignarModal.tsx` (reasignar tarea a otro miembro del equipo)

**Interfaces:**
- Encargado puede: ver su equipo, reasignar tareas dentro del equipo. NO puede: permisos globales, crear/editar usuarios de otros equipos, parámetros globales.

- [ ] **Step 1:** `Admin` recibe `me: Profile`. Si `me.role === "encargado"`: ocultar secciones "Permisos", "Parámetros de la plataforma", "Respaldo" y "Crear usuario"; mostrar solo la tabla de SU equipo (`equipoDe(me.id, team)`) y la acción "Reasignar tareas".
- [ ] **Step 2:** `ReasignarModal` — elegir empleado origen → lista sus cards abiertas → elegir empleado destino (del equipo) → `update cards set owner = destino` (RLS del Plan 02 lo permite). Reusar patrón de mutación.
- [ ] **Step 3:** Test de `puedeReasignar(me, cardOwner, destino, profiles)` en jerarquia.ts (ambos deben estar en `equipoDe(me.id)` si encargado). FAIL → implementar → PASS.
- [ ] **Step 4:** Sidebar: mostrar "Administración" también a encargado (Plan 03 Task1 ya abre General). Build + smoke. Commit — `git commit -m "feat(encargado): panel Admin acotado + reasignar tareas del equipo (spec #9)"`

## Self-review
- #5 (T2), #10 (T2), #9 (T3). Depende de Plan 02. Sin permisos globales para encargado (chequeado en T3).
