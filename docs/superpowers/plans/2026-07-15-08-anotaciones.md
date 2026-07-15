# Plan 08 — Anotaciones Personales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Checkbox steps.

**Goal:** Bloc de notas privado por usuario (ideas/pendientes que aún no son tareas), sin afectar tablero, métricas ni calendario. Con búsqueda, orden, archivar y convertir a tarea en un clic.

**Architecture:** Nueva tabla `notes` con RLS estricta (owner-only). Nueva vista `__notas`. Independiente del resto del sistema (no toca cards/métricas). Convertir-a-tarea reutiliza el insert de `cards`.

**Tech Stack:** Supabase, React, TanStack Query, vitest.

## Global Constraints
- Privado: cada usuario solo ve/edita lo suyo (RLS). No aparece en tablero/calendario/métricas.
- UI simple tipo bloc de notas. Módulo autónomo (no depende de otros planes).

---

### Task 1: Migración — tabla notes

**Files:**
- Create: `migracion-18-notas.sql`

- [ ] **Step 1: Migración**
```sql
-- Migración 18 — Anotaciones personales
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notes enable row level security;
create policy "notas solo del dueño" on public.notes for all
  using (owner = auth.uid()) with check (owner = auth.uid());
```
- [ ] **Step 2:** Aplicar. Tipo `Note` en `types.ts`: `{ id; owner; title; body; archived; created_at; updated_at }`.
- [ ] **Step 3:** Commit — `git commit -m "feat(notas): migración tabla notes con RLS owner-only (spec #19)"`

---

### Task 2: Hook + lógica de listado (búsqueda y orden)

**Files:**
- Create: `src/hooks/useNotes.ts` (query + realtime opcional)
- Create: `src/lib/notas.ts` + `src/lib/notas.test.ts`

**Interfaces:**
- Produces: `filtrarOrdenar(notas, q, orden): Note[]` — `orden: "creado"|"modificado"`.

- [ ] **Step 1: Tests**
```typescript
import { describe, it, expect } from "vitest";
import { filtrarOrdenar } from "./notas";
const n = (id:string, title:string, body:string, c:string, u:string) =>
  ({ id, owner:"u", title, body, archived:false, created_at:c, updated_at:u });
const notas = [n("a","IVA","revisar", "2026-07-01","2026-07-10"), n("b","banco","conciliar","2026-07-05","2026-07-05")];
describe("filtrarOrdenar", () => {
  it("busca en título y cuerpo", () =>
    expect(filtrarOrdenar(notas,"conc","creado").map(x=>x.id)).toEqual(["b"]));
  it("ordena por última modificación desc", () =>
    expect(filtrarOrdenar(notas,"","modificado").map(x=>x.id)).toEqual(["a","b"]));
});
```
- [ ] **Step 2: FAIL → implementar → PASS.** (excluye archivadas salvo toggle "ver archivadas").
- [ ] **Step 3:** `useNotes` con `select * from notes order by updated_at desc`. Commit — `git commit -m "feat(notas): hook + búsqueda/orden con tests (spec #19)"`

---

### Task 3: Vista Anotaciones

**Files:**
- Create: `src/features/notas/Notas.tsx`
- Modify: `src/App.tsx` (vista `__notas`, título "Anotaciones")
- Modify: `src/components/Shell.tsx` (NavItem "Anotaciones" ícono `StickyNote`, en "Mi espacio" y "General")

- [ ] **Step 1:** UI tipo bloc: lista a la izquierda (título + fecha), editor a la derecha (título + textarea `body` con autosave onBlur → update `updated_at`). Barra de búsqueda arriba. Botón "Nueva nota", "Archivar", "Eliminar" (con confirmación inline). Toggle "ver archivadas".
- [ ] **Step 2:** Disponible para TODOS los roles (cada uno el suyo). Agregar a CommandPalette ("Nueva anotación").
- [ ] **Step 3:** Verificar visual `shot-view "Anotaciones"`. Build + smoke. Commit — `git commit -m "feat(notas): vista bloc de notas privado (spec #19)"`

---

### Task 4: Convertir anotación en tarea

**Files:**
- Modify: `src/features/notas/Notas.tsx`

- [ ] **Step 1:** Botón "Convertir en tarea" → inserta un `card` (`owner: me.id, title: note.title || primeras palabras del body, description: note.body, status: "pend"`) y opcionalmente archiva la nota. Reutiliza el insert de cards (patrón de Board `add`).
- [ ] **Step 2:** `toast.success("Creada en tu tablero")`. Test del mapeo `notaATarea(note, ownerId)` (título/desc). Build + smoke. Commit — `git commit -m "feat(notas): convertir anotación en tarea del tablero en un clic (spec #19)"`

## Self-review
- #19 completo: privado (RLS T1), CRUD+archivar (T3), búsqueda+orden (T2), convertir a tarea (T4). No toca métricas/calendario. Módulo independiente.
