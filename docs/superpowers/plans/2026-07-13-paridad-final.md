# Paridad Final v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Checkboxes por task.

**Contexto crítico descubierto:** el dominio de PRODUCCIÓN `contablegrupoparis.netlify.app` ya sirve el build v2 (título "tablero-contable-v2", login v2). El cutover ocurrió de facto — el equipo usa v2 hoy. Prioridad máxima: cerrar los gaps y regenerar el zip para re-subir al MISMO sitio. Rollback posible: `tablero-para-subir.zip` (legacy).

**Goal:** Portar del vanilla todas las features faltantes detectadas por comparación de código (app.js) y visual.

**Gaps confirmados (vanilla → v2):**
1. Objetivos editables (`openObjModal`, app.js:1357) — crear/editar/eliminar, validación suma≤100 que bloquea guardar.
2. Búsqueda de tareas en el board (input `q` en subnav, app.js:444).
3. Resumen: Exportar CSV (app.js:827, con escape anti-fórmulas Excel), Copiar resumen del día (app.js:848), gráfico 14 días (app.js:744), Ciclo del mes (app.js:769), Evolución de carga con snapshots (app.js:794, tabla `daily_snapshots`), Carga abierta por persona (app.js:810).
4. Mi cuenta — cambio de contraseña (`openAccount`, app.js:1418): valida 8+ chars letra+número, reautentica con signInWithPassword, updateUser.
5. Badge tablón +N novedades (app.js:397-401, localStorage `tablon-visto`; Tablón marca visto al entrar app.js:1031).
6. Login público: vencimientos próximos (announcements kind=vencimiento, RLS anon ya lo permite) + agenda ARCA (`/arca-xml`).
7. Densidad compacta (pref-density localStorage + clase `compact` en body).
8. Undo Ctrl+Z (pila LIFO máx 30 con valores previos de los campos tocados, app.js:361-387).
9. Admin: toggle `edit_closed` (tabla settings), parámetros board_name/due_warn_days/stuck_days, crear usuario vía Edge Function `crear-usuario` (la function la deploya el usuario — la UI queda lista y muestra error claro si no está).

## Global Constraints
- Igual a planes anteriores (Node portable, gates tsc/vitest/build, no tocar RLS ni legacy, patrones v2 existentes, no montar useCards fuera de App).
- Al final: build + `python -m zipfile -c` → nuevo `tablero-v2-netlify.zip` en el Desktop.

## Tasks
- [ ] T1 Objetivos editables: `features/objetivos/ObjModal.tsx` + botón "+ Añadir" y click en tarjeta (Objetivos.tsx). Validación en `lib/metrics.ts`? No: inline (otros+weight>100 bloquea). Mutations insert/update/delete + invalidate ["objectives"].
- [ ] T2 Búsqueda: estado `query` en App cuando mode=board, input en subnav, filtro título/descripción case-insensitive en Board.
- [ ] T3 Resumen completo: hook `useSnapshots` (daily_snapshots últimos 60d), componente `BarChart` simple reutilizable, CSV+standup buttons, 4 gráficos. Lógica de datos pura en `lib/resumen.ts` con tests (csvRows con escape, cicloDelMes insight, standupText).
- [ ] T4 `components/AccountModal.tsx` + ítem "Mi cuenta" en menú de Shell.
- [ ] T5 Badge tablón: announcements en App, cálculo nuevas vs localStorage, prop badge a Shell NavItem; Tablon marca visto.
- [ ] T6 Login: vencimientos públicos (query anon) + ARCA fetch (solo si carga, silencioso si CORS falla en local).
- [ ] T7 Densidad: extender useTheme con pref-density, clase compact en documentElement, CSS compacto mínimo en index.css, ítem en menú Shell.
- [ ] T8 Undo: `lib/undo.ts` (pila LIFO 30), integrado en patch de CardModal y move de Board, listener global Ctrl+Z en App con toast simple.
- [ ] T9 Admin: sección Permisos (toggle edit_closed en settings), Parámetros (board_name/due_warn_days/stuck_days), Crear usuario (POST a functions/v1/crear-usuario con session token). CardModal respeta edit_closed (locked).
- [ ] T10 Verificación e2e completa + build + zip nuevo en Desktop.
