# Plan 20A — Refinamiento Visual y UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Checkbox steps.

**Goal:** Elevar la calidad visual a nivel software empresarial: identidad correcta (logo/favicon), gráficos corporativos en escala de grises, layout equilibrado con la barra colapsada, respiración en modo oscuro, barra lateral fija por decisión del usuario, y aviso de nuevas versiones. Todo SIN migración → desplegable de inmediato.

**Architecture:** Cambios acotados a componentes/CSS existentes (`index.css` tokens, `Shell.tsx`, `charts.tsx`, `Logo.tsx`, `public/`). Reutiliza el sistema de tokens y el patrón de vistas. Sin cambios de datos.

**Tech Stack:** React 19, Tailwind, CSS variables, Vite/PWA, vitest.

## Global Constraints
- Node portable: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`.
- Cero emojis (solo Lucide). Paleta monocroma negro/blanco/gris; color solo en estados. Minimalista, elegante, corporativo.
- Responsive + compatible PWA. Reutilizar componentes; evitar complejidad.
- Verificar visual con `node scripts/shot-view.mjs http://localhost:8124 <out> "<Vista>" dark` (y `light`).

---

### Task 1: Favicon e íconos PWA = isotipo Paris (spec #2)

**Files:**
- Replace: `public/favicon.svg` (hoy es un rayo violeta #863bff, sobra del template)
- Regenerate: `public/icon-192.png`, `public/icon-512.png` (via `scripts/icons.mjs`)
- Verify: `index.html` (link al favicon), `public/manifest.webmanifest`

- [ ] **Step 1:** Reemplazar `public/favicon.svg` por el isotipo: cuadrado negro redondeado con la "P" blanca (reutilizar el path de `src/components/Logo.tsx` `LogoMark`, fondo negro `#0b0b0d`, P en blanco). Ejemplo:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b0b0d"/><path d="M24 49 V15 H40 C47 15 51 19.5 51 25.5 C51 31.5 47 36 40 36 H31 V49 Z M31 21.5 V29.5 H39 C42 29.5 44 28 44 25.5 C44 23 42 21.5 39 21.5 Z" fill="#fff" fill-rule="evenodd"/></svg>
```
- [ ] **Step 2:** Regenerar los PNG de la PWA con el mismo isotipo: revisar `scripts/icons.mjs` (ya existe) y correrlo, o crear los PNG 192/512 con fondo negro + P blanca. Verificar que `manifest.webmanifest` apunte a esos archivos (ya lo hace).
- [ ] **Step 3:** Confirmar en `index.html` que el `<link rel="icon">` apunta a `/favicon.svg`. Build. Abrir la app y ver la pestaña con la P (no el rayo).
- [ ] **Step 4:** Commit — `git add public/ index.html && git commit -m "fix(identidad): favicon e íconos PWA = isotipo Paris, adiós el rayo (spec #2)"`

---

### Task 2: Logo exacto al oficial (spec #1)

**Files:**
- Modify: `src/components/Logo.tsx`
- Possibly add: `src/assets/logo-oficial.svg` (si el usuario provee el vector oficial)

**Interfaces:**
- `LogoMark({ size, className })` sigue exportándose igual (no romper sus usos en Shell/Login).

- [ ] **Step 1: DECISIÓN DE INSUMO (bloqueante para pixel-perfect).** El `LogoMark` actual es una recreación. Para que sea EXACTO al manual de identidad hacen falta los vectores oficiales. Opciones:
  - (a) El usuario provee el **SVG oficial** (ideal) → se incrusta tal cual como `logo-oficial.svg` y `LogoMark` lo renderiza.
  - (b) Solo hay `logo.jpg` (raster, fondo negro, P blanca) en `Desktop/GRUPO PARIS/` → usarlo como imagen para fondos oscuros (sidebar/login) es pixel-perfect ahí, pero no escala ni sirve para fondo claro. 
  - Registrar la decisión antes de tocar código. Recomendado: pedir el SVG/PNG de alta con transparencia.
- [ ] **Step 2:** Con el insumo elegido, ajustar `LogoMark` para reproducir proporciones/márgenes del oficial (el arco inferior actual NO está en el logo oficial de la imagen — evaluar quitarlo si difiere). Mantener `currentColor` para que funcione en claro y oscuro.
- [ ] **Step 3:** Verificar visual en sidebar y login (`shot-view` login dark). Build. Commit — `git commit -m "fix(identidad): logo fiel al manual oficial (spec #1)"`

---

### Task 3: Barra lateral fija por decisión del usuario (spec #9)

**Files:**
- Modify: `src/components/Shell.tsx` (`NavItem`, línea del `onClick` que hace `setOpen(false)`)

**Interfaces:**
- El estado `open` ya se persiste en `localStorage("pref-sidebar")`. El bug: `NavItem` cierra la barra al navegar.

- [ ] **Step 1:** En `NavItem`, el `onClick` hace `{ onNavigate(v); setOpen(false); }`. En ESCRITORIO no debe cerrarse al navegar; solo en móvil (para liberar la pantalla). Cambiar a: cerrar solo si es viewport chico. Ej:
```tsx
onClick={() => { onNavigate(v); if (window.innerWidth < 768) setOpen(false); }}
```
- [ ] **Step 2:** Confirmar que el botón Menú del topbar sigue siendo el único toggle manual en escritorio y que el estado persiste entre secciones y recargas.
- [ ] **Step 3:** Build + smoke. Commit — `git commit -m "fix(ux): la barra lateral no se cierra sola al navegar; estado manual persistente (spec #9)"`

---

### Task 4: Layout equilibrado con la barra colapsada (spec #6)

**Files:**
- Modify: `src/components/Shell.tsx` (contenedor `<main>`)

**Interfaces:**
- Con la barra colapsada (`md:w-0`), `<main>` ocupa todo el ancho pero el contenido de cada vista tiene `max-w` fijo alineado a la izquierda → vacío a la derecha.

- [ ] **Step 1:** Centrar el contenido cuando la barra está colapsada: envolver `{children}` en un contenedor que centre y limite el ancho útil de forma responsiva. Ej. en `<main>` agregar un wrapper `<div className="mx-auto w-full max-w-[1200px]">{children}</div>` (o aplicar `mx-auto` condicional). Como las vistas ya traen su propio `max-w-[960px]`, alcanzarlos a centrar con `mx-auto` elimina el vacío a la derecha y deja la interfaz equilibrada tanto abierta como colapsada.
- [ ] **Step 2:** Verificar visual en Resumen y en un Tablero, con la barra ABIERTA y COLAPSADA, en 1440px (`shot-view` dos veces). Confirmar que no queda el gran vacío a la derecha.
- [ ] **Step 3:** Build + smoke. Commit — `git commit -m "fix(layout): contenido centrado/equilibrado con la barra colapsada (spec #6)"`

---

### Task 5: Respiración de tarjetas en modo oscuro (spec #7)

**Files:**
- Modify: `src/index.css` (variables de modo oscuro: `--surface`, `--line`, sombras)
- Posible: `src/features/board/Board.tsx` (gaps de columnas)

**Interfaces:**
- En oscuro `--bg:#0b0b0c` y `--surface:#161618` son muy cercanos → las tarjetas "se pegan". Mejorar separación con más contraste de superficie, bordes visibles y sombra sutil (sin tocar el modo claro, que ya está bien).

- [ ] **Step 1:** En el bloque `:root[data-theme="dark"]` (y el `@media (prefers-color-scheme: dark)`): subir levemente `--surface` a `#1b1b1e` y `--surface2` a `#232327` para separar del `--bg #0b0b0c`; hacer `--line` un poco más claro (`#33333a`) para que los bordes de tarjeta se noten; reforzar `--shadow` en oscuro (sombra más marcada). Cambiar SOLO el modo oscuro.
- [ ] **Step 2:** En el Board, aumentar el `gap` entre columnas y el `mb` entre tarjetas si hace falta (ej. `gap-5` en el contenedor de columnas, `mb-2.5` en `CardItem`). Mantener consistencia con el resto.
- [ ] **Step 3:** Verificar visual: `shot-view "Resumen" dark` y un tablero dark; confirmar que las tarjetas "respiran" y se distinguen. Que el modo claro NO cambie.
- [ ] **Step 4:** Build + smoke. Commit — `git commit -m "fix(oscuro): más separación/profundidad entre tarjetas y contenedores (spec #7)"`

---

### Task 6: Paleta de gráficos corporativa (spec #5)

**Files:**
- Modify: `src/components/charts.tsx` (Gauge/Donut/Legend)
- Modify: `src/features/reporte/Reporte.tsx` (paleta CAT del donut de personas)
- Modify: `src/features/resumen/Resumen.tsx` (Bars ya es monocromo — verificar)

**Interfaces:**
- Criterio spec: métrica única → escala de grises; comparativos → mínimos colores necesarios. Evitar saturados.

- [ ] **Step 1: Gauges (métrica única).** En `Reporte.tsx`, los 3 medidores (Salud/Avance/A tiempo) hoy usan ámbar/grafito/verde según umbral. Pasarlos a **escala de grises** con un único acento de estado solo cuando es crítico: relleno del gauge en grafito (`var(--ink2)`/`var(--accent)`), y el texto de estado ("Atención"/"Crítico") en color solo si es negativo (danger). Métrica sola = gris.
- [ ] **Step 2: Donut comparativo de personas.** Reducir la paleta `CAT` (hoy 8 colores) a los **mínimos necesarios**: usar una escala de grises + 1 acento para el máximo, o máximo 3-4 tonos desaturados. Evitar el arcoíris.
- [ ] **Step 3: Donut "Tareas por estado".** Mantener semántico pero desaturado (pendiente=gris medio, en proceso=gris oscuro, terminado=verde tenue) — mínimos colores.
- [ ] **Step 4:** Verificar visual `shot-view "Reporte ejecutivo" light` y `dark`. Debe verse ejecutivo/sobrio.
- [ ] **Step 5:** Build + smoke. Commit — `git commit -m "feat(charts): paleta corporativa en escala de grises, mínimos colores (spec #5)"`

---

### Task 7: Aviso de nuevas versiones + Changelog (spec #10)

**Files:**
- Create: `src/lib/version.ts` (versión actual + changelog estático)
- Create: `src/components/NovedadesModal.tsx`
- Modify: `src/App.tsx` (mostrar el modal una vez tras actualizar) + `src/components/Shell.tsx` (acceso al changelog desde el menú de usuario)

**Interfaces:**
- Produces: `APP_VERSION` (string) y `CHANGELOG: { version, fecha, cambios: string[] }[]`.

- [ ] **Step 1:** `src/lib/version.ts` con `APP_VERSION = "2.1.0"` y un array `CHANGELOG` con las entradas (mejoras/nuevas funciones/correcciones). Test simple: la primera entrada del changelog coincide con `APP_VERSION`.
- [ ] **Step 2:** `NovedadesModal` (reusa `Modal`): título "Novedades", lista de cambios de la última versión, y opción "Ver historial completo" que despliega todo el changelog. Botón "Entendido".
- [ ] **Step 3:** En `App.tsx`: al montar, comparar `APP_VERSION` con `localStorage("version-vista")`. Si difieren → mostrar `NovedadesModal` una vez y guardar la versión. Además, en el menú de usuario del Shell agregar "Novedades / Changelog" para abrirlo cuando quieran.
- [ ] **Step 4:** Verificar visual. Build + smoke. Commit — `git commit -m "feat(ux): aviso de nueva versión + changelog consultable (spec #10)"`

---

### Task 8: Hallazgos Kaizen/5S (spec #3) — documento

**Files:**
- Create: `docs/KAIZEN-HALLAZGOS.md`

- [ ] **Step 1:** Documentar hallazgos detectados analizando el sistema (clics/procesos innecesarios, duplicación, oportunidades de automatización), cada uno mapeado a un principio 5S y con propuesta antes de implementar. Ejemplos a incluir: (Seiton) unificar accesos duplicados; (Seiso) estados vacíos consistentes; (Kaizen) reducir clics en alta de tareas recurrentes; (Seiketsu) estandarizar tokens de spacing. NO implementar sin OK; este task solo PROPONE (lo pide la spec).
- [ ] **Step 2:** Commit — `git commit -m "docs(kaizen): hallazgos 5S/Kaizen propuestos para revisión (spec #3)"`

## Self-review
- Cobertura: #1(T2), #2(T1), #3(T8), #5(T6), #6(T4), #7(T5), #9(T3), #10(T7). #4 y #8 van en el Plan 20B (necesitan migración). Sin placeholders. Todos sin migración → desplegables ya.
- T2 (#1 logo) tiene un bloqueante de insumo: pedir el vector oficial para pixel-perfect.
