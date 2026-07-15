# Plan 04 — Organigrama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Checkbox steps.

**Goal:** Módulo visual que muestre la estructura de la empresa: quién responde a quién, por marca (Peugeot/Citroën/Chevrolet/Honda), con responsables y carga.

**Architecture:** Nueva vista `__organigrama` (patrón idéntico a las otras vistas de `App.tsx`). Render de árbol jerárquico en SVG/HTML a partir de `manager_id` (Plan 02), agrupado por `marca`. Reutiliza `jerarquia.ts` y `Avatar`.

**Tech Stack:** React, SVG/flexbox, lib/jerarquia (Plan 02).

## Global Constraints
- Requiere Plan 02 (`manager_id`, `marca`, `equipoDe`, `porMarca`).
- Solo lectura. Visible para jefe (y encargado ve su subárbol). Monocromo; color solo para separar marcas si aporta.

---

### Task 1: Lógica de árbol

**Files:**
- Modify: `src/lib/jerarquia.ts` (agregar `construirArbol`)
- Modify: `src/lib/jerarquia.test.ts`

**Interfaces:**
- Produces: `type NodoOrg = { profile: Profile; hijos: NodoOrg[] }`; `construirArbol(raizId | null, profiles): NodoOrg[]` (raíces = quienes no tienen manager o cuyo manager no está visible).

- [ ] **Step 1: Test** — dado el `team` del Plan 02, `construirArbol(null, team)` arma jefe→[enc→[e1,e2], enc2→[e3]]. Verificar `hijos` y profundidad.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementar**
```typescript
export interface NodoOrg { profile: Profile; hijos: NodoOrg[]; }
export function construirArbol(profiles: Profile[]): NodoOrg[] {
  const idset = new Set(profiles.map(p => p.id));
  const hijosDe = (id: string | null): NodoOrg[] =>
    profiles.filter(p => (p.manager_id ?? null) === id || (id === null && (p.manager_id === null || !idset.has(p.manager_id!))))
      .map(p => ({ profile: p, hijos: hijosDe(p.id) }));
  // raíces: manager null o fuera del set
  const raices = profiles.filter(p => p.manager_id === null || !idset.has(p.manager_id));
  return raices.map(p => ({ profile: p, hijos: hijosDe(p.id) }));
}
```
- [ ] **Step 4: PASS.** Commit — `git commit -m "feat(organigrama): lib construirArbol + tests"`

---

### Task 2: Vista Organigrama

**Files:**
- Create: `src/features/organigrama/Organigrama.tsx`
- Modify: `src/App.tsx` (agregar caso `__organigrama`, título, exclusión de isPersonView)
- Modify: `src/components/Shell.tsx` (NavItem "Organigrama" con ícono `Network` de lucide)

**Interfaces:**
- Consumes: `team` (fullTeam), `cards` (para mostrar carga por persona), `construirArbol`, `porMarca`.

- [ ] **Step 1:** Componente `Organigrama` que:
  - Agrupa por marca con `porMarca(team)`; una sección por marca (Peugeot/Citroën/Chevrolet/Honda) + una "Sin marca".
  - Dentro de cada marca, renderiza el árbol (`construirArbol` filtrado a esa marca) como tarjetas anidadas con líneas conectoras (flexbox column, sangría por nivel; o SVG simple).
  - Cada nodo: `Avatar`, nombre, rol, puesto, y contador de tareas abiertas (`cards.filter(owner===id && status!==term).length`).
- [ ] **Step 2:** Wire en App + Shell (patrón idéntico a "Cierre mensual" del commit 0291765). Agregar a CommandPalette.
- [ ] **Step 3:** Verificar visual con `shot-view "Organigrama" dark` y `light`. (Requiere datos: pedir al usuario cargar manager_id/marca de prueba, o cargar en la base de test.)
- [ ] **Step 4:** Build + smoke (agregar "Organigrama" a `scripts/smoke.mjs` vistas). Commit — `git commit -m "feat(organigrama): vista de estructura por marca y jerarquía (spec #7)"`

## Self-review
- #7 completo. Marcas exactas. Depende de Plan 02. Encargado ve su subárbol (pasar `fullTeam` ya filtrado).
