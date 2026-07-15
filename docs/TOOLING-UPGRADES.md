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

## Evaluadas y pospuestas (con motivo)
| Herramienta | Aporta | Por qué esperar |
|---|---|---|
| **Sentry** (`@sentry/react`) | Errores de producción visibles antes de que un empleado los reporte | Necesita DSN (cuenta free del usuario); se enchufa en 10 min sobre `validateRows`/error boundaries |
| **Testing Library + jsdom** | Tests de componentes (hoy solo hay de lógica pura) | Siguiente paso natural tras Playwright; agrega valor pero menos urgente |
| **Supabase gen:types** | Tipos generados desde la DB real (menos `types.ts` a mano) | Ya está el script `gen:types`; bloqueado hasta `npx supabase login` con token |
| **Storybook** | Catálogo de componentes | YAGNI para 1 dev; el costo de mantenimiento no se justifica aún |

## Gates de calidad (correr antes de cada deploy)
```
npm run test    # vitest — lógica pura (71 tests)
npm run build   # tsc + vite (typecheck + bundle)
npm run smoke   # recorre todas las vistas, falla si hay error de consola
npm run e2e     # Playwright — flujo crítico end-to-end
```
