# Plan 05 — Calendario con Permisos Jerárquicos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Checkbox steps.

**Goal:** Que todos puedan crear eventos; visibilidad según rol (empleado=propios, encargado=equipo, jefe=todos) y con destinatarios manuales para coordinar entre áreas.

**Architecture:** `announcements` gana `owner_id` (quién lo creó, uuid) y `visible_to uuid[]` (destinatarios manuales extra). RLS de SELECT combina rol + equipo + `visible_to`. El componente `Calendario` deja de estar limitado a jefe para crear.

**Tech Stack:** Supabase RLS, React, lib/jerarquia (Plan 02).

## Global Constraints
- Requiere Plan 02 (`manager_id`, `equipoDe`).
- `announcements` hoy tiene `created_by` (NOMBRE, no uuid). Se agrega `owner_id` uuid sin romper lo existente.

---

### Task 1: Migración — visibilidad de eventos

**Files:**
- Create: `migracion-15-calendario-permisos.sql`

- [ ] **Step 1: Migración**
```sql
-- Migración 15 — Visibilidad de eventos de calendario
alter table public.announcements add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.announcements add column if not exists visible_to uuid[] default '{}';

-- Todos pueden insertar sus eventos (owner_id = auth.uid()).
drop policy if exists "crear evento propio" on public.announcements;
create policy "crear evento propio" on public.announcements for insert with check (owner_id = auth.uid() or owner_id is null);

-- SELECT por rol/equipo/destinatario:
drop policy if exists "ver eventos segun rol" on public.announcements;
create policy "ver eventos segun rol" on public.announcements for select using (
  owner_id = auth.uid()                                   -- propios
  or auth.uid() = any(visible_to)                         -- me lo compartieron
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'jefe')  -- jefe: todos
  or exists (select 1 from public.profiles e where e.id = auth.uid() and e.role = 'encargado'
             and exists (select 1 from public.profiles emp where emp.id = public.announcements.owner_id and emp.manager_id = e.id)) -- encargado: su equipo
  or owner_id is null                                     -- eventos legacy (jefe cargó sin owner) siguen visibles
);
```
- [ ] **Step 2:** Aplicar en Supabase. Actualizar `Announcement` en `types.ts`: `owner_id: string | null; visible_to: string[];`.
- [ ] **Step 3:** Verificación manual (empleado ve solo lo suyo/compartido; encargado su equipo; jefe todo). Commit — `git commit -m "feat(calendario): migración owner_id + visible_to + RLS por rol (spec #6)"`

---

### Task 2: Crear eventos con destinatarios (todos los roles)

**Files:**
- Modify: `src/features/calendario/Calendario.tsx` (quitar el gate `isJefe` para crear; agregar selector de destinatarios)
- Modify: `src/App.tsx` (pasar `me` completo al Calendario, hoy pasa `isJefe`/`meName`)

**Interfaces:**
- Consumes: `me: Profile`, `team` (para elegir destinatarios manuales).

- [ ] **Step 1:** `Calendario` recibe `me` y `team`. El formulario "Agregar evento" se muestra a TODOS. Al insertar: `owner_id: me.id, created_by: me.name`.
- [ ] **Step 2:** Selector multi de "Compartir con" (checkboxes de `team`, patrón del `DelegarModal`) → `visible_to: [...ids]`. Permite elegir personas de otras áreas (la lista es todo el `team` visible; un jefe ve todos).
- [ ] **Step 3:** Borrar evento: permitir al `owner_id === me.id` o jefe (hoy solo jefe). Ajustar el botón papelera.
- [ ] **Step 4:** Build + smoke. Verificar visual. Commit — `git commit -m "feat(calendario): todos crean eventos + destinatarios manuales (spec #6)"`

## Self-review
- #6 completo: crear (todos), visibilidad por rol (RLS), destinatarios manuales cross-área (visible_to). Depende Plan 02.
- Eventos legacy (owner_id null) siguen visibles → sin regresión.
