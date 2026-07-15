# Plan 07 — Borrado Seguro de Empleados y Tareas Huérfanas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Checkbox steps.

**Goal:** Eliminar empleados con doble confirmación sin perder sus tareas: quedan "Sin asignar" y el jefe las reasigna desde una lista de huérfanas.

**Architecture:** Al eliminar un perfil, sus `cards` NO se borran: `owner` pasa a un valor centinela "sin asignar" (perfil especial o `owner` null + flag). Se elige **perfil centinela** `SIN_ASIGNAR` para no romper los FK ni la UI que asume `owner` válido. El borrado se hace vía Edge Function (privilegios), con doble confirmación en UI.

**Tech Stack:** Supabase (Edge Function + SQL), React.

## Global Constraints
- Requiere Plan 02 (para reasignar dentro de equipo). Borrado definitivo de usuario = acción sensible → doble validación fuerte.
- No perder datos: las cards se preservan.

---

### Task 1: Perfil centinela "Sin asignar"

**Files:**
- Create: `migracion-17-sin-asignar.sql`

- [ ] **Step 1: Migración**
```sql
-- Migración 17 — Centinela para tareas huérfanas
insert into public.profiles (id, name, role, email, puesto, ficha)
values ('00000000-0000-0000-0000-000000000000', 'Sin asignar', 'empleado', 'sin-asignar@interno', 'Reasignar', '')
on conflict (id) do nothing;
```
- [ ] **Step 2:** Constante `SIN_ASIGNAR_ID = "00000000-0000-0000-0000-000000000000"` en `src/lib/jerarquia.ts`. Excluir este perfil de listados de equipo/métricas (filtrar en `visiblesPara` y en la tabla de Admin salvo la sección huérfanas).
- [ ] **Step 3:** Commit — `git commit -m "feat(admin): perfil centinela Sin asignar para huérfanas (spec #14)"`

---

### Task 2: Edge Function de borrado seguro

**Files:**
- Create: `edge-function-eliminar-usuario.ts` (raíz; el usuario la despliega, patrón de `edge-function-crear-usuario.ts`)

**Interfaces:**
- Recibe `{ userId }`, verifica que el llamador sea jefe, reasigna cards a `SIN_ASIGNAR_ID`, borra el auth user y el profile.

- [ ] **Step 1:** Escribir la función (Deno): valida rol jefe del token; `update cards set owner = SIN_ASIGNAR where owner = userId`; `update objectives set owner = SIN_ASIGNAR where owner = userId`; `auth.admin.deleteUser(userId)`; `delete from profiles where id = userId`. Devolver `{ ok, reasignadas }`.
- [ ] **Step 2:** Documentar despliegue en `docs/FIX-EDGE-FUNCTION.md` (mismo flujo que crear-usuario). Commit — `git commit -m "feat(admin): edge function eliminar-usuario (reasigna a Sin asignar) (spec #14)"`

---

### Task 3: UI de borrado con doble confirmación + lista de huérfanas

**Files:**
- Modify: `src/features/admin/UserModal.tsx` (botón Eliminar con doble validación)
- Create: `src/features/admin/Huerfanas.tsx` (lista de cards con owner = SIN_ASIGNAR + reasignar)
- Modify: `src/features/admin/Admin.tsx` (montar Huerfanas para jefe)

- [ ] **Step 1: Doble confirmación** — en UserModal (solo jefe): botón "Eliminar empleado" → paso 1 pide escribir el nombre exacto del empleado para confirmar → paso 2 botón rojo "Eliminar definitivamente". Llama a la Edge Function. Test puro `confirmacionValida(nombreTipeado, nombreReal): boolean`.
- [ ] **Step 2: Lista de huérfanas** — `Huerfanas` lista `cards.filter(owner === SIN_ASIGNAR_ID)`; cada una con select de destino (cualquier empleado) → `update cards set owner`. Sección visible en Admin para jefe con contador.
- [ ] **Step 3:** FAIL→impl→PASS del helper. Build + smoke. Commit — `git commit -m "feat(admin): borrado con doble confirmación + reasignar huérfanas (spec #14)"`

## Self-review
- #14 completo: doble validación (T3), no se pierden tareas (T2 reasigna a centinela), lista de huérfanas (T3). Depende Plan 02 para el destino de reasignación.
