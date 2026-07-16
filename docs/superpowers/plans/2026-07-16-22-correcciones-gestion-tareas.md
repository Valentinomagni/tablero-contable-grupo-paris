# Plan 22 — Correcciones funcionales y gestión de tareas (spec 21, 14 items) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (mandatado por el usuario). Checkbox steps. Un subagente por grupo; revisar integración entre grupos.

**Goal:** Corregir flujos (creación, permisos del encargado, recurrencias que pisan datos), reforzar trazabilidad (historial, protección, archivo mensual) y agilizar la gestión (duplicar, categorías, filtros, duplicados, agrupación) + logo vectorial definitivo.

**Architecture:** Una sola migración nueva (`migracion-22`) concentra columnas y policies. El archivo mensual usa una tabla `cards_archive` (snapshot jsonb por mes) — nada histórico se pisa jamás. El logo se VECTORIZA desde `logo.jpg` con vtracer (raster→SVG real, ya instalado via `python -m pip install --user vtracer`).

**Tech Stack:** Supabase (SQL/RLS), React+TS, TanStack Query, vitest, Pillow+vtracer.

## Global Constraints
- Node portable: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`. Python con `python -m pip`.
- Monocromo, cero emojis (lucide), TDD en lógica pura, commit por task, gates `npm run test && npm run build` (pre-commit corre tsc+vitest). NO pushear hasta integrar.
- Código DEFENSIVO ante migración no aplicada (patrón del repo: `if (error) return []`, escrituras con toast).
- Los cambios de RLS/edge function son manuales del usuario → juntarlos al final en PASOS del reporte.

---

### Task G1: Flujo de creación + duplicar + renombrar (items 2, 5, 6)

**Files:** Create `src/features/board/NuevaTareaModal.tsx`; Modify `src/features/board/Board.tsx`, `src/features/board/CardModal.tsx`.

- [ ] **(2)** Nuevo `NuevaTareaModal` (reusa `Modal`): campos Título (requerido), Vencimiento (date), Prioridad, Esfuerzo, Categoría (select de settings, ver G2/G3; si no hay categorías, ocultarlo) y botón primario **"Crear tarea"** (nunca "Marcar terminada"). Inserta `status:"pend"` + history "Creó la tarea". El "+ Añadir tarea" de la columna Pendiente abre este modal; el input inline rápido puede quedar como atajo en las otras columnas o eliminarse (elegir lo más limpio y decirlo).
- [ ] **(6)** En `CardModal`, el `<h3>{c.title}</h3>` pasa a editable: ícono lápiz → input → Enter/blur → `patch.mutate({ title, history: hist("Renombró la tarea") })` (respetar `locked`).
- [ ] **(5)** Botón "Duplicar" (ícono `Copy`) en el pie del CardModal: inserta una card nueva con `title: c.title + " (copia)"`, description, priority, effort, categoria, recur_rule, checklist con todos los ítems `done:false, done_at:null`, `status:"pend"`, history "Creada duplicando…". Toast + abrir la copia opcional.
- [ ] Tests puros si hay lógica extraíble (ej. `duplicarCard(c): fila` en `src/lib/duplicar.ts` con test de que resetea done). Gates + commits separados por item.

### Task G2: Migración 22 + edge function v2.1 (items 3, 7, 8-config, 9-tabla, 10, 11-columna, 1-policy)

**Files:** Create `migracion-22-gestion-tareas.sql`; Modify `edge-function-eliminar-usuario.ts`, `src/lib/types.ts`, `src/lib/schemas.ts` (si aplica).

- [ ] **SQL (todo en un archivo):**
  - **(3)** `create policy "encargado ve cards de su equipo" on public.cards for select using (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));` — usar los helpers SECURITY DEFINER existentes (¡NUNCA subquery a profiles sin ellos!). Verificar antes con `drop policy if exists`.
  - **(7)** `alter table cards add column if not exists protected boolean not null default false;` + policies: UPDATE/DELETE de cards protegidas solo jefe: reforzar con `create policy ... for delete using (public.es_jefe() or (owner = auth.uid() and not protected));` y en UPDATE incorporar `(not protected or public.es_jefe())`. OJO: revisar las policies UPDATE existentes para componer sin romper (las policies son OR permisivas → la restricción de protected debe ir DENTRO de cada policy existente o convertirse en RESTRICTIVE policy: usar `as restrictive` para protected es lo correcto: `create policy "protegidas solo jefe" on public.cards as restrictive for update using (not protected or public.es_jefe());` idem delete).
  - **(8)** `alter table cards add column if not exists reset_policy text not null default 'mensual';` -- 'mensual' | 'mantener' | 'manual' (las recurring existentes = mensual).
  - **(9)** `create table if not exists public.cards_archive (id uuid default gen_random_uuid() primary key, owner uuid not null, mes text not null, card jsonb not null, archived_at timestamptz default now()); alter table ... enable row level security;` policy SELECT: dueño, su encargado (es_encargado_de) o jefe; INSERT solo jefe/función. + función `archivar_mes(p_mes text)` SECURITY DEFINER: inserta en cards_archive un snapshot de TODAS las cards no operativas (`select owner, p_mes, to_jsonb(c) from cards c where card_type <> 'operativa'`) evitando duplicar (unique (mes, (card->>'id')) o borrar previo del mes).
  - **(11)** `alter table cards add column if not exists categoria text;`
  - **(1)** announcements: `create policy "editar aviso propio o jefe" on public.announcements for update using (owner_id = auth.uid() or public.es_jefe());`
- [ ] **(10)** `edge-function-eliminar-usuario.ts` v2.1: los OBJETIVOS del empleado se **eliminan** (`delete from objectives where owner = userId`) en vez de reasignarse (decisión de la spec: los objetivos son personales). Cards siguen yendo al centinela.
- [ ] Tipos: `Card.protected?: boolean; Card.categoria?: string | null; Card.reset_policy?: "mensual"|"mantener"|"manual"`; `CardsArchive` interface. `AppSettings.categorias?: string[]`.
- [ ] Commit. REPORTAR: el usuario debe correr migracion-22 y re-desplegar la edge function.

### Task G3: Editar avisos + categorías UI (items 1, 11)

**Files:** Modify `src/features/calendario/Calendario.tsx`, `src/features/tablon/Tablon.tsx`, `src/features/admin/Admin.tsx`, `src/features/board/CardModal.tsx`, `src/features/board/Board.tsx`.

- [ ] **(1)** En el modal de día del Calendario y en el Tablón: botón lápiz por evento (visible si `owner_id===me.id || isJefe`) → formulario inline con título/detalle/tipo/fecha/compartir-con precargados → `update announcements`. Toast éxito/error (defensivo si la policy no está).
- [ ] **(11)** Admin → sección "Categorías de tareas": lista editable (agregar/quitar strings) guardada en `settings.categorias` (mismo jsonb `permissions` que board_name — sin código nuevo de tablas; extensible sin tocar código). CardModal: select "Categoría" (opciones de settings + "—") → `patch.mutate({ categoria })`. Board: fila de chips de filtro por categoría sobre las columnas (chip "Todas" + una por categoría usada); filtra `mine`. Badge sutil de categoría en `CardItem` (`bg-chip`).
- [ ] Gates + commits por item.

### Task G4: Duplicados fuzzy + agrupar/colapsar (items 12, 13)

**Files:** Create `src/lib/similitud.ts` + test; Modify `src/features/board/NuevaTareaModal.tsx`, `src/features/board/Board.tsx`.

- [ ] **(12)** `similitud(a,b): number` 0..1 (normalizar: lowercase, sin tildes; bigramas Dice o Levenshtein normalizado — elegir y testear: "conciliacion banco" vs "Conciliación Bancos" > 0.6; "IVA" vs "Sueldos" < 0.3). En `NuevaTareaModal`, al tipear/crear: buscar entre cards ABIERTAS del mismo owner las de similitud ≥ 0.6; si hay, advertencia inline ámbar "Se detectó una tarea similar: «X». Revisá antes de crear una duplicada." con botones "Crear igualmente" / "Cancelar". No bloquear.
- [ ] **(13)** En Board: toggle "Agrupar" en la cabecera de columnas (o automático si >8 tarjetas): dentro de cada columna, agrupar por categoría (fallback: por prioridad si no hay categorías) en secciones accordion (`<details>`-like propio con chevron). Grupo contraído = pila visual (2-3 tarjetas superpuestas con offset 4px/escala 0.98 vía CSS absolute + contador "N tareas"). Expandido = normal. Persistir colapsados en prefs (`tablero:grupos-<ownerId>`). Estética monocroma sutil.
- [ ] Gates + commits por item. Verificación visual con shot-view si el server responde.

### Task G5: Recurrencias sin pérdida + reinicio configurable + historial mensual (items 4, 8, 9)

**Files:** Modify `src/features/board/CardModal.tsx`, `src/features/mimes/MiMes.tsx` o vista persona, `src/App.tsx`; Create `src/features/historial/HistorialMes.tsx`, `src/hooks/useArchive.ts`, `src/lib/archivo.ts` + test. (La tabla y `archivar_mes` vienen de G2.)

- [ ] **(4)** Auditar TODO lo que pisa datos al recurrir: (a) el fallback client-side de reset mensual de `recurring` (buscar en el repo v2 si se portó; si existe, que ARCHIVE antes de limpiar y respete `reset_policy`), (b) `guardarRecur`/materializar (NO borra ocurrencias existentes — verificar con test que el upsert no toca filas done), (c) plantilla de cierre (ya idempotente por marca — verificar). Regla: NADA borra checklist/ocurrencias done sin archivar antes.
- [ ] **(8)** UI en CardModal para `reset_policy` (select "Ciclo de vida": Reinicia cada mes / Mantiene estado / Reinicio manual) visible si `recurring` o `recur_rule`. VERIFICAR el pg_cron `reset-recurrentes` de v1: documentar en el reporte si sigue activo en Supabase (consultar al usuario o probar); el fallback client debe filtrar por `reset_policy === 'mensual'`.
- [ ] **(9)** Botón jefe "Archivar mes" (en Admin o Cierre): llama `rpc archivar_mes('YYYY-MM')` → snapshot completo. `useArchive(ownerId, mes)` defensivo lee `cards_archive`. Nueva subtab "Historial" en la vista de persona: selector de mes (meses disponibles del archive) → tarjetas READ-ONLY renderizadas desde el jsonb (título, estado, checklist, fechas, observaciones — reusar `CardItem` en modo lectura o lista simple). Empty state si no hay archivo.
- [ ] Tests de `src/lib/archivo.ts` (mesesDisponibles, parseo del jsonb a Card). Gates + commits.

### Task G6 (INLINE, no subagente — sensibilidad visual): Logo vectorial definitivo (item 14)

**Files:** Create `scripts/logo-vector.py`; Replace `public/brand/*.svg`; Modify `src/components/Logo.tsx`, `src/components/Login.tsx`, favicon/íconos.

- [ ] Con vtracer (instalado): preprocesar `logo.jpg` con Pillow (escalar 4x LANCZOS + umbral limpio) → `vtracer.convert_image_to_svg_py(..., colormode="binary", mode="spline", filter_speckle=8)` → SVG vectorial del lockup y del isotipo. Limpiar el SVG (fill blanco → `currentColor`, viewBox ajustado al bbox).
- [ ] Verificar fidelidad: render del SVG a PNG grande, comparar lado a lado contra logo.jpg escalado (Read de ambos). Iterar parámetros de vtracer (corner_threshold, length_threshold) hasta indistinguible.
- [ ] Integrar: `LogoMark` vuelve a SVG inline o `<img src=svg>` (nítido a cualquier tamaño, modo claro/oscuro via currentColor si es inline); Login usa el lockup SVG; favicon/íconos PWA regenerados desde el SVG rasterizado a alta. Optimizar peso (paths de vtracer suelen ser chicos en binario).
- [ ] Verificación final en pantalla a 84px, 210px y zoom 300%. Commit.

## Orden y dependencias
G2 (migración/tipos) → primero. G1, G3, G4 dependen de tipos de G2 (categoria/protected). G5 depende de G2 (archive). G6 independiente. Ejecutar: G2 → G1 → G3 → G4 → G5 → G6(inline). Integración: cada subagente revisa `git log -3` y el estado del anterior.

## Self-review
- 14 items ↔ tasks: 1(G2 policy+G3 UI), 2/5/6(G1), 3(G2), 4/8/9(G5+G2), 7(G2+UI en G5 o G1: toggle Protegida para jefe en CardModal — INCLUIRLO en G1 junto al pie del modal), 10(G2 edge v2.1), 11(G2+G3), 12/13(G4), 14(G6). Protección UI: agregada a G1. Sin placeholders críticos; los subagentes leen el código real antes de tocar.
