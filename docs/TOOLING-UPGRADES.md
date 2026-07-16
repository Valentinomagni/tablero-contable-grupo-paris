# Herramientas que suben la vara — Back y Front (15/07/2026)

> Investigación pedida: qué instalar para programar mejor, no seguir con lo mismo.
> Criterio: que aporte de verdad, que funcione en esta PC (sin admin, Node portable, Edge del sistema) y que no dependa de servicios pagos.

## Instaladas ahora

### FRONT — Playwright (`@playwright/test`)
Framework de testing **end-to-end** real (el estándar de la industria). Reemplaza los scripts caseros de puppeteer para pruebas.
- **Auto-wait**: no más `sleep(900)` arbitrarios; espera a que el elemento esté listo.
- **Trace viewer**: si un test falla, guarda un trace navegable (DOM, red, screenshots por paso).
- **Usa el Edge del sistema** (`channel: "msedge"`): no descarga navegadores → funciona sin permisos de admin.
- Config en `playwright.config.ts`, test en `e2e/app.spec.ts`, se corre con `npm run e2e`.
- Por qué sube la vara: hoy la app no tenía E2E; ahora el flujo crítico (login → vistas → delegar) se prueba solo.

### BACK — Zod
Validación de **esquemas en runtime**. Los tipos de TypeScript solo existen al compilar; si Supabase devuelve algo raro (una migración a medias, un dato viejo), TS no se entera pero Zod sí.
- `src/lib/schemas.ts`: esquema de `Card`; `useCards` valida cada fila y avisa por consola si hay *drift* de esquema (no destructivo: nunca descarta datos).
- Por qué sube la vara: primera línea de defensa en la frontera de datos; base para enganchar observabilidad (Sentry) después.

## Tanda 2 (16/07/2026)

### FULLSTACK — knip (código muerto, Seiri)
Detecta archivos, exports y dependencias sin uso real siguiendo el grafo de imports desde `src/main.tsx`.
- Se corre con `npm run deadcode`. Config mínima en `knip.json` (entradas: main.tsx, specs de e2e, scripts; ignora `public/sw.js`, `functions/` y la edge function, que se cargan en runtime/deploy y knip no los ve).
- Primera pasada: se borraron `src/App.css`, `src/assets/react.svg`, `src/assets/vite.svg`, `src/components/ui/button.tsx` y `src/lib/utils.ts` (scaffold de Vite/shadcn sin ningún import, verificado con grep). Lo dudoso (deps `@base-ui/react`, `clsx`, `tailwind-merge`, `cva`, `shadcn`, `tw-animate-css`; exports sueltos en `lib/`) quedó listado sin borrar.

### FRONT — Testing Library + jsdom (tests de componente)
`@testing-library/react` + `@testing-library/jest-dom` + `jsdom`. Vitest ahora corre con `environment: "jsdom"` e incluye `*.test.tsx`.
- Primer test de componente real: `src/components/NovedadesModal.test.tsx` (renderiza el modal y verifica versión y changelog). Se corre con `npm run test` como siempre.

### FRONT — axe-core (auditoría de accesibilidad)
`@axe-core/playwright`: `e2e/a11y.spec.ts` escanea Login y Resumen tras el login y falla si hay violaciones de impacto `critical`. Se corre con `npm run e2e`.

### BACK/DX — React Query Devtools
`@tanstack/react-query-devtools` montadas en `main.tsx` solo con `import.meta.env.DEV` → panel de queries/cache en dev, cero bytes en el build de prod (tree-shake).

### Bundle — rollup-plugin-visualizer (instalada en Task 4)
Opt-in: `ANALYZE=1 npm run build` genera `dist/stats.html` con el mapa del bundle (gzip incluido).

## Evaluadas y pospuestas (con motivo)
| Herramienta | Aporta | Por qué esperar |
|---|---|---|
| **Sentry** (`@sentry/react`) | Errores de producción visibles antes de que un empleado los reporte | Necesita DSN (cuenta free del usuario); se enchufa en 10 min sobre `validateRows`/error boundaries |
| **Testing Library + jsdom** | Tests de componentes (hoy solo hay de lógica pura) | ~~Pospuesta~~ → instalada en la tanda 2 |
| **Supabase gen:types** | Tipos generados desde la DB real (menos `types.ts` a mano) | Ya está el script `gen:types`; bloqueado hasta `npx supabase login` con token |
| **Storybook** | Catálogo de componentes | YAGNI para 1 dev; el costo de mantenimiento no se justifica aún |

## Gates de calidad (correr antes de cada deploy)
```
npm run test    # vitest — lógica pura (71 tests)
npm run build   # tsc + vite (typecheck + bundle)
npm run smoke   # recorre todas las vistas, falla si hay error de consola
npm run e2e     # Playwright — flujo crítico end-to-end + a11y (axe)
npm run deadcode  # knip — archivos/exports/deps sin uso
```
