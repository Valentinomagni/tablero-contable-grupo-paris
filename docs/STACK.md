# Inventario del Stack — Tablero Contable v2

> Generado el 13/07/2026 a partir del `package.json` y el código real (no de la documentación previa). Actualizar cuando cambien dependencias.

## Resumen

SPA React servida como estáticos en Netlify, sin servidor propio: todo el backend es Supabase (Postgres + Auth + Realtime + RLS). Build con Vite, deploy manual por zip de `dist/`.

```
Navegador ── React 19 SPA (Vite build) ── @supabase/supabase-js ── Supabase (yyyrlopgwmuvfbzwxiwp)
                     │                                                ├─ Postgres (7 tablas, RLS is_jefe())
                     │                                                ├─ Auth (email+password)
                     │                                                └─ Realtime (canal cards-live-v2)
                     └─ Netlify (estáticos + _redirects proxy /arca-xml → arca.gob.ar)
```

## Dependencias de producción

| Paquete | Versión | Propósito |
|---|---|---|
| react / react-dom | ^19.2.7 | UI. **OJO: la doc del proyecto dice React 18; lo instalado es 19.** |
| @supabase/supabase-js | ^2.110.2 | Cliente único de backend: queries, Auth, Realtime. Instanciado en `src/lib/supabase.ts`. |
| @tanstack/react-query | ^5.101.2 | Cache y fetching. Hooks en `src/hooks/useData.ts` (useCards con canal realtime — instanciar **una sola vez**, ver gotcha abajo). |
| lucide-react | ^1.24.0 | Íconos (regla de diseño: no emojis en UI). |
| shadcn | ^4.13.0 | Componentes (solo `ui/button.tsx` en uso). Sus estilos se reconciliaron con los tokens Paris (unlayered > @layer). |
| @base-ui/react | ^1.6.0 | Primitivas headless (dependencia de shadcn v4). |
| class-variance-authority / clsx / tailwind-merge | 0.7 / 2.1 / 3.6 | Utilidades de clases (`cn()` en `src/lib/ui.tsx` y `utils.ts`). |
| tw-animate-css | ^1.4.0 | Animaciones utilitarias Tailwind. |
| @fontsource-variable/geist | ^5.2.9 | Fuente self-hosted. **OJO: el design system especifica Inter (self-hosted en `index.css`); revisar si Geist quedó de un experimento.** |

## Dependencias de desarrollo

| Paquete | Versión | Propósito |
|---|---|---|
| vite + @vitejs/plugin-react | ^8.1.1 / ^6.0.3 | Build y dev server (puerto variable 5173-5179). |
| typescript | ~6.0.2 | Tipos a mano en `src/lib/types.ts` (no hay codegen de Supabase). Gate: `npx tsc --noEmit`. |
| vitest | ^4.1.10 | Tests unitarios: `src/lib/metrics.test.ts` (14 tests, lógica pura). Regla: fechas fijas del pasado. |
| tailwindcss + postcss + autoprefixer | ^3.4.19 | Estilos. Tokens Paris en `tailwind.config.js` + `src/index.css` (claro/oscuro). |
| oxlint | ^1.71.0 | Linter (`npm run lint`). |

## Estructura de módulos

- `src/lib/` — sin dependencias de React: `types.ts` (tipos), `supabase.ts` (cliente), `metrics.ts` (lógica pura testeada: dueInfo, kpiPct, saludScore, userMetrics30d), `ui.tsx` (Avatar, cn).
- `src/hooks/` — `useAuth` (sesión + invalidación post-login por RLS), `useData` (queries: team/cards+realtime/objectives/activity/announcements), `useTheme`.
- `src/components/` — Shell (sidebar/topbar), Login, CommandPalette (Ctrl+K), charts (SVG propio, sin librería de gráficos).
- `src/features/` — una carpeta por vista: board (kanban + CardModal), resumen, reporte, mimes, objetivos, tablon, admin (+ UserModal ficha empleado).
- `public/_redirects` — proxy Netlify `/arca-xml` (CORS de ARCA) + SPA fallback.

## Backend (compartido con el legacy)

Supabase `yyyrlopgwmuvfbzwxiwp`: tablas `profiles, cards, objectives, announcements, activity_log, daily_snapshots, settings`; RLS en todas con `is_jefe()`; crons `reset-recurrentes` y `snapshot-diario`. Migraciones SQL numeradas viven en `../tablero-contable/` (1-11 aplicadas). Esquema completo: `../tablero-contable/DATABASE.md`.

## Toolchain y flujo

- Node v22 **portable** (`~/tools/node-v22.17.0-win-x64/`, PC sin admin) — siempre `export PATH=...` antes de npm/npx.
- Gates pre-commit: `npx tsc --noEmit` + `npx vitest run` + `npm run build`.
- Deploy: `npm run build` → zip de `dist/` con `python -m zipfile -c` (NUNCA Compress-Archive) → arrastrar a Netlify (sitio separado del legacy hasta el cutover).
- Git local sin remoto (GitHub + auto-deploy: previsto post-cutover).

## Gotchas de dependencias conocidos

1. **Un solo `useCards()` montado a la vez por nombre de canal**: el hook crea el canal realtime `cards-live-v2`; montarlo en dos componentes simultáneos crashea con "cannot add postgres_changes callbacks after subscribe()". Los modales reciben `cards` por props desde App.
2. shadcn generó CSS estilo Tailwind v4 (`@apply border-border`) sobre Tailwind 3: reconciliado por cascada, no tocar ese orden en `index.css`.
3. `.value=` directo no dispara React en e2e: usar el setter del prototipo del elemento.

## Discrepancias documentación vs realidad (a corregir en docs al cutover)

- ESTADO-DEL-PROYECTO.md dice "React 18 + Tailwind 3": lo real es **React 19**, Vite 8, TS 6.
- Design system dice fuente **Inter**; hay instalada **Geist** (`@fontsource-variable/geist`) — verificar cuál carga realmente `index.css` y limpiar la que sobre.
- Dice "prettier + eslint globales": el linter del repo es **oxlint**.
