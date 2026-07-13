# Dependencias (CardModal + Grafo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Checkboxes por task.

**Goal:** Portar del vanilla ([app.js:310-336](../../../tablero-contable/app.js) resolución, [1504-1621](../../../tablero-contable/app.js) secciones del modal, [975-1027](../../../tablero-contable/app.js) grafo) la lógica de dependencias: sección "⛓ Depende de / 🔗 Habilita a" en CardModal con vinculador persona→tarea (solo jefes), y grafo SVG tipo Obsidian en Resumen.

**Architecture:** Lógica pura en `src/lib/deps.ts` (testeada), dos hooks RPC (`deps_info`/`reverse_deps`, security definer ya existentes en DB) en `useData.ts`, sección nueva en `CardModal.tsx`, componente `DepGraph` en Resumen. Para jefes todo se resuelve localmente (RLS les da todas las cards); los RPC cubren las tarjetas ajenas que ve un no-jefe.

**Tech Stack:** igual al resto de v2. Sin cambios en DB/RLS.

## Global Constraints

- Igual que plan anterior: Node portable con `export PATH`, gates `npx tsc --noEmit` + `npx vitest run` + build, no tocar legacy ni RLS, estilo de CardModal/Board existentes, tests con fechas/datos fijos.
- Gotcha conocido: NO montar `useCards()` fuera de App (canal realtime duplicado). CardModal ya recibe todo por props.
- Los badges ⛓/⏳/✔ con emoji son el patrón vigente en Board.tsx — mantener consistencia.

---

### Task 1: Lógica pura `src/lib/deps.ts` + tests

Crear `src/lib/deps.ts`: `DepInfo`, `DepMap`, `missingDepIds(cards)`, `depInfoOf(id, cards, nameOf, depMap)`, `isBlocked(c, cards, depMap)`, `dependentsOf(cardId, cards, nameOf, revDeps, isJefe)`, `depGraphLayout(cards, depMap)` (port de depGraphHTML: columnas por profundidad con memo y guarda anti-ciclos, NW=210 NH=44 GX=70 GY=26 PAD=14, devuelve `{w,h,nodes,edges}` o `null` sin deps).
Tests en `src/lib/deps.test.ts`: missing ids, resolución local vs depMap, isBlocked, dependentsOf jefe/no-jefe con revDeps, layout de cadena A→B→C (3 columnas), ciclo no cuelga.

- [ ] Tests fallan → implementar → `vitest` + `tsc` verdes → commit `feat: lógica pura de dependencias (deps.ts)`

### Task 2: Hooks RPC en `useData.ts`

`useDepsInfo(missing: string[])` → `supabase.rpc("deps_info", { ids })`, enabled si hay missing. `useReverseDeps(cardIds: string[], enabled)` → `rpc("reverse_deps", { ids })`, enabled solo no-jefe con cards. Tipos desde `lib/deps.ts`.

- [ ] `tsc` limpio → commit `feat: hooks deps_info/reverse_deps`

### Task 3: Sección de dependencias en CardModal

Props nuevas de CardModal: `cards: Card[]; team: Profile[]; isJefe: boolean` (App ya tiene todo). Dentro: depMap desde `useDepsInfo(missingDepIds(cards))` (filtrado a deps de la card), revDeps desde `useReverseDeps`, banner "bloqueada" si `isBlocked`, lista "⛓ Depende de" (✔/⛓ + quitar si jefe), lista "🔗 Habilita a", vinculador persona→tarea (solo jefes; excluye la propia card y deps ya vinculadas; escribe `deps` + history "Vinculó/Quitó dependencia"). Insertar entre Detalle y Checklist (como vanilla). Actualizar llamada en App.tsx.

- [ ] `tsc` + tests verdes → commit `feat: Depende de / Habilita a en CardModal con vinculador`

### Task 4: Grafo en Resumen

Componente `DepGraph` (en `Resumen.tsx` o archivo propio en `features/resumen/`): usa `depGraphLayout`; SVG con marker flecha, edges bezier (done → `var(--done)`, pendiente → `var(--warn)`), nodos clickeables → `onOpenCard` si la card es local. Sección "Cadenas de dependencias entre tareas" al final de Resumen; si no hay deps, texto dim explicativo.

- [ ] `tsc` + tests + `npm run build` → commit `feat: grafo de dependencias en Resumen`

### Task 5: Verificación e2e

Dev server + login jefe1: abrir card con/sin deps, vincular una dependencia entre dos tareas, ver badge ⛓ en Board, ver grafo en Resumen, quitar la dependencia (dejar datos como estaban). Sin errores de consola.
