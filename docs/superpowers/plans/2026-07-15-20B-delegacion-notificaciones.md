# Plan 20B — Delegación Universal y Centro de Notificaciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Checkbox steps.

**Goal:** Que cualquier usuario pueda delegar una tarea con trazabilidad completa (#4), y un centro de notificaciones inteligente y relevante por rol, sin ruido (#8).

**Architecture:** #4 amplía la RLS de `cards` para permitir crear una tarjeta delegada a otro dueño registrando quién/cuándo (reutiliza el modelo de tareas compartidas ya existente `lib/shared.ts`). #8 agrega una tabla `notifications` (owner, tipo, payload, leída) escrita por la app en eventos clave + notificaciones derivadas en cliente desde datos existentes; una campana en el topbar con contador y panel. Reutiliza `Modal`, `Avatar`, tokens.

**Tech Stack:** Supabase (RLS + tabla + realtime), React, TanStack Query, vitest.

## Global Constraints
- Node portable: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`.
- Cero emojis (solo Lucide). Monocromo; color solo en estados. Responsive + PWA.
- Requiere aplicar las migraciones de este plan (van al lote de "mañana").
- Notificaciones: relevantes por rol, SIN redundancia (no avisar que cualquier compañero terminó algo sin impacto).

---

### Task 1: Migración — delegación universal (spec #4)

**Files:**
- Create: `migracion-20-delegacion-universal.sql`

**Interfaces:**
- Hoy `lib/shared.ts` (`filasCompartida`) ya estampa `delegada por X · con nombres` con timestamp en el historial. Falta permitir por RLS que un NO-jefe inserte una card cuyo `owner` es otra persona.

- [ ] **Step 1: Migración** — política INSERT que permita delegar a cualquiera con trazabilidad (la tarjeta debe llevar en su `history` una marca `compartida:` o `delegada por`):
```sql
-- Migración 20 — Delegación universal con trazabilidad
drop policy if exists "delegar tarea a otro" on public.cards;
create policy "delegar tarea a otro" on public.cards for insert with check (
  owner = auth.uid()  -- tarea propia (comportamiento actual)
  or exists (         -- o es una tarea compartida/delegada: debe registrar quién delegó en el historial
    select 1 from jsonb_array_elements(coalesce(history, '[]'::jsonb)) e
    where e->>'txt' like 'compartida:%' or e->>'txt' like 'Tarea compartida — delegada por %'
  )
);
```
- [ ] **Step 2:** Aplicar. La trazabilidad (quién delegó, a quién, fecha/hora) ya queda en `history` de cada tarjeta espejo (`filasCompartida` en `lib/shared.ts` estampa `at` ISO). Confirmar que `filasCompartida` incluye fecha/hora (ya usa `p.at`).
- [ ] **Step 3:** Commit — `git commit -m "feat(delegar): RLS delegación universal con trazabilidad (spec #4)"`

---

### Task 2: Botón Delegar para todos los roles (spec #4)

**Files:**
- Modify: `src/App.tsx` (pasar `onDelegar` a todos, no solo jefe)
- Modify: `src/components/CommandPalette.tsx` (acción Delegar para todos)
- Modify: `src/features/board/DelegarModal.tsx` (registrar trazabilidad visible)

- [ ] **Step 1:** Hoy `onDelegar` se pasa al Resumen solo para jefe y a CommandPalette con `isJefe ? ...`. Cambiar para que CUALQUIER usuario pueda abrir el `DelegarModal`. Agregar un acceso visible: botón "Delegar tarea" en el subnav del tablero propio (para empleados) además del Resumen; y en CommandPalette sin el gate `isJefe`.
- [ ] **Step 2:** En `DelegarModal`, la lista de participantes debe incluir a las personas a las que el usuario puede delegar. Para empleado, `fullTeam` es `[me]` — necesita ver a sus compañeros. Pasar una lista de destinatarios adecuada (para empleado: sus compañeros de equipo/marca; se puede traer con un hook liviano o reutilizar el `team` si RLS lo permite). Registrar en la nota "Delegada por {me.name} el {fecha} {hora}" (ya se hace con `at`; verificar que se muestre la hora en el detalle).
- [ ] **Step 3:** Test de `filasCompartida` confirmando que cada fila lleva `history` con la marca y el timestamp (trazabilidad). Build + smoke. Commit — `git commit -m "feat(delegar): cualquier usuario delega con trazabilidad (spec #4)"`

> Nota: el sync de completado entre tarjetas espejo ya existe (best-effort + trigger `migracion-13`). Aplicar migracion-13 y migracion-20 juntas.

---

### Task 3: Migración — tabla de notificaciones (spec #8)

**Files:**
- Create: `migracion-21-notificaciones.sql`

- [ ] **Step 1: Migración**
```sql
-- Migración 21 — Notificaciones
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade, -- destinatario
  tipo text not null,            -- 'asignacion' | 'delegacion' | 'vencida' | 'dep_liberada' | 'avance' | 'sin_asignar' | 'sistema'
  titulo text not null,
  detalle text not null default '',
  card_id uuid,                  -- opcional, para abrir la tarea
  leida boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "notif propias" on public.notifications for all
  using (owner = auth.uid()) with check (owner = auth.uid() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('jefe','encargado')));
create index if not exists idx_notif_owner on public.notifications(owner, created_at desc);
```
- [ ] **Step 2:** Aplicar. Tipo `Notification` en `src/lib/types.ts`. Commit — `git commit -m "feat(notif): migración tabla notifications con RLS (spec #8)"`

---

### Task 4: Generación de notificaciones (relevantes, sin redundancia) (spec #8)

**Files:**
- Create: `src/lib/notificaciones.ts` + `src/lib/notificaciones.test.ts`
- Modify: puntos de acción — `DelegarModal.tsx` (delegación), `Board.tsx`/`CardModal.tsx` (asignación/finalización con impacto)

**Interfaces:**
- Produces: helpers puros que deciden QUÉ notificar y a quién, según rol e impacto. Ej. `esRelevante(evento, rolDestino): boolean` y `construirNotif(...)`.

- [ ] **Step 1:** Definir reglas puras testeadas (spec):
  - Empleado: te asignaron/delegaron una tarea; te mencionaron en un evento; una dependencia tuya quedó liberada.
  - Encargado: alguien de tu equipo finalizó una tarea (con impacto: prioridad alta o con vencimiento); tarea importante vencida; recibiste delegación.
  - Jefe: empleado finalizó tarea IMPORTANTE; equipo alcanzó % de avance (50/100); tareas críticas vencidas; tareas sin asignar; dependencias relevantes.
  - Regla anti-ruido: NO notificar finalización de tareas sin impacto (baja prioridad, sin vencimiento). Test explícito de que un evento irrelevante NO genera notificación.
- [ ] **Step 2:** Escribir notificaciones en los puntos de acción de la app (al delegar → notif al receptor; al finalizar una tarea con impacto → notif al encargado/jefe). Insert en `notifications`. Las derivadas globales (avance 50/100, sin asignar, vencidas) se pueden computar en cliente y no persistir, o generarlas una vez.
- [ ] **Step 3:** TDD de las reglas (FAIL→PASS). Build. Commit — `git commit -m "feat(notif): reglas de relevancia por rol sin redundancia (spec #8)"`

---

### Task 5: Campana + panel de notificaciones (spec #8)

**Files:**
- Create: `src/hooks/useNotifications.ts` (query + realtime + contador no leídas)
- Create: `src/components/NotificacionesPanel.tsx`
- Modify: `src/components/Shell.tsx` (campana en el topbar con badge)

- [ ] **Step 1:** `useNotifications` trae las del usuario (`select * where owner=me order by created_at desc`), defensivo (`if error return []`), con realtime opcional. Contador de `!leida`.
- [ ] **Step 2:** Campana (ícono `Bell`) en el topbar del Shell con badge de no leídas; al hacer clic abre `NotificacionesPanel` (dropdown/modal) con la lista, cada ítem con ícono por tipo, texto y tiempo relativo; clic marca leída y (si tiene `card_id`) abre la tarea. Botón "Marcar todas como leídas".
- [ ] **Step 3:** Verificar visual `shot-view`. Build + smoke (no agregar dependencia de migración que rompa: el hook es defensivo). Commit — `git commit -m "feat(notif): campana con contador + panel por rol (spec #8)"`

## Self-review
- #4(T1,T2 — delegación universal con trazabilidad quién/quién/fecha/hora vía history+RLS), #8(T3-T5 — tabla, reglas anti-ruido por rol, campana+panel). Depende de aplicar migraciones 13,20,21. Reutiliza `lib/shared.ts` y `Modal`. Hooks defensivos → no rompe antes de migrar.
