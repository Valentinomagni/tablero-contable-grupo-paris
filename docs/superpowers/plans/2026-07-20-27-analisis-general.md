# Spec 27 — Implementación del análisis general (staging, cierre unificado, Excel, adjuntos, tooling)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar los hallazgos del análisis general del 20/07: staging con rama dev, registro de migraciones, cierre mensual unificado (alternativa A), exportación a Excel, adjuntos en tareas, resumen semanal, aviso offline, e2e en CI, split de CardModal y docs de backup/RLS.

**Architecture:** Misma arquitectura (React 19 + TanStack Query + Supabase RLS). Novedades: Supabase Storage (bucket `adjuntos`), tabla `schema_migrations` autoregistrada, y flujo de ramas dev→main con previews de Cloudflare. Todo defensivo: sin migración 28 aplicada, nada crashea.

**Tech Stack:** React 19, TS, TanStack Query 5, Supabase (Postgres+RLS+Storage), vitest, Playwright, GitHub Actions, SheetJS (xlsx) client-side.

## Global Constraints

- Cero emojis en UI (solo Lucide). Estética monocroma Paris. Español rioplatense (voseo).
- Código defensivo ante migraciones/bucket no aplicados: campos `?`, catch → `[]`/null, chips "pendiente", jamás crash.
- Migraciones idempotentes en `migracion-28-*.sql` (raíz), documentadas en `docs/PASOS-MANUALES.md`. El usuario las corre a mano cuando pueda (hay cola: 26 y 27 aún sin correr).
- TDD para toda lógica en `src/lib/*`. Gates por commit: `tsc -b` + vitest (pre-commit los corre). Tests previos: 336.
- Regla de release (CLAUDE.md): entrada nueva en CHANGELOG antes del push final (v2.3.0).
- NO pushear hasta la task final (review de rama completa primero).

---

### Task 1: Migración 28 — schema_migrations, bucket de adjuntos y resumen semanal

**Files:**
- Create: `migracion-28-infraestructura.sql`
- Modify: `docs/PASOS-MANUALES.md`

**Interfaces:**
- Produces: tabla `public.schema_migrations (id int pk, nombre text, applied_at timestamptz default now())` con RLS lectura para authenticated; backfill 13-25 (verificadas aplicadas); las migraciones 26/27/28 se registran A SÍ MISMAS al final de su propio archivo (agregar el INSERT a 26 y 27 TAMBIÉN, son idempotentes y el usuario aún no las corrió). Bucket `adjuntos` (privado) con policies: SELECT/INSERT authenticated, DELETE dueño del archivo o jefe (por convención de path `cardId/...` no hay owner nativo: usar `owner` de storage.objects = auth.uid() para delete propio, o es_jefe()). Función `public.resumen_semanal()` SECURITY DEFINER (revoke a anon/authenticated como migración 26) que inserta un announcement kind 'aviso' con las métricas de la semana (cerradas, vencidas, difs de arqueo) — para cron semanal manual del usuario.
- SQL completo en el brief de la task; el implementador lo escribe y verifica idempotencia a ojo (add if not exists / on conflict / drop policy if exists / create or replace).

Pasos: SQL → agregar INSERTs de autoregistro a migracion-26 y 27 → PASOS-MANUALES (28 + cron semanal opcional `0 12 * * 1` → `select public.resumen_semanal();`) → tsc+tests verdes → commit `feat(infra): migración 28 — registro de migraciones, bucket adjuntos y resumen semanal`.

---

### Task 2: Chip de estado de migraciones en Admin

**Files:**
- Create: `src/lib/migraciones.ts` + `src/lib/migraciones.test.ts`
- Modify: `src/hooks/useData.ts` (hook `useMigraciones`), `src/features/admin/Admin.tsx` (chip al tope)

**Interfaces:**
- Produces: `MIGRACIONES_ESPERADAS: number[]` (13..28 conocidas por el código); `estadoMigraciones(aplicadas: number[] | null): { ok: boolean; faltan: number[]; desconocido: boolean }` — `aplicadas === null` (tabla inexistente) → `desconocido: true`. Hook: query a `schema_migrations` con catch → null.
- UI Admin: chip verde "Base al día" / ámbar "Faltan migraciones: 26, 27" / gris "Estado desconocido — corré la migración 28" (estilos de chips existentes, ShieldCheck/AlertTriangle/HelpCircle de Lucide).

TDD: tests de estadoMigraciones (al día, faltantes, null). Commit `feat(admin): chip de estado de migraciones`.

---

### Task 3: Flujo dev→main con previews (staging)

**Files:**
- Create: `docs/FLUJO-DEV.md`
- Modify: `CLAUDE.md` (regla: features van a rama `dev`, merge a main tras ver la preview)

**Interfaces:** crear rama `dev` local y pushearla (con el PAT del flujo habitual) para que Cloudflare genere previews por rama. Doc: cómo ver la URL de preview en el dashboard de Cloudflare Pages, cuándo mergear. NOTA: este spec 27 se sigue trabajando en main por continuidad; el flujo dev rige DESPUÉS del push final de este spec (documentarlo así).

Commit `docs(proceso): flujo dev→main con previews de Cloudflare`.

---

### Task 4: Exportar análisis mensual a Excel

**Files:**
- Create: `src/lib/excel.ts` + `src/lib/excel.test.ts`
- Modify: `src/features/reporte/AnalisisMensual.tsx` (botón "Exportar Excel" no-print), `package.json` (dep `xlsx` SheetJS)

**Interfaces:**
- Produces: `armarLibroAnalisis(a: AnalisisMes, meta: { mesLabel: string; segmento: string | null }): { hojas: { nombre: string; filas: (string | number | null)[][] }[] }` — PURA y testeable (sin xlsx); hoja "Resumen" (KPIs), "Por persona", "Por marca", "Por sucursal". Función aparte `descargarExcel(libro, nombreArchivo)` que usa `xlsx` (XLSX.utils.aoa_to_sheet + writeFile) — sin test unitario (side effect).
- TDD sobre `armarLibroAnalisis` (títulos, filas, nulls como "—" o vacío, números como números).

Commit `feat(reporte): exportar el análisis mensual a Excel`.

---

### Task 5: Adjuntos en tareas (Supabase Storage)

**Files:**
- Create: `src/lib/adjuntos.ts` + `src/lib/adjuntos.test.ts`, `src/features/board/Adjuntos.tsx`
- Modify: `src/features/board/CardModal.tsx` (sección Adjuntos)

**Interfaces:**
- Produces: lib pura: `nombreSeguro(filename: string): string` (slug + timestamp, preserva extensión), `validarAdjunto(file: { size: number; name: string }): string | null` (max 10 MB; extensiones permitidas pdf/png/jpg/jpeg/xlsx/xls/csv/txt/docx → null si ok, mensaje si no). Componente `Adjuntos({ cardId, canEdit })`: lista (`storage.from("adjuntos").list(cardId)`), subir (input file → `upload(\`${cardId}/${nombreSeguro(name)}\`)`), descargar (`createSignedUrl`, 60s), borrar con confirmación inline (patrón Notas). DEFENSIVO: cualquier error de storage (bucket inexistente) → texto "Adjuntos disponibles tras la migración 28" y nada más.
- TDD de nombreSeguro/validarAdjunto.

Commit `feat(tareas): adjuntos con Supabase Storage`.

---

### Task 6: Cierre mensual unificado (alternativa A — propuesta aprobada en cola)

**Files:**
- Create: `src/lib/cierre-unificado.ts` + `src/lib/cierre-unificado.test.ts`
- Modify: `src/features/cierre/Cierre.tsx` (panel semáforo arriba), `src/features/admin/PlantillaCierre.tsx` (quitar botón "Generar cierre" duplicado si existe, dejar link a Cierre)

**Interfaces:**
- Produces: `estadoCierre(input: { checklist: CierreStats | null; archivadoMesPrevio: boolean; recurrentesOk: boolean }): { pasos: { key: "checklist" | "archivo" | "recurrentes"; lbl: string; estado: "ok" | "pendiente" | "atencion"; detalle: string }[]; cerrado: boolean }` — checklist ok si pct===100; archivo ok si cards_archive tiene filas del mes previo; recurrentes ok si no hay recurrentes mensuales en estado term arrastradas (o si no hay recurrentes mensuales). `cerrado` = los 3 ok.
- UI: semáforo de 3 filas (CheckCircle2 verde / Circle gris / AlertTriangle ámbar) + texto "Mes cerrado" cuando todo ok. Los datos: cierreStats ya existe; archivo del mes previo vía useArchive/useArchiveEquipo; recurrentes desde cards. Sin cambio de esquema. Es la implementación de docs/PROPUESTA-CIERRE-MENSUAL.md alternativa A.

TDD de estadoCierre (3 combinaciones + todo ok). Commit `feat(cierre): cierre unificado — semáforo de 3 pasos (alternativa A)`.

---

### Task 7: Aviso de sin conexión

**Files:**
- Create: `src/hooks/useOnline.ts`
- Modify: `src/components/Shell.tsx` (banner fijo "Sin conexión — los cambios no se guardan" cuando offline)

**Interfaces:** `useOnline(): boolean` (navigator.onLine + eventos online/offline). Banner ámbar discreto top, con WifiOff de Lucide. Sin tests unitarios (hook de browser API); gates verdes.

Commit `feat(ux): aviso de sin conexión`.

---

### Task 8: E2E en CI

**Files:**
- Modify: `.github/workflows/main.yml` (job e2e: build + `npx playwright install --with-deps chromium` + `npm run e2e`), `playwright.config.ts` si hace falta (webServer con vite preview)

**Interfaces:** leé primero e2e/*.spec.ts y playwright.config.ts para ver contra qué corren (¿login real o página estática?). Si los specs requieren credenciales, limitá el job a los specs que no las necesiten (a11y/login render) con `--grep` y documentá en el workflow por qué. El job NO debe romper el CI existente.

Commit `ci: e2e de Playwright en GitHub Actions`.

---

### Task 9: Split de CardModal (solo refactor, cero cambio de comportamiento)

**Files:**
- Create: `src/features/board/card/ChecklistSection.tsx`, `src/features/board/card/DepsSection.tsx`, `src/features/board/card/ComentariosSection.tsx`, `src/features/board/card/MetaSection.tsx`
- Modify: `src/features/board/CardModal.tsx` (queda como orquestador <250 líneas)

**Interfaces:** extraer secciones EXACTAS (mover JSX + sus handlers, props explícitas: card, cards, mutaciones, hist). PROHIBIDO cambiar lógica, textos o estilos. Verificación: tsc + 336+ tests verdes + diff revisado a mano buscando cambios de comportamiento accidentales.

Commit `refactor(board): CardModal partido en secciones sin cambio de comportamiento`.

---

### Task 10: Docs de backup/restore y smoke de RLS

**Files:**
- Create: `docs/BACKUP-RESTORE.md`, `scripts/rls-smoke.mjs`
- Modify: `docs/PASOS-MANUALES.md` (referencia)

**Interfaces:** BACKUP-RESTORE: cómo usar el export JSON del Admin + cómo restaurar (orden de tablas, upserts, advertencias de FK) + recomendación de backup de Supabase (PITR del plan). `rls-smoke.mjs`: script Node que lee `SUPABASE_URL`, `ANON_KEY`, `TEST_EMPLEADO_EMAIL/PASS`, `TEST_JEFE_EMAIL/PASS` de env (JAMÁS hardcodeadas), loguea con cada rol y verifica: empleado no ve cards ajenas / no puede borrar announcements ajenos / jefe sí ve todo; imprime tabla PASS/FAIL. Sin CI (requiere secrets); uso manual local documentado.

Commit `docs(ops): backup-restore y smoke de RLS manual`.

---

### Task 11: Cierre — changelog 2.3.0, review final, push

- Entrada 2.3.0 en version.ts (lenguaje usuario: exportar a Excel, adjuntos, cierre unificado, aviso sin conexión, estado de migraciones; NO mencionar CI/refactor). Gates completos (tsc, vitest, lint, build). Review final de rama con paquete completo. Fix de findings. Push a main (el usuario ya dio el ok con "hace todo"). Actualizar memoria: migraciones en cola ahora 26+27+28; cron semanal opcional pendiente.

## Self-Review
- Cobertura: staging→T3, migraciones-registro→T1+T2, cierre unificado→T6, Excel→T4, adjuntos→T5, digest semanal→T1 (función+cron doc), offline→T7, e2e CI→T8, CardModal→T9, backup+RLS→T10, release→T11. Bloqueados por usuario (Sentry, gen:types, rotación de credenciales, correr migraciones/crons) quedan documentados en PASOS-MANUALES/memoria — sin task de código. ✔
- Sin placeholders: cada task define firmas exactas; los briefs llevan el detalle. ✔
- Consistencia: `AnalisisMes` (T4) ya existe de spec 26; `CierreStats` existe en cierre.ts; hooks nuevos siguen patrón useData. ✔
