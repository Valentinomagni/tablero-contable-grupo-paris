# Plan 06 — Checklist ↔ Calendario + Recurrencia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Checkbox steps.

**Goal:** Una única fuente de verdad para tareas con fecha/recurrencia: aparecen en el calendario, generan sus ocurrencias del mes, y se completan indistintamente desde el checklist o el calendario. Incluye tareas diarias (arqueo de caja) con cumplimiento por día.

**Architecture:** El concepto central es la **tarea recurrente** modelada como un `card` con una regla de recurrencia (`recur_rule`) y una tabla de **ocurrencias** (`task_occurrences`) que es la fuente única de verdad del cumplimiento por fecha. El calendario lee/escribe ocurrencias; el "checklist" de cumplimiento diario también. Completar en cualquiera de los dos actualiza la MISMA fila de `task_occurrences`.

**Tech Stack:** Supabase, React, TanStack Query, vitest.

## Global Constraints
- Este es el plan más arquitectónico: revisar impacto antes de codear (lo pide la spec).
- Reutiliza `cards` (no duplica tareas). Las ocurrencias son livianas (fecha + done).
- Recurrencias soportadas: diaria, semanal (día de semana), mensual (día del mes). Copiado del alcance de la spec (jueves; arqueo diario; mensuales de cierre).

---

### Task 1: Migración — recurrencia y ocurrencias (única fuente de verdad)

**Files:**
- Create: `migracion-16-recurrencia.sql`

- [ ] **Step 1: Migración**
```sql
-- Migración 16 — Recurrencia y ocurrencias
-- Regla de recurrencia en la card (jsonb): { tipo: 'diaria'|'semanal'|'mensual', dias?: int[], diaMes?: int }
alter table public.cards add column if not exists recur_rule jsonb;

create table if not exists public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  owner uuid not null references public.profiles(id) on delete cascade,
  fecha date not null,
  done boolean not null default false,
  done_at timestamptz,
  unique (card_id, fecha)
);
alter table public.task_occurrences enable row level security;
create policy "occ propias o jefe" on public.task_occurrences for all using (
  owner = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('jefe','encargado')
             and (p.role='jefe' or exists (select 1 from public.profiles e where e.id=public.task_occurrences.owner and e.manager_id=p.id)))
) with check (owner = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='jefe'));
```
- [ ] **Step 2:** Aplicar. Tipos en `types.ts`: `recur_rule?: RecurRule | null` en `Card`; nueva interface `TaskOccurrence`. `RecurRule = { tipo: "diaria"|"semanal"|"mensual"; dias?: number[]; diaMes?: number }`.
- [ ] **Step 3:** Commit — `git commit -m "feat(recurrencia): migración recur_rule + task_occurrences (fuente única, spec #4/#11)"`

---

### Task 2: Generador puro de ocurrencias

**Files:**
- Create: `src/lib/recurrencia.ts`
- Create: `src/lib/recurrencia.test.ts`

**Interfaces:**
- Produces: `ocurrenciasDelMes(rule: RecurRule, year: number, month1a12: number): string[]` (fechas ISO).

- [ ] **Step 1: Tests**
```typescript
import { describe, it, expect } from "vitest";
import { ocurrenciasDelMes } from "./recurrencia";
describe("ocurrenciasDelMes", () => {
  it("diaria: todos los días del mes", () =>
    expect(ocurrenciasDelMes({ tipo: "diaria" }, 2026, 2).length).toBe(28));
  it("semanal jueves (dia 4) de julio 2026", () => // jul 2026: jueves 2,9,16,23,30
    expect(ocurrenciasDelMes({ tipo: "semanal", dias: [4] }, 2026, 7)).toEqual(
      ["2026-07-02","2026-07-09","2026-07-16","2026-07-23","2026-07-30"]));
  it("mensual día 20", () =>
    expect(ocurrenciasDelMes({ tipo: "mensual", diaMes: 20 }, 2026, 7)).toEqual(["2026-07-20"]));
});
```
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implementar** (usar `new Date(year, month-1, d)`, `getDay()` 0=dom→convertir a lun-based si hace falta; el test usa 4=jueves con getDay estándar donde 4=jueves). Cuidar zona: construir fecha local y formatear con `pad`.
- [ ] **Step 4: PASS.** Commit — `git commit -m "feat(recurrencia): generador puro de ocurrencias del mes + tests"`

---

### Task 3: Definir recurrencia en la tarea (CardModal)

**Files:**
- Modify: `src/features/board/CardModal.tsx`

- [ ] **Step 1:** Sección "Recurrencia": select tipo (ninguna/diaria/semanal/mensual) + (si semanal) checkboxes de días + (si mensual) input día. Guardar en `patch.mutate({ recur_rule })`.
- [ ] **Step 2:** Al guardar recurrencia con dueño y mes actual, materializar las ocurrencias del mes en `task_occurrences` (upsert por `unique(card_id,fecha)` → idempotente). Función `materializar(card, year, month)` que inserta las faltantes.
- [ ] **Step 3:** Test de `materializar` (qué filas faltan). Build + smoke. Commit — `git commit -m "feat(recurrencia): definir regla y materializar ocurrencias del mes (spec #4)"`

---

### Task 4: Ocurrencias en el Calendario + completar desde ahí (spec #12)

**Files:**
- Modify: `src/features/calendario/Calendario.tsx`
- Create: `src/hooks/useOccurrences.ts` (query `task_occurrences` del mes visible)

- [ ] **Step 1:** `useOccurrences(year, month)` trae las ocurrencias del rango. Mostrarlas en cada día de la grilla junto a los `announcements` (chip con checkbox).
- [ ] **Step 2:** En el modal del día, cada ocurrencia tiene checkbox → `update task_occurrences set done, done_at where id`. Esto es la fuente única: marca cumplimiento del día (arqueo de caja marcado desde el calendario, sin entrar al checklist — spec #12).
- [ ] **Step 3:** Build + smoke. Verificar visual. Commit — `git commit -m "feat(calendario): ocurrencias recurrentes + completar desde el calendario (spec #12)"`

---

### Task 5: Vista de cumplimiento diario del mes (spec #11)

**Files:**
- Create: `src/features/board/CumplimientoDiario.tsx` (grilla mes × done/no-done para una tarea diaria)
- Modify: `src/features/board/CardModal.tsx` (si `recur_rule.tipo === 'diaria'`, mostrar la grilla)

- [ ] **Step 1:** Componente que dado `card_id` y mes muestra los 28-31 días con estado (verde=hecho, gris=pendiente, rojo=pasado sin hacer) leídos de `task_occurrences`. Click en un día alterna `done`.
- [ ] **Step 2:** Mostrarlo en el CardModal de tareas diarias y/o en Mi Mes. Es la "solución escalable para registrar el cumplimiento diario durante todo el mes" de la spec.
- [ ] **Step 3:** Build + smoke. Commit — `git commit -m "feat(diarias): grilla de cumplimiento mensual (arqueo de caja) (spec #11)"`

---

### Task 6: Sincronía checklist ↔ calendario (fuente única)

**Files:**
- Modify: `src/features/board/CardModal.tsx` (el checklist de una tarea recurrente refleja `task_occurrences`, no un array aparte)

- [ ] **Step 1:** Para tareas recurrentes, el "checklist" del mes = las ocurrencias (misma tabla que el calendario). Completar un ítem del checklist = `update task_occurrences` → se refleja en el calendario y viceversa. UNA sola fuente de verdad (spec #4).
- [ ] **Step 2:** Test de que ambos caminos leen/escriben la misma fila (por `card_id+fecha`). Build + smoke + **e2e** (marcar desde calendario, verificar en checklist). Commit — `git commit -m "feat(recurrencia): checklist y calendario comparten task_occurrences (fuente única, spec #4)"`

## Self-review
- #4 (T3,T4,T6 — fuente única), #11 (T5 diarias), #12 (T4 completar desde calendario). Depende de Plan 05 (calendario con permisos) para el owner de las ocurrencias.
- Decisión arquitectónica clave: `task_occurrences` como única fuente de verdad — proponer al usuario antes de ejecutar (lo pide la spec en "mejoras arquitectónicas").
