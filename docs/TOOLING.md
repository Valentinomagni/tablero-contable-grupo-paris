# Herramientas del proyecto (instaladas)

Todo corre con el Node portable: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`.

## 1. Smoke test — `npm run smoke`
Loguea como jefe, recorre TODAS las vistas (Resumen, Reporte, Tablón, Bitácora, Administración, tablero de persona + subtabs) y **falla con código 1 si aparece cualquier error de consola**. Usa Edge headless (puppeteer-core), sin instalar Chromium.

Uso: en una terminal `npm run dev`; en otra `npm run smoke`.
Es el gate ideal antes de generar el zip de deploy: si el smoke pasa, ninguna vista está rota.
(Ya encontró y arreglamos un 406 en `useSettings` el 14/07.)

## 2. Capturas de todas las vistas — `npm run shots`
`node scripts/shots.mjs <url> <carpeta> [light|dark]` — guarda PNG de login/resumen/tablero/reporte + dark + móvil. Sirve para revisar el diseño sin depender del screenshot del navegador integrado (que timeoutea en esta máquina).

## 3. Tipos de Supabase desde la DB real — `npm run gen:types`  ⚠ requiere login
Genera `src/lib/database.types.ts` a partir del esquema real, para dejar de mantener `types.ts` a mano y evitar drift.

**Falta un paso de auth (una sola vez):**
1. Sacá un access token en https://supabase.com/dashboard/account/tokens
2. `npx supabase login` (pegás el token) — o `export SUPABASE_ACCESS_TOKEN=<token>`
3. `npm run gen:types`

Mientras no se haga, `types.ts` (a mano) sigue siendo la fuente de tipos — funciona perfecto, solo hay que actualizarlo si cambia el esquema.

## 4. Gate automático en cada commit — `.githooks/pre-commit`
Corre `tsc --noEmit` + `vitest run` antes de aceptar cualquier commit (activado con `core.hooksPath`). Si algo no compila o un test falla, el commit se bloquea.

## 5. Lint — `npm run lint` (oxlint)
Rápido. Los warnings restantes son cosméticos (fast-refresh en dev, falsos positivos de jsx-key en Reporte).
