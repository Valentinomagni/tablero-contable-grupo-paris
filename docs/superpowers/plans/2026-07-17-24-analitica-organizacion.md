# Plan 24 — Mejoras funcionales, analíticas y organizacionales (spec 24, 9 items) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (mandatado por el usuario). Un subagente por grupo; cada uno revisa `git log -5` y el estado del anterior antes de empezar.

**Goal:** Tablón útil como canal de comunicación, ARCA integrado como asistente de vencimientos, Resumen/Reportes para todos los roles, marca General, vacaciones con cobertura, análisis de tiempos ociosos, fix de operativas cortadas y seguimiento de Arqueo de Caja con resultado e indicadores.

**Architecture:** Una migración (`migracion-23`) concentra todo el SQL. ARCA se integra como **eventos virtuales** en el calendario (merge en render, cero duplicación en DB). El arqueo extiende `task_occurrences` con resultado (ok/dif + importe + obs) — el historial por día ya es inmutable. Ociosidad es analítica pura sobre datos existentes (snapshots/activity/cards), sin tracking nuevo.

**Tech Stack:** Supabase (SQL/RLS), React+TS, TanStack Query, vitest.

## Global Constraints
- Node portable: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`. Monocromo, cero emojis (lucide), TDD en lógica pura, commit por item, gates `npm run test && npm run build` (pre-commit corre tsc+vitest). NO pushear hasta integrar todo.
- Código DEFENSIVO ante migración no aplicada (patrón del repo: `if (error) return []`; escrituras fallan con toast sin romper).
- Reglas RLS: JAMÁS subquery a profiles en una policy — usar `public.es_jefe()` / `public.es_encargado_de(uuid)`.
- Ociosidad (spec): "El objetivo no es controlar al empleado" — solo métricas agregadas, lenguaje neutro.

---

### Task H1: Migración 23 + tipos (base de items 1, 5, 9)

**Files:** Create `migracion-23-comunicacion-vacaciones-arqueo.sql`; Modify `src/lib/types.ts`, `src/lib/schemas.ts` (campos nuevos `.optional().nullable()`).

- [ ] SQL en un archivo, con `drop policy if exists` + comentarios:
```sql
-- (1) Tablón útil: prioridad, vigencia y archivado de avisos
alter table public.announcements add column if not exists prioridad text not null default 'normal'; -- normal|importante|urgente
alter table public.announcements add column if not exists vigente_hasta date;
alter table public.announcements add column if not exists archivado boolean not null default false;

-- (5) Vacaciones y cobertura
create table if not exists public.vacaciones (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,   -- quién se ausenta
  desde date not null, hasta date not null,
  motivo text not null default 'Vacaciones',
  reemplazante uuid references public.profiles(id) on delete set null,     -- responsable temporal
  notas text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.vacaciones enable row level security;
create policy "ver vacaciones" on public.vacaciones for select using (true);  -- visibilidad general: todos ven quién está ausente
create policy "gestionar vacaciones" on public.vacaciones for all
  using (public.es_jefe() or public.es_encargado_de(owner) or owner = auth.uid())
  with check (public.es_jefe() or public.es_encargado_de(owner));            -- crea/edita: jefe o su encargado

-- (9) Arqueo: resultado por ocurrencia diaria
alter table public.task_occurrences add column if not exists resultado text;        -- 'ok' | 'dif' | null
alter table public.task_occurrences add column if not exists dif_importe numeric;
alter table public.task_occurrences add column if not exists dif_obs text;
alter table public.cards add column if not exists requiere_resultado boolean not null default false; -- marca "tarea de control" (arqueo)
```
- [ ] Tipos: `Announcement.prioridad?: "normal"|"importante"|"urgente"; vigente_hasta?: string|null; archivado?: boolean`; interface `Vacacion { id; owner; desde; hasta; motivo; reemplazante: string|null; notas; created_by: string|null; created_at }`; `TaskOccurrence.resultado?: "ok"|"dif"|null; dif_importe?: number|null; dif_obs?: string|null`; `Card.requiere_resultado?: boolean`.
- [ ] Gates + commit `feat(spec24): migración 23 — tablón útil, vacaciones, resultado de arqueo (base H1)`.

### Task H2: Tablón como canal de comunicación (item 1)

**Files:** Modify `src/features/tablon/Tablon.tsx`, `src/features/calendario/Calendario.tsx` (form alta comparte campos), `src/components/AnuncioEditForm.tsx`, `src/lib/vencimientos.ts` o nuevo `src/lib/tablon.ts` + test.

- [ ] Lógica pura `src/lib/tablon.ts` + test: `vigente(a, hoy)` (sin vigente_hasta o >= hoy, y !archivado), `ordenarAvisos(annos)` (urgente > importante > normal, luego fecha desc), `expirados(annos, hoy)`.
- [ ] Publicar (todos los roles — la RLS de migracion-15 ya lo permite): el form del Tablón suma Prioridad (select) y Vigencia (date opcional) + destinatarios (visible_to, patrón DelegarModal ya usado en Calendario). Al publicar → notificación best-effort a los destinatarios (insert en `notifications`, tipo 'sistema', try/catch).
- [ ] Render: urgente con banda `border-l-danger` + badge "Urgente"; importante `border-l-warn`; vencidos NO se muestran en la vista principal; sección colapsable "Archivados" (los `archivado` + los expirados) con botón Archivar/Restaurar (owner o jefe). Editar ya existe (AnuncioEditForm) — sumarle prioridad y vigencia.
- [ ] Gates + commit `feat(tablon): canal de comunicación — prioridad, vigencia, archivo y notificaciones (spec24 item 1)`.

### Task H3: ARCA integrado — asistente de vencimientos (item 2)

**Files:** Modify `src/features/tablon/arca.tsx`; Create `src/lib/arca-filtro.ts` + test; Modify `src/features/resumen/Resumen.tsx`, `src/features/calendario/Calendario.tsx`.

- [ ] Leer `arca.tsx` (useArca parsea el XML del proxy `/arca-xml`). Crear `arca-filtro.ts` puro + test: `relevantes(items)` — mantener SOLO categorías contables: IVA, Empleadores/Seg. Social (931), Autónomos, Monotributo, Casas Particulares, Ganancias/Bienes; descartar el resto. `aEventosVirtuales(items, year, month)` → `{ date, title, detail }[]`.
- [ ] Login ya muestra la agenda — aplicarle `relevantes()` (menos ruido).
- [ ] Resumen (jefe/encargado): tarjeta compacta "Vencimientos ARCA próximos (7 días)" con los relevantes (reutilizar `ArcaAgenda` o lista simple).
- [ ] Calendario: merge de eventos VIRTUALES de ARCA en la grilla (chip con estilo propio `bg-chip` + prefijo "ARCA") sin escribir en DB (cero duplicación, se actualizan solos); en el modal del día se listan como solo-lectura con botón "Copiar al calendario" (inserta announcement kind vencimiento) para quien quiera fijarlo.
- [ ] Gates + commit `feat(arca): solo vencimientos contables + Resumen + eventos virtuales en calendario (spec24 item 2)`.

### Task H4: Resumen/Reportes para todos + marca General (items 3 y 4)

**Files:** Modify `src/components/Shell.tsx`, `src/App.tsx`, `src/features/admin/UserModal.tsx`, `src/features/organigrama/Organigrama.tsx`, `src/lib/jerarquia.ts` (+test si hay lógica).

- [ ] **(3)** El módulo YA escala por alcance (scopedCards/fullTeam). Falta el EMPLEADO: en Shell, bloque "Mi espacio", agregar NavItems "Mi resumen" (`__resumen`) y "Mi reporte" (`__reporte`); en App, permitir esas vistas para empleado (hoy `view` default y title asumen gestor — verificar que con `fullTeam=[me]` y `scopedCards` de sus cards el Resumen/Reporte rinden correctamente: "Tareas abiertas", %, gráficos = SU rendimiento; títulos "Mi resumen"/"Mi reporte" si no es gestor). El % consolidado del encargado ya surge de computar sobre su subequipo — verificar con test de `cardsDeEquipo` si hace falta.
- [ ] **(4)** Marca "General": agregarla al select de Marca en UserModal y al orden fijo del Organigrama (General PRIMERO — abarca la organización). En Organigrama, sección General muestra a sus miembros con subtítulo "Administración transversal". Sin cambios de RLS (un jefe ya ve todo).
- [ ] Gates + commits separados (items 3 y 4).

### Task H5: Vacaciones y cobertura (item 5)

**Files:** Create `src/hooks/useVacaciones.ts` (defensivo), `src/features/calendario/VacacionesModal.tsx`, `src/lib/vacaciones.ts` + test; Modify `src/features/calendario/Calendario.tsx`, `src/features/board/Board.tsx` (badge ausente).

- [ ] `src/lib/vacaciones.ts` + test: `ausentesEnFecha(vacs, fecha)`, `estaDeVacaciones(vacs, ownerId, hoy)`, `rangoValido(desde, hasta)`.
- [ ] `VacacionesModal` (gestores): persona, desde/hasta, motivo, reemplazante (select del equipo), notas; lista de vacaciones vigentes/futuras con eliminar. Botón de acceso en el Calendario ("Vacaciones", ícono `Plane`).
- [ ] Calendario: en cada día con ausencias, chip `bg-chip` "«Nombre» ausente · cubre «Reemplazante»"; en el modal del día, detalle completo (período, motivo, notas).
- [ ] Cobertura de tareas: dentro del detalle de una vacación, lista de tareas ABIERTAS del ausente con botón por tarea "Pasar al reemplazante" (`update cards set owner` + history "Cobertura por vacaciones: de X a Y (dd/mm–dd/mm)") — trazabilidad completa; y aviso si el ausente tiene tareas con vencimiento dentro del período sin reasignar.
- [ ] Board/Resumen: badge "De vacaciones hasta dd/mm" junto al nombre si aplica hoy.
- [ ] Gates + commit `feat(vacaciones): registro, cobertura y visibilidad en calendario (spec24 item 5)`.

### Task H6: Análisis de tiempos ociosos (item 7)

**Files:** Create `src/lib/ociosidad.ts` + test; Modify `src/features/reporte/Reporte.tsx`.

- [ ] `ociosidad.ts` puro + test, sobre datos EXISTENTES (cards.done_at, activity_log.at, task_occurrences.done_at, daily_snapshots): por persona y día hábil (lun-vie, últimos 30 días): `diasSinActividad(persona)` (ningún cierre/registro/ocurrencia ese día), `diasCargaBaja` (open_effort del snapshot < umbral 2), `indiceUtilizacion` = días con actividad / días hábiles. Agregado de equipo: promedio.
- [ ] Reporte: sección "Utilización del tiempo (30 días)" con: índice de utilización por persona (barra gris), días sin actividad registrada, y nota fija en la UI: "Indicador de planificación de carga — no mide presencia ni productividad individual" (mandato de la spec). Solo visible para gestores.
- [ ] Gates + commit `feat(reporte): utilización del tiempo — métricas agregadas de carga (spec24 item 7)`.

### Task H7: Fix operativas cortadas (item 8) — BUG VISIBLE, prioridad

**Files:** Modify `src/features/board/Board.tsx` (y `src/components/Shell.tsx` solo si el clip viene del wrapper).

- [ ] Reproducir con screenshot (server dist :8124, `scripts/shot-view.mjs`, viewport 1366 y 1140): la columna "Operativas · a demanda" aparece recortada a la derecha (evidencia del usuario). Diagnóstico esperado: tras el cambio a `flex-col` del root del Board (commit 87961cc) el contenedor de columnas con `overflow-x-auto` quedó dentro de un padre que no le da ancho completo, o el wrapper `mx-auto max-w` del Shell recorta sin scroll.
- [ ] Fix: el contenedor de columnas debe tener `w-full overflow-x-auto` real (scroll horizontal funcional hasta la última columna, con `pr-6` final visible); las columnas `shrink-0 min-w-[290px]`; en pantallas angostas el scroll muestra TODO el contenido. Verificar también el subnav/chips que no fuercen ancho.
- [ ] Verificación visual OBLIGATORIA con screenshots (1366 y 1140, barra abierta y colapsada) mostrando la columna Operativas completa. Gates + commit `fix(tablero): columna de operativas visible completa con scroll correcto (spec24 item 8)`.

### Task H8: Arqueo de Caja con resultado e indicadores (item 9)

**Files:** Create `src/lib/arqueo.ts` + test; Modify `src/features/board/CumplimientoDiario.tsx`, `src/features/board/CardModal.tsx`, `src/features/mimes/MiMes.tsx` o Reporte.

- [ ] `arqueo.ts` puro + test (TDD): `statsArqueo(occs, mes)` → `{ total, ok, dif, pctOk, pctDif, diasCorrectos }` con redondeo a 2 decimales (ej. 30/31 → 96.77); `evolucionMensual(occs)` → últimos 6 meses `{ mes, pctOk }`.
- [ ] CardModal: toggle (jefe/gestor) "Requiere resultado (control de caja)" → `requiere_resultado`. Para cards con ese flag, al marcar una ocurrencia como hecha (checklist del mes, grilla diaria o calendario): mini-diálogo "¿Resultado?" → **Sin diferencias** (resultado 'ok') / **Con diferencias** (→ importe numérico + observaciones; guarda 'dif' + dif_importe + dif_obs). Best-effort si la migración no está (toast).
- [ ] `CumplimientoDiario`: los días con resultado 'ok' = verde; 'dif' = ámbar con tooltip del importe/obs; hecho sin resultado = gris-verde actual. Panel de stats arriba: "Cumplimiento: 96,77% · 30/31 sin diferencias" + mini evolución 6 meses (Bars).
- [ ] Integración reportes: en MiMes (o la ficha del CardModal) mostrar `statsArqueo` del mes para cards `requiere_resultado`; en Reporte, si existe alguna card de control, línea con su cumplimiento. El historial por día ya NO se pisa (occurrences por fecha + archivo mensual).
- [ ] Gates + commit `feat(arqueo): resultado diario (ok/diferencias) + indicadores de cumplimiento (spec24 item 9)`.

### Task H9: Propuestas de mejora — SOLO documento (item 6)

**Files:** Create `docs/PROPUESTAS-MEJORA.md`.

- [ ] Analizar el sistema completo (leer INDICE de planes + KAIZEN-HALLAZGOS + vistas) y proponer 8-12 mejoras JUSTIFICADAS técnicamente (productividad, organización, control, UX, calidad de información, automatización, análisis gerencial), cada una con: problema real que resuelve, esfuerzo estimado, dependencias, y riesgo. NO implementar nada. Commit `docs(propuestas): mejoras candidatas justificadas (spec24 item 6)`.

## Orden y dependencias
H1 primero (migración/tipos). H7 (bug visible) segundo. Luego H2→H3→H4→H5→H6→H8→H9. Cada subagente: `git log -5` + gates verdes + commit propio.

## Self-review
- Items ↔ tasks: 1(H2+H1), 2(H3), 3(H4), 4(H4), 5(H5+H1), 6(H9), 7(H6), 8(H7), 9(H8+H1). Pendiente externo: pestaña Jobs del Cron (usuario) para cerrar el reinicio mensual del plan 22. Sin placeholders; SQL concreto en H1; fórmula del ejemplo 30/31=96,77% cubierta en H8.
