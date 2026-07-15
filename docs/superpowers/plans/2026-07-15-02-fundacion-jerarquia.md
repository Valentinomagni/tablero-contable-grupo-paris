# Plan 02 — Fundación Jerárquica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Modelar la estructura de la empresa (encargado→empleados y marca) para habilitar resúmenes, permisos y organigrama jerárquicos.

**Architecture:** Se agregan dos columnas a `profiles`: `manager_id` (a quién responde) y `marca` (subequipo). RLS se amplía para que un encargado vea/gestione a su equipo. Toda la lógica de "quién está a cargo de quién" vive en `src/lib/jerarquia.ts` (pura, testeable), consumida por los planes 3/4/5/7.

**Tech Stack:** Supabase (Postgres + RLS), React, TanStack Query, vitest.

## Global Constraints
- Migraciones en la raíz `migracion-N-*.sql`, las aplica el usuario.
- Cambios aditivos: `manager_id` y `marca` son NULLABLE → no rompe datos existentes.
- Marcas válidas: **Peugeot, Citroën, Chevrolet, Honda** (copiado de la spec).

---

### Task 1: Migración — columnas de jerarquía + RLS

**Files:**
- Create: `migracion-14-jerarquia.sql`

**Interfaces:**
- Produces: `profiles.manager_id uuid null references profiles(id)`, `profiles.marca text null`.

- [ ] **Step 1: Escribir la migración**
```sql
-- Migración 14 — Estructura jerárquica
alter table public.profiles add column if not exists manager_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists marca text; -- Peugeot | Citroën | Chevrolet | Honda

-- Un encargado puede LEER los profiles de su equipo (además de lo que ya permita su policy).
drop policy if exists "encargado ve su equipo" on public.profiles;
create policy "encargado ve su equipo" on public.profiles for select
  using (
    manager_id = auth.uid()               -- mis reportes directos
    or id = auth.uid()                     -- yo mismo
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'jefe')
  );

-- Un encargado puede ACTUALIZAR (reasignar) las cards cuyos dueños son de su equipo.
drop policy if exists "encargado gestiona cards de su equipo" on public.cards;
create policy "encargado gestiona cards de su equipo" on public.cards for update
  using (
    owner = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'jefe')
    or exists (select 1 from public.profiles e where e.id = auth.uid() and e.role = 'encargado'
               and exists (select 1 from public.profiles emp where emp.id = public.cards.owner and emp.manager_id = e.id))
  );
```
- [ ] **Step 2: Entregar al usuario para aplicar** en Supabase SQL Editor. Documentar en `docs/DATABASE.md` (si existe en v2) o crear nota. No hay test automatizable de RLS acá; se valida manualmente (Step 4).
- [ ] **Step 3: Actualizar tipos** — `src/lib/types.ts`, interface `Profile`: agregar `manager_id: string | null; marca: string | null;`. Y `CardSchema`/`Profile` en `schemas.ts` si se valida profiles.
- [ ] **Step 4: Verificación manual** — con un encargado de prueba: ve su ficha + reportes; NO ve otros equipos. Con jefe: ve todo. Documentar el resultado.
- [ ] **Step 5: Commit** — `git add migracion-14-jerarquia.sql src/lib/types.ts && git commit -m "feat(jerarquia): migración manager_id + marca + RLS de equipo (base planes 3/4/5/7)"`

---

### Task 2: Lógica pura de jerarquía

**Files:**
- Create: `src/lib/jerarquia.ts`
- Create: `src/lib/jerarquia.test.ts`

**Interfaces:**
- Produces:
  - `reportesDirectos(managerId: string, profiles: Profile[]): Profile[]`
  - `equipoDe(managerId: string, profiles: Profile[]): Profile[]` (subárbol completo, recursivo)
  - `visiblesPara(me: Profile, profiles: Profile[]): Profile[]` (empleado=solo él; encargado=él+equipo; jefe=todos)
  - `porMarca(profiles: Profile[]): Record<string, Profile[]>`

- [ ] **Step 1: Escribir tests primero** — `src/lib/jerarquia.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { reportesDirectos, equipoDe, visiblesPara, porMarca } from "./jerarquia";
import type { Profile } from "./types";
const p = (id: string, role: Profile["role"], manager_id: string | null = null, marca: string | null = null): Profile =>
  ({ id, name: id, role, email: "", puesto: "", ficha: "", manager_id, marca });
const team = [
  p("jefe", "jefe"), p("enc", "encargado", "jefe", "Peugeot"),
  p("e1", "empleado", "enc", "Peugeot"), p("e2", "empleado", "enc", "Peugeot"),
  p("enc2", "encargado", "jefe", "Honda"), p("e3", "empleado", "enc2", "Honda"),
];
describe("reportesDirectos", () => {
  it("solo los reportes directos", () =>
    expect(reportesDirectos("enc", team).map(x => x.id)).toEqual(["e1", "e2"]));
});
describe("equipoDe", () => {
  it("incluye subárbol", () =>
    expect(equipoDe("jefe", team).map(x => x.id).sort()).toEqual(["e1", "e2", "e3", "enc", "enc2"]));
});
describe("visiblesPara", () => {
  it("empleado ve solo a sí mismo", () =>
    expect(visiblesPara(team[2], team).map(x => x.id)).toEqual(["e1"]));
  it("encargado ve a sí y su equipo", () =>
    expect(visiblesPara(team[1], team).map(x => x.id).sort()).toEqual(["e1", "e2", "enc"]));
  it("jefe ve a todos", () =>
    expect(visiblesPara(team[0], team).length).toBe(6));
});
describe("porMarca", () => {
  it("agrupa por marca", () =>
    expect(Object.keys(porMarca(team)).sort()).toEqual(["Honda", "Peugeot"]));
});
```
- [ ] **Step 2: Correr → FAIL** (`npx vitest run src/lib/jerarquia.test.ts`).
- [ ] **Step 3: Implementar `src/lib/jerarquia.ts`**
```typescript
import type { Profile } from "./types";
export function reportesDirectos(managerId: string, profiles: Profile[]): Profile[] {
  return profiles.filter((p) => p.manager_id === managerId);
}
export function equipoDe(managerId: string, profiles: Profile[]): Profile[] {
  const out: Profile[] = [];
  const walk = (id: string) => reportesDirectos(id, profiles).forEach((r) => { out.push(r); walk(r.id); });
  walk(managerId);
  return out;
}
export function visiblesPara(me: Profile, profiles: Profile[]): Profile[] {
  if (me.role === "jefe") return profiles;
  if (me.role === "encargado") return [me, ...equipoDe(me.id, profiles)];
  return [me];
}
export function porMarca(profiles: Profile[]): Record<string, Profile[]> {
  const m: Record<string, Profile[]> = {};
  for (const p of profiles) if (p.marca) (m[p.marca] ??= []).push(p);
  return m;
}
```
- [ ] **Step 4: Verde** (`npx vitest run src/lib/jerarquia.test.ts` → PASS).
- [ ] **Step 5: Commit** — `git commit -m "feat(jerarquia): lib pura reportes/equipo/visibles/porMarca + tests"`

---

### Task 3: Asignar manager y marca desde Admin/UserModal

**Files:**
- Modify: `src/features/admin/UserModal.tsx` (agregar selects "Responde a" y "Marca")
- Modify: `src/features/admin/Admin.tsx` (form crear usuario: marca opcional)

**Interfaces:**
- Consumes: `team` (lista de posibles managers = encargados y jefes), `porMarca`.

- [ ] **Step 1: UI en UserModal** — dos selects: "Responde a" (opciones = perfiles con role encargado/jefe, distintos de sí mismo; guarda `manager_id`) y "Marca" (Peugeot/Citroën/Chevrolet/Honda o "—"). Al cambiar → `update profiles set manager_id/marca`. Reusar el patrón de mutación existente del UserModal.
- [ ] **Step 2: Guard anti-ciclo** — no permitir asignarse a sí mismo ni a un subordinado como manager (usar `equipoDe(me.id)` para excluir). Test de la validación en `jerarquia.ts`: `puedeSerManager(candidatoId, empleadoId, profiles): boolean`.
- [ ] **Step 3: FAIL → implementar → PASS.** Build + smoke.
- [ ] **Step 4: Commit** — `git commit -m "feat(admin): asignar responsable (manager) y marca por usuario (spec base #9/#7)"`

## Self-review
- Habilita planes 3 (visiblesPara), 4 (porMarca), 5 (equipoDe para calendario), 7 (huérfanas por equipo).
- Marcas exactas de la spec. RLS aditiva y nullable → sin regresión.
