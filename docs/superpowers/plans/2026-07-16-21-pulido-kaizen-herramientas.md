# Plan 21 — Pulido de flujo, identidad, Kaizen aplicado y herramientas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir el flujo de guardado del modal de tarea, dejar el logo fiel al oficial en SVG/PNG, aplicar los hallazgos aprobados de `docs/KAIZEN-HALLAZGOS.md`, e instalar la siguiente tanda de herramientas front/back/fullstack.

**Architecture:** Cambios acotados a componentes existentes (CardModal, Logo, tailwind.config, App) + tooling de calidad (knip, Testing Library, axe, visualizer). Sin migraciones — todo desplegable de inmediato.

**Tech Stack:** React 19, Tailwind, Vite/rolldown, vitest, Playwright, puppeteer-core (Edge headless).

## Global Constraints
- Node portable: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"` antes de npm. PC sin admin: solo npm local / Edge del sistema / free tier.
- Cero emojis (solo Lucide). Monocromo negro/blanco/gris; color solo en estados. Responsive + PWA.
- Gates por task: `npm run test && npm run build` (+ `npm run smoke` con dist servido en :8124). Commit por task. TDD en lógica pura.
- Verificación visual: `node scripts/shot-view.mjs http://localhost:8124 <out> "<Vista>" dark|light`.

---

### Task 1: Fix clases Tailwind fantasma (Kaizen H1 — bug visible en toda la app)

**Files:**
- Modify: `tailwind.config.js` (bloque `colors`)

**Interfaces:**
- Las CSS vars `--chip`, `--warn-soft`, `--danger-soft` YA existen en `src/index.css` (claro y oscuro). Solo falta exponerlas como utilidades.

- [ ] **Step 1:** En `tailwind.config.js`, dentro de `theme.extend.colors`, agregar:
```js
chip: "var(--chip)", "warn-soft": "var(--warn-soft)", "danger-soft": "var(--danger-soft)",
```
- [ ] **Step 2:** Build y verificar en el CSS de `dist/assets/*.css` que ahora SÍ existen las reglas: `grep -o "bg-chip\|bg-warn-soft\|bg-danger-soft" dist/assets/*.css | sort -u` → deben aparecer las tres.
- [ ] **Step 3:** Verificar visual: `shot-view` de un tablero con tareas con vencimiento → los badges "Vence dd/mm" (amarillo suave), "Venció" (rojo suave) y los chips de checklist/esfuerzo ahora tienen fondo. Comparar claro y oscuro.
- [ ] **Step 4:** Commit — `git add tailwind.config.js && git commit -m "fix(css): chip/warn-soft/danger-soft compilan como utilidades — badges recuperan su fondo (Kaizen H1)"`

---

### Task 2: Modal de tarea — selector de estado + guardado claro (bug reportado #1)

**Files:**
- Modify: `src/features/board/CardModal.tsx` (encabezado ~línea 150 y pie ~409-426)

**Interfaces:**
- Consumes: `patch.mutate(p: Partial<Card>)`, `hist(txt)`, `COLS` de types, `locked`.
- El guardado ya es AUTOMÁTICO campo a campo (onChange/onBlur); el problema es que no se comunica y el único cambio de estado posible es "Marcar terminada".

- [ ] **Step 1: Selector de estado en el encabezado.** Reemplazar la línea `<div className="text-xs text-ink2 mb-3.5">Estado: {estLbl}…</div>` por un select accionable (deshabilitado si `locked`):
```tsx
<div className="flex items-center gap-2 text-xs text-ink2 mb-3.5">
  <label className="flex items-center gap-1.5">Estado
    <select value={c.status} disabled={locked}
      onChange={(e) => {
        const s = e.target.value as Card["status"];
        patch.mutate(s === "term"
          ? { status: "term", done_at: new Date().toISOString(), history: hist("Marcó terminada") }
          : { status: s, done_at: null, history: hist(s === "proc" ? "Pasó a En proceso" : "Volvió a Pendiente") });
      }}
      className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-[13px] disabled:opacity-60">
      {COLS.map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
    </select>
  </label>
  {c.done_at && <span>terminada el {fmtDateTime(c.done_at)}</span>}
</div>
```
  Nota: el cambio de estado debe pasar por `patch` (que ya sincroniza tareas compartidas con `siblingSyncPatches` cuando `p.status` cambia — NO duplicar esa lógica).
- [ ] **Step 2: Pie con guardado claro.** Reemplazar el botón "Cerrar" del pie por **"Guardar y cerrar"** (mismo `onClick={onClose}` — todo ya está guardado; el rótulo elimina la ansiedad de "no pude guardar"). Junto al pie, agregar una leyenda persistente a la izquierda: `<span className="text-[11.5px] text-ink2">Los cambios se guardan automáticamente.</span>`. Mantener "Marcar terminada" como acceso rápido cuando `c.status !== "term"` PERO corregir su clase: `text-white` → `text-[color:var(--accent-ink)]` (en oscuro el acento es plata y el texto blanco no se lee).
- [ ] **Step 3:** Confirmar que el alta de tareas sigue creando en `pend` cuando se usa "+ Añadir tarea" de la columna Pendiente (Board `addInline` ya inserta con el status de la columna — no tocar). 
- [ ] **Step 4:** Build + smoke + verificación visual del modal (abrir una tarea con puppeteer o revisar screenshot). Commit — `git commit -m "feat(modal): selector de estado + Guardar y cerrar + autoguardado visible (bug #1)"`

---

### Task 3: Logo fiel al oficial — SVG con el arco que corta el marco + PNG transparente (spec 20 #1)

**Files:**
- Modify: `src/components/Logo.tsx`
- Create: `scripts/logo-png.mjs` (genera PNG 1024 transparente desde el SVG con Edge headless)
- Regenerate: `public/favicon.svg`, `public/icon-192.png`, `public/icon-512.png`, `public/logo-1024.png`

**Interfaces:**
- Referencia visual: `C:/Users/Vmagni/Desktop/GRUPO PARIS/logo.jpg` (oficial). Diferencia clave con la recreación actual: en el oficial, el **arco atraviesa el marco y la P interrumpiéndolos** (hay un corte/gap donde pasa), no superpuesto encima.

- [ ] **Step 1:** Reescribir `LogoMark` usando una **máscara** que recorte una banda a lo largo del arco (eso reproduce el "corte" del oficial):
```tsx
export function LogoMark({ size = 34, className = "" }: { size?: number; className?: string }) {
  const uid = "cut-logo"; // id estable: un solo LogoMark visible por vista
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role="img" aria-label="Grupo Paris">
      <defs>
        <mask id={uid}>
          <rect width="64" height="64" fill="white" />
          <path d="M1 45 C 20 61 46 54 63 27" stroke="black" strokeWidth="9" fill="none" />
        </mask>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="13" stroke="currentColor" strokeWidth="4.5" mask={`url(#${uid})`} />
      <path d="M24 49 V15 H40 C47 15 51 19.5 51 25.5 C51 31.5 47 36 40 36 H31 V49 Z M31 21.5 V29.5 H39 C42 29.5 44 28 44 25.5 C44 23 42 21.5 39 21.5 Z"
        fill="currentColor" fillRule="evenodd" mask={`url(#${uid})`} />
      <path d="M1 45 C 20 61 46 54 63 27" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}
```
- [ ] **Step 2: Comparación lado a lado OBLIGATORIA.** Capturar el login (`shot-view` dark), abrir `logo.jpg` con Read, y comparar: posición/curvatura del arco, grosor del marco, proporciones de la P. Ajustar los puntos de control del path (`M1 45 C 20 61 46 54 63 27`) hasta que el corte pase por los mismos lugares que el oficial (en el oficial el arco entra por el borde izquierdo bajo la P y sale cortando el lateral derecho a media altura). Iterar hasta que el parecido sea fiel.
- [ ] **Step 3: PNG transparente.** Crear `scripts/logo-png.mjs`: renderiza el SVG (blanco) a 1024×1024 con `page.screenshot({ omitBackground: true })` de puppeteer-core (Edge del sistema) y guarda `public/logo-1024.png` (fondo transparente, P blanca — para usos sobre fondo oscuro). Generar también la variante negra si es trivial (mismo SVG con `color:#0b0b0d`).
- [ ] **Step 4:** Actualizar `public/favicon.svg` y regenerar `icon-192/512.png` (vía `scripts/icons.mjs`) con la marca ajustada, manteniendo fondo negro + P blanca. Build + verificación visual final del login y sidebar.
- [ ] **Step 5:** Commit — `git commit -m "fix(identidad): logo fiel al oficial (arco que corta marco y P) + PNG transparente 1024 (spec 20 #1)"`

---

### Task 4: Code-split del bundle (Kaizen H2)

**Files:**
- Modify: `src/App.tsx` (imports de vistas → `lazy`)
- Modify: `vite.config.ts` (opcional: `rollup-plugin-visualizer` solo en modo analyze)

**Interfaces:**
- Bundle actual ~830KB minificado en un solo chunk. Vistas candidatas a lazy: `Reporte`, `Calendario`, `Cierre`, `Organigrama`, `Notas`, `Bitacora`, `Admin` (no se usan en el primer render del tablero).

- [ ] **Step 1:** `npm i -D rollup-plugin-visualizer`. En `vite.config.ts`, agregarlo solo bajo `process.env.ANALYZE`: `plugins: [react(), ...(process.env.ANALYZE ? [visualizer({ filename: "dist/stats.html", gzipSize: true })] : [])]`. Script `"analyze": "cross-env-free ANALYZE=1 npm run build"` — en Bash alcanza `ANALYZE=1 npm run build` (documentarlo, no hace falta cross-env).
- [ ] **Step 2:** En `App.tsx`, convertir las 7 vistas listadas a `const Reporte = lazy(() => import("./features/reporte/Reporte").then(m => ({ default: m.Reporte })))` (idem las demás) y envolver el árbol de vistas en `<Suspense fallback={<div className="px-6 py-8 text-ink2 text-sm">Cargando…</div>}>`. Login/Shell/Board/Resumen quedan eager (primer render).
- [ ] **Step 3:** Build y comparar: el chunk inicial debe bajar sustancialmente (meta: warning de 500KB desaparece o el entry queda <500KB; los charts/vistas van a chunks propios). Registrar números antes/después en el commit.
- [ ] **Step 4:** `npm run smoke` COMPLETO (recorre todas las vistas → valida que los chunks lazy cargan sin error). Commit — `git commit -m "perf(bundle): code-split de 7 vistas con lazy/Suspense + visualizer opt-in (Kaizen H2)"`

---

### Task 5: Estandarización 5S — EmptyState, prefs de localStorage y atajos visibles (Kaizen H5/H6/H8)

**Files:**
- Create: `src/components/EmptyState.tsx`
- Create: `src/lib/prefs.ts` + `src/lib/prefs.test.ts`
- Modify: `src/components/Shell.tsx` (hint de atajos en el menú de usuario)

- [ ] **Step 1 (H6):** `EmptyState.tsx`: componente único para estados vacíos:
```tsx
import type { ReactNode } from "react";
export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-line rounded-xl px-4 py-8 text-center">
      {icon && <div className="mx-auto mb-2 text-ink2 w-fit">{icon}</div>}
      <p className="text-ink font-semibold text-sm m-0">{title}</p>
      {hint && <p className="text-ink2 text-[13px] m-0 mt-1 max-w-[420px] mx-auto">{hint}</p>}
    </div>
  );
}
```
  Reemplazar los vacíos ad-hoc en al menos: Board ("Sin tareas acá."), Resumen ("Nada trabado."), Huerfanas, Notas, Cierre (mantener sus textos, unificar la presentación). No hace falta tocar los 18 archivos: los 5 más visibles.
- [ ] **Step 2 (H8):** `src/lib/prefs.ts`: única puerta a localStorage con claves namespaced:
```ts
const NS = "tablero:";
export const PREF = { theme: NS+"theme", density: NS+"density", sidebar: NS+"sidebar", version: NS+"version-vista", tablon: NS+"tablon-visto" } as const;
export function getPref(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
export function setPref(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* storage lleno/privado */ } }
// migra las claves viejas una sola vez (pref-theme, pref-density, pref-sidebar, version-vista, tablon-visto)
export function migrarPrefs(): void {
  const mapa: Record<string, string> = { "pref-theme": PREF.theme, "pref-density": PREF.density, "pref-sidebar": PREF.sidebar, "version-vista": PREF.version, "tablon-visto": PREF.tablon };
  for (const [vieja, nueva] of Object.entries(mapa)) {
    const v = getPref(vieja);
    if (v !== null && getPref(nueva) === null) setPref(nueva, v);
  }
}
```
  Test: `migrarPrefs` copia la clave vieja a la nueva sin pisar valores nuevos existentes (mock de localStorage simple en el test con `Object.defineProperty` o stub global). Reemplazar los accesos directos en `useTheme.ts`, `Shell.tsx`, `App.tsx` por `getPref/setPref` y llamar `migrarPrefs()` una vez en `main.tsx`.
- [ ] **Step 3 (H5):** Atajos visibles: en el menú de usuario del Shell agregar ítem no-accionable o tooltip "Atajos: Ctrl+K buscar · Ctrl+Z deshacer" (ícono `Keyboard` de lucide). El CommandPalette ya muestra sus propias teclas.
- [ ] **Step 4:** Gates + commit — `git commit -m "refactor(5s): EmptyState unificado, prefs namespaced con migración y atajos visibles (Kaizen H5/H6/H8)"`

---

### Task 6: Herramientas — la siguiente vuelta de rosca (front/back/fullstack)

**Files:**
- Modify: `package.json` (deps + scripts), `vite.config.ts` (jsdom para tests de componente)
- Create: `src/components/EmptyState.test.tsx` (primer test de componente real)
- Create: `e2e/a11y.spec.ts` (auditoría de accesibilidad)
- Modify: `docs/TOOLING-UPGRADES.md` (registrar la tanda 2)

- [ ] **Step 1 (FULLSTACK — knip, código muerto = Seiri):** `npm i -D knip`. Script `"deadcode": "knip"`. Correrlo, revisar el reporte: borrar SOLO lo obviamente muerto (ej. `src/assets/react.svg`, `src/assets/vite.svg`, `src/App.css` si no se importa, exports sin uso). Lo dudoso se lista en el commit sin borrar.
- [ ] **Step 2 (FRONT — Testing Library, tests de componente):** `npm i -D @testing-library/react @testing-library/jest-dom jsdom`. En `vite.config.ts` → `test: { include: ["src/**/*.test.{ts,tsx}"], environment: "jsdom" }`. Escribir `EmptyState.test.tsx` (render título/hint) y un test de `DeltaChip` o `NovedadesModal` (render de contenido). TDD: correr FAIL→PASS.
- [ ] **Step 3 (FRONT — a11y con axe):** `npm i -D @axe-core/playwright`. `e2e/a11y.spec.ts`: tras login, correr `new AxeBuilder({ page }).analyze()` en Resumen y Login; asertar 0 violaciones `critical`. Si aparecen violaciones críticas reales, arreglarlas (labels, contraste, roles) — eso ES la vuelta de rosca.
- [ ] **Step 4 (BACK/DX — Query Devtools):** `npm i -D @tanstack/react-query-devtools`; montarlas solo en dev: `{import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}` en `main.tsx`. Cero impacto en prod.
- [ ] **Step 5:** Actualizar `docs/TOOLING-UPGRADES.md` con la sección "Tanda 2 (16/07)": qué se instaló, por qué, cómo se corre (`npm run deadcode`, `npm run e2e`, `ANALYZE=1 npm run build`). Estado de los pospuestos (Sentry sigue esperando DSN; gen:types sigue esperando `npx supabase login`).
- [ ] **Step 6:** Gates completos (test/build/smoke/e2e). Commit — `git commit -m "chore(tooling): tanda 2 — knip, Testing Library+jsdom, axe a11y, Query Devtools (Kaizen)"`

---

### Task 7: Recurrencia en 1 clic (Kaizen H3) + propuestas pendientes de OK

**Files:**
- Modify: `src/features/board/CardModal.tsx` (sección Recurrencia)
- Modify: `docs/KAIZEN-HALLAZGOS.md` (estado de cada hallazgo)

- [ ] **Step 1 (H3):** En la sección Recurrencia del CardModal, agregar 3 chips de preset de un clic ANTES del select: "Todos los días" → `{tipo:"diaria"}`; "Cada jueves" → `{tipo:"semanal",dias:[4]}`; "Día 20 de cada mes" → `{tipo:"mensual",diaMes:20}`. Cada chip setea el estado del formulario Y dispara `guardarRecur.mutate()` directamente (1 clic total). Estilo chip: `border border-line bg-surface2 rounded-full px-3 py-1 text-[12px] hover:border-accent`.
- [ ] **Step 2:** Actualizar `KAIZEN-HALLAZGOS.md`: marcar H1/H2/H3/H5/H6/H8 como APLICADOS (con hash de commit); H4 (dedupe Tablón↔Calendario) y H7 (desacoplar undo) quedan PROPUESTOS esperando decisión del usuario, con su análisis de opciones.
- [ ] **Step 3:** Gates + commit — `git commit -m "feat(recurrencia): presets de 1 clic + estado de hallazgos Kaizen (H3)"`

## Self-review
- Bug #1 del usuario → Task 2 (selector de estado + guardado claro; default pendiente ya garantizado por columna). Logo → Task 3 (conversión SVG/PNG la hago yo, comparación obligatoria contra logo.jpg). Kaizen aplicado → Tasks 1 (H1), 4 (H2), 5 (H5/H6/H8), 7 (H3; H4/H7 documentados como propuesta). Herramientas front/back/fullstack → Task 6 (knip, Testing Library, axe, Devtools, visualizer en Task 4).
- Sin migraciones: todo desplegable antes/después de la migración de datos de hoy. Sin placeholders; tipos consistentes con el código real (COLS, patch, RecurRule).
