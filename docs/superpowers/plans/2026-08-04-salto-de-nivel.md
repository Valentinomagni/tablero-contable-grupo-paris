# Salto de nivel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar las cuatro brechas medidas que separan a este proyecto de un producto de equipo senior: no saber cuándo se rompe, la interfaz sin pruebas, el peso de arranque, y la imposibilidad de instalar dependencias.

**Architecture:** El desbloqueo viene primero — un workflow de GitHub Actions que instala dependencias con el npm del runner y commitea el lockfile, lo que elimina la restricción que venía condicionando todo. Sobre eso se apoyan el monitoreo de errores y las pruebas de interfaz. En paralelo, dos podas de peso que no dependen de nada.

**Tech Stack:** React 19, TypeScript, Vite/rolldown, vitest, Playwright, GitHub Actions, Sentry.

---

## El diagnóstico, con números medidos hoy

No impresiones — mediciones sobre el repo al 04/08/2026.

### Lo que ya está a nivel

| | |
|---|---|
| Lógica de negocio | **96 de 98 libs con tests**. 1158 tests, todos verdes |
| Tipos | `tsc` sin errores, cero `any` en 17.299 líneas |
| Higiene | cero `console.log`, cero tamaños de letra a mano, cero superficie de XSS |
| Sistema visual | documentado, con dos tests guardianes que impiden que se erosione |
| Seguridad | RLS con helpers, trigger de columnas sensibles, Edge Functions que validan rol contra la base |
| Proceso | CI con lint + tests + build + e2e, Dependabot, auditoría semanal |

Eso es más disciplina de la que tiene la mayoría de los productos que se venden.

### Las cuatro brechas reales

**1. Nadie se entera cuando la app se rompe.**
`ErrorBoundary.tsx` tiene literalmente un `// TODO: cuando se enchufe Sentry`. Hoy, si a un empleado se le rompe una pantalla, la única forma de saberlo es que lo cuente. Un equipo senior no despacha sin esto — y no por prolijidad: **sin monitoreo, el tiempo entre que algo se rompe y que alguien se entera se mide en días.**

**2. La interfaz no tiene pruebas.**
47 componentes de pantalla, **5 archivos de test**. La lógica es a prueba de balas y la interfaz no tiene red. Los bugs de esta semana lo confirman: el podio en el Reporte, el sello de confianza nunca conectado, el `div` que no se podía abrir con teclado — **ninguno lo encontró un test; los encontró una auditoría.**

**3. El arranque pesa de más, y una parte es gratis de sacar.**

```
index.js          549 kB  (158 kB gzip)   ← todo el mundo, siempre
vendor-supabase   204 kB  ( 52 kB gzip)
vendor-motion     129 kB  ( 42 kB gzip)   ← una animación de modal
vendor-query       29 kB  (  9 kB gzip)
index.css          30 kB  (  7 kB gzip)
                 ─────────────────────
                          ~268 kB gzip
```

`vendor-motion` son **42 kB comprimidos que baja cada persona cada vez**, y se usan en **un solo archivo**: la animación de `Modal.tsx`. El proyecto ya tiene `@keyframes aparecer` en `index.css` haciendo exactamente eso sin librería.

(`xlsx`, que pesa 425 kB, ya se carga sólo al exportar. Eso está bien resuelto.)

**4. La restricción que condicionaba todo era falsa.**

Veníamos diciendo "no hay npm, no se puede instalar nada". Es cierto **en tu máquina**. Pero `.github/workflows/main.yml` corre `npm ci` en un runner de Ubuntu: **el CI tiene npm.** Se puede delegar la instalación ahí y commitear el `package-lock.json` resultante.

Eso desbloquea Sentry, las utilidades de test de interfaz, el análisis de bundle, y de paso permite sacar las 6 dependencias muertas que arrastramos hace semanas.

---

## Global Constraints

- **En esta máquina no hay npm** — pero el CI sí. Toda instalación pasa por la Task 1.
- `node` en `C:\Users\Vmagni\AppData\Local\OpenAI\Codex\bin\node.exe`. Bash:
  `export PATH="/c/Users/Vmagni/AppData/Local/OpenAI/Codex/bin:$PATH"`
- Tests `node node_modules/vitest/vitest.mjs run` · Tipos `node node_modules/typescript/bin/tsc -b`
  · Lint `node node_modules/oxlint/bin/oxlint` · Build `node node_modules/vite/bin/vite.js build`
- Exit codes explícitos: `comando > /tmp/log 2>&1; echo "EXIT: $?"`. Nunca `comando | tail`.
- **El pre-commit tarda 90-180 s.** Timeout de **420000 ms** en `git commit`. Heredoc de Bash.
- **Cero emojis.** Iconos sólo de `lucide-react`.
- **Nada de `text-[Npx]`**: escala `text-2xs` … `text-4xl`. Hay guardián.
- Tarjetas con `<Panel>`. Hay guardián con escape `panel-guard-ok`.
- **Encuadre no punitivo.** Hay guardián (`src/lib/encuadre.guard.test.ts`).
- Ningún error muestra el mensaje crudo de la base: todo por `mensajeUsuario()`.
- **Nunca editar JSX con expresiones regulares ni `sed`.**
- Comentarios en español explicando el **por qué**.
- Base al empezar: **1158 tests / 103 archivos**.

---

### Task 1: Instalar dependencias desde el CI (el desbloqueo)

**Files:**
- Create: `.github/workflows/dependencias.yml`
- Create: `docs/COMO-INSTALAR-DEPENDENCIAS.md`

**Interfaces:** ninguna de código. Habilita las Tasks 2, 4 y 6.

**Por qué primero.** Sin esto, tres de las cinco tareas que siguen son imposibles. Con esto, la
frase "no se puede instalar nada" deja de ser cierta para siempre.

- [ ] **Step 1: Write the workflow**

Crear `.github/workflows/dependencias.yml`:

```yaml
# Instalar o quitar dependencias sin tener npm en la máquina de trabajo.
#
# POR QUÉ EXISTE. En la máquina donde se desarrolla no hay npm, pnpm ni yarn, así que durante
# semanas la conclusión fue "no se pueden agregar dependencias". Era falsa: el runner de
# GitHub Actions SÍ tiene npm. Este workflow lo usa, corre la verificación completa, y
# commitea `package.json` + `package-lock.json` sincronizados.
#
# Se dispara A MANO desde la pestaña Actions, nunca solo: instalar una dependencia es una
# decisión, no algo que deba pasar por accidente.
name: Dependencias
on:
  workflow_dispatch:
    inputs:
      accion:
        description: "Qué hacer"
        required: true
        type: choice
        options: [instalar, quitar]
      paquetes:
        description: "Paquetes separados por espacio (ej: @sentry/react)"
        required: true
        type: string
      dev:
        description: "¿Es dependencia de desarrollo?"
        required: false
        type: boolean
        default: false

permissions:
  contents: write

jobs:
  dependencias:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Aplicar el cambio
        run: |
          if [ "${{ inputs.accion }}" = "instalar" ]; then
            npm install ${{ inputs.dev && '--save-dev' || '--save' }} ${{ inputs.paquetes }}
          else
            npm uninstall ${{ inputs.paquetes }}
          fi

      # Verificación ANTES de commitear. Una dependencia que rompe el build no entra: sin
      # este paso, el workflow podría dejar `main` en rojo y nadie se entera hasta el
      # siguiente push.
      - run: npm run lint
      - run: npm run test
      - run: npm run build

      - name: Commitear el cambio
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          if git diff --quiet package.json package-lock.json; then
            echo "No hubo cambios en las dependencias."
            exit 0
          fi
          git add package.json package-lock.json
          git commit -m "chore: ${{ inputs.accion }} ${{ inputs.paquetes }}

          Aplicado desde el workflow Dependencias porque la maquina de trabajo
          no tiene npm. Lint, tests y build pasaron antes de commitear.

          Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
          git push
```

- [ ] **Step 2: Write the doc**

Crear `docs/COMO-INSTALAR-DEPENDENCIAS.md`:

```markdown
# Cómo instalar o sacar una dependencia

En esta máquina no hay npm. El runner de GitHub Actions sí, así que se delega ahí.

## Los pasos

1. GitHub → pestaña **Actions** → workflow **Dependencias** → **Run workflow**
2. Elegí:
   - **Qué hacer**: `instalar` o `quitar`
   - **Paquetes**: separados por espacio, por ejemplo `@sentry/react`
   - **¿Es dependencia de desarrollo?**: marcar si es sólo para tests o herramientas
3. Run workflow. Tarda unos 3 minutos.
4. Cuando termina, hacé **Fetch** en GitHub Desktop para traer el commit.
5. Acá corré `git pull` — y listo, `node_modules` local queda desactualizado pero eso no
   importa: el proyecto ya trae las dependencias instaladas y el CI usa las suyas.

**Si el workflow falla en rojo, no commitea nada.** Corre lint, tests y build antes de
commitear justamente para que una dependencia que rompe el proyecto no entre.

## Por qué no se hace solo

Instalar una dependencia es una decisión: agrega superficie, peso y algo más que mantener.
El workflow se dispara a mano a propósito.

## Lo que esto desbloquea

Durante semanas la conclusión fue "no se puede instalar nada, no hay npm". Era falsa: no hay
npm **acá**. Con esto se pueden agregar herramientas de monitoreo, de pruebas y de análisis, y
también **sacar** las que no se usan — que estaban bloqueadas por no poder regenerar el
`package-lock.json`.
```

- [ ] **Step 3: Verify the YAML is valid**

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = readFileSync('.github/workflows/dependencias.yml','utf8');
if (t.includes('\t')) throw new Error('YAML con tabulaciones: usa espacios');
console.log('lineas:', t.split('\n').length);
console.log('tiene workflow_dispatch:', t.includes('workflow_dispatch'));
console.log('tiene permissions contents write:', /permissions:[\s\S]*contents:\s*write/.test(t));
" > /tmp/y.log 2>&1; echo "EXIT: $?"; cat /tmp/y.log
```
Expected: `EXIT: 0`, y los dos `true`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/dependencias.yml docs/COMO-INSTALAR-DEPENDENCIAS.md
git commit -m "feat: instalar dependencias desde el CI, que si tiene npm"
```

**Después de publicar esto**, el usuario tiene que correr el workflow una vez para instalar lo
que necesitan las Tasks 2 y 4:

```
instalar   @sentry/react
instalar   @testing-library/user-event   (marcando "dependencia de desarrollo")
quitar     @base-ui/react class-variance-authority clsx shadcn tailwind-merge tw-animate-css
```

---

### Task 2: Sacar `motion` — 42 kB gzip de arranque por una animación

**Files:**
- Modify: `src/components/Modal.tsx`
- Modify: `src/index.css`
- Modify: `vite.config.ts` (sacar el chunk `vendor-motion` si está declarado)

**Interfaces:** ninguna nueva. `Modal` mantiene exactamente la misma firma.

**Esta task NO depende de la Task 1** para el cambio de código — sólo el `npm uninstall` final,
que se hace después con el workflow.

- [ ] **Step 1: See what motion is actually doing**

```bash
grep -n "motion" src/components/Modal.tsx
grep -n "vendor-motion\|motion" vite.config.ts
```

Anotá exactamente qué animación aplica: opacidad, escala, desplazamiento, duración.

- [ ] **Step 2: Replicate it with CSS**

En `src/index.css`, junto a los `@keyframes` que ya existen (`aparecer`, `latir`), agregar lo
que haga falta para reproducir la animación observada. Si el modal hace fade + scale, por
ejemplo:

```css
/* Entrada del modal. Reemplaza a la librería `motion`, que pesaba 42 kB comprimidos en el
   arranque de TODA la app para animar este único componente. Se anima sólo opacidad y
   transform, que el navegador compone en GPU. `prefers-reduced-motion` ya está respetado
   globalmente más abajo, así que esto no necesita su propia excepción. */
@keyframes modal-entra{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
@keyframes fondo-entra{from{opacity:0}to{opacity:1}}

.modal-entra{animation:modal-entra 160ms cubic-bezier(0.22,1,0.36,1) both}
.fondo-entra{animation:fondo-entra 120ms ease-out both}
```

- [ ] **Step 3: Rewrite the component without the library**

Reemplazar `<motion.div ...>` por `<div className="... modal-entra">` y el fondo por
`<div className="... fondo-entra">`, quitando el import de `motion/react`.

**Cuidado con la animación de SALIDA.** `motion` puede animar la desmontada (`exit`); CSS
puro no. Si el modal tiene animación de salida, **la salida se pierde** — y eso es aceptable:
la entrada es la que se percibe, la salida casi nadie la registra. **Pero verificalo y
reportalo**, no lo escondas.

- [ ] **Step 4: Verify it is really gone from the bundle**

```bash
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
echo "--- chunks > 20 kB ---"
grep -oE "dist/assets/[a-zA-Z0-9._-]+\.js +[0-9,.]+ kB" /tmp/b.log | awk '{gsub(",","",$2); if ($2+0 > 20) print $2" kB  "$1}' | sort -rn
echo "--- motion sigue importado? (debe ser 0) ---"
grep -rn "motion/react\|framer-motion" src --include=*.tsx --include=*.ts | grep -v test | wc -l
```
Expected: `BUILD EXIT: 0`, **`vendor-motion` ya no aparece** en la lista, y el grep en `0`.

- [ ] **Step 5: Full verification and commit**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
git add -A
git commit -m "perf: sacar motion, 42 kB gzip de arranque por una animacion de modal"
```

---

### Task 3: Presupuesto de peso, verificado en cada push

**Files:**
- Create: `scripts/peso.mjs`
- Modify: `package.json` (un script)
- Modify: `.github/workflows/main.yml` (un paso)

**Interfaces:**
- Produces: el comando `node scripts/peso.mjs`, que sale con código 1 si el arranque se pasa
  del presupuesto.

**Por qué.** Hoy Vite avisa "algunos chunks superan 500 kB" y ese aviso se ignora hace meses —
un aviso que nadie mira no existe. Un número que **falla el CI** sí se mira.

- [ ] **Step 1: Write the script**

Crear `scripts/peso.mjs`:

```js
#!/usr/bin/env node
// Presupuesto de peso del arranque, verificado en cada push.
//
// POR QUÉ. Vite avisa "some chunks are larger than 500 kB" y ese aviso se viene ignorando
// hace meses. Un aviso que nadie mira no existe. Esto falla el CI, que sí se mira.
//
// Se mide SÓLO lo que se baja al abrir la app: el chunk de entrada, el CSS y los vendor que
// no son diferidos. Lo que se carga a demanda (xlsx al exportar, cada vista con su chunk) no
// cuenta, porque no lo paga quien sólo abre el tablero.

import { readdirSync, statSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

/** Techo del arranque, en kB comprimidos. */
const PRESUPUESTO_KB = 240;

/** Lo que se baja siempre al abrir. Todo lo demás es a demanda y no cuenta. */
const ES_DE_ARRANQUE = (n) => /^(index|vendor-)/.test(n);

const dir = "dist/assets";
let entradas;
try {
  entradas = readdirSync(dir);
} catch {
  console.error(`No existe ${dir}. Corré el build antes de medir.`);
  process.exitCode = 1;
  entradas = [];
}

let total = 0;
const filas = [];
for (const nombre of entradas) {
  if (!/\.(js|css)$/.test(nombre)) continue;
  if (!ES_DE_ARRANQUE(nombre)) continue;
  const ruta = join(dir, nombre);
  if (!statSync(ruta).isFile()) continue;
  const kb = gzipSync(readFileSync(ruta)).length / 1024;
  total += kb;
  filas.push({ nombre, kb });
}

filas.sort((a, b) => b.kb - a.kb);
for (const f of filas) console.log(`${f.kb.toFixed(1).padStart(7)} kB  ${f.nombre}`);
console.log(`${total.toFixed(1).padStart(7)} kB  TOTAL de arranque (comprimido)`);
console.log(`${String(PRESUPUESTO_KB).padStart(7)} kB  presupuesto`);

if (total > PRESUPUESTO_KB) {
  console.error(
    `\nEl arranque se pasó por ${(total - PRESUPUESTO_KB).toFixed(1)} kB.\n` +
    `Antes de subir el presupuesto, mirá si lo que engordó puede cargarse a demanda:\n` +
    `una vista con lazy(), o un import dinámico como el de xlsx en lib/excel.ts.`,
  );
  process.exitCode = 1;
} else {
  console.log(`\nEntra, con ${(PRESUPUESTO_KB - total).toFixed(1)} kB de margen.`);
}
```

- [ ] **Step 2: Run it against the current build**

```bash
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
node scripts/peso.mjs > /tmp/p.log 2>&1; echo "PESO EXIT: $?"; cat /tmp/p.log
```

Expected: `PESO EXIT: 0` si la Task 2 ya sacó `motion` (el arranque debería quedar cerca de
226 kB). **Si sale 1, no subas el presupuesto**: reportá el número real y qué chunk lo empuja.
El presupuesto se sube sólo con una razón escrita, no para que pase.

- [ ] **Step 3: Wire it into package.json and CI**

En `package.json`, agregar a `scripts`:

```json
    "peso": "node scripts/peso.mjs",
```

En `.github/workflows/main.yml`, en el job `build-test`, **después** de `- run: npm run build`:

```yaml
      - run: npm run peso
```

- [ ] **Step 4: Commit**

```bash
git add scripts/peso.mjs package.json .github/workflows/main.yml
git commit -m "feat: presupuesto de peso de arranque que falla el CI si se pasa"
```

---

### Task 4: Saber cuándo se rompe (monitoreo de errores)

**Files:**
- Create: `src/lib/monitoreo.ts`
- Test: `src/lib/monitoreo.test.ts`
- Modify: `src/main.tsx`, `src/components/ErrorBoundary.tsx`

**Interfaces:**
- Consumes: `clasificarFalla()`, `detalleTecnico()` de `src/lib/fallas.ts`.
- Produces:
  - `export function iniciarMonitoreo(): void`
  - `export function reportarFalla(e: unknown, contexto: string): void`

**REQUIERE la Task 1** para instalar `@sentry/react`.

**Por qué es la brecha más grande.** `ErrorBoundary.tsx` tiene un `// TODO: cuando se enchufe
Sentry` desde hace meses. Hoy, si a alguien se le rompe una pantalla, la única forma de
enterarse es que lo cuente. **Sin esto, el tiempo entre que algo se rompe y que alguien se
entera se mide en días.**

- [ ] **Step 1: Write the failing test**

Crear `src/lib/monitoreo.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { anonimizar, debeReportar } from "./monitoreo";

beforeEach(() => vi.restoreAllMocks());

describe("anonimizar", () => {
  // El equipo escribe cosas privadas en las tareas. Un reporte de error NO puede llevarse
  // el contenido de una consulta ni el texto de una anotación a un servidor de terceros.
  it("saca el texto libre y deja la forma del error", () => {
    const limpio = anonimizar({ mensaje: "falló", texto: "el cliente debe $400.000", titulo: "IVA de Perez" });
    expect(JSON.stringify(limpio)).not.toMatch(/400\.000|Perez/);
  });

  it("conserva lo que sirve para diagnosticar", () => {
    const limpio = anonimizar({ mensaje: "PGRST204", ruta: "/tablero", codigo: "42501" });
    const s = JSON.stringify(limpio);
    expect(s).toContain("PGRST204");
    expect(s).toContain("42501");
  });

  it("nunca deja pasar un email ni un token", () => {
    const limpio = anonimizar({ mensaje: "falló para juan@paris.com con Bearer abc123def456" });
    const s = JSON.stringify(limpio);
    expect(s).not.toMatch(/juan@paris\.com/);
    expect(s).not.toMatch(/abc123def456/);
  });

  it("es defensiva ante entradas raras", () => {
    expect(() => anonimizar(null)).not.toThrow();
    expect(() => anonimizar(undefined)).not.toThrow();
  });
});

describe("debeReportar", () => {
  it("una falla desconocida se reporta: es la que nadie vio venir", () => {
    expect(debeReportar(new Error("undefined is not a function"), true)).toBe(true);
  });

  // Sin conexión no es un error del sistema: es el tren, el ascensor, el wifi de la oficina.
  // Reportarlo llena el panel de ruido y esconde lo que sí importa.
  it("la falta de conexión NO se reporta", () => {
    expect(debeReportar(new TypeError("Failed to fetch"), false)).toBe(false);
  });

  it("una versión vieja tras publicar NO se reporta: es esperable y ya se resuelve sola", () => {
    expect(debeReportar(new Error("Failed to fetch dynamically imported module"), true)).toBe(false);
  });

  it("la falta de permiso SÍ se reporta: puede ser una policy mal puesta", () => {
    expect(debeReportar({ code: "42501", message: "row-level security" }, true)).toBe(true);
  });

  it("es defensiva", () => {
    expect(typeof debeReportar(null, true)).toBe("boolean");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node node_modules/vitest/vitest.mjs run src/lib/monitoreo.test.ts > /tmp/m.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/m.log
```
Expected: EXIT distinto de 0, `Failed to resolve import "./monitoreo"`.

- [ ] **Step 3: Write the implementation**

Crear `src/lib/monitoreo.ts`:

```ts
import { clasificarFalla, detalleTecnico } from "./fallas";

// Monitoreo de errores: enterarse de que algo se rompió sin depender de que alguien lo cuente.
//
// POR QUÉ. `ErrorBoundary.tsx` tenía un "TODO: cuando se enchufe Sentry" desde hace meses.
// Sin esto, el tiempo entre que una pantalla se rompe para alguien y que nos enteramos se
// mide en días — y sólo si esa persona se toma el trabajo de avisar.
//
// LO QUE NO SE MANDA, Y ES LA DECISIÓN IMPORTANTE DE ESTE ARCHIVO.
// El equipo escribe cosas privadas en las tareas: montos, nombres de clientes, notas
// internas, consultas que se hicieron contando con que sólo las ve administración. Nada de
// eso puede salir hacia un servidor de terceros. Se manda LA FORMA del error —código,
// mensaje técnico, pantalla— y nunca el contenido.
//
// Un sistema de monitoreo que filtra datos de la gente es peor que no tener monitoreo.

/** Claves cuyo valor es texto escrito por una persona. Se recortan siempre. */
const CLAVES_LIBRES = ["texto", "titulo", "title", "descripcion", "description", "detalle", "obs", "nota", "respuesta", "comentario", "name", "nombre", "email"];

const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const RE_TOKEN = /\b(?:bearer\s+)?[A-Za-z0-9_-]{20,}\b/gi;
const RE_MONTO = /\$\s?[\d.,]+/g;

function limpiarTexto(s: string): string {
  return s.replace(RE_EMAIL, "[email]").replace(RE_TOKEN, "[token]").replace(RE_MONTO, "[monto]");
}

/** Deja sólo lo que sirve para diagnosticar. Nunca falla. */
export function anonimizar(datos: unknown): Record<string, unknown> {
  if (!datos || typeof datos !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(datos as Record<string, unknown>)) {
    if (CLAVES_LIBRES.includes(k.toLowerCase())) { out[k] = "[recortado]"; continue; }
    out[k] = typeof v === "string" ? limpiarTexto(v) : v;
  }
  return out;
}

/**
 * ¿Vale la pena reportar esta falla?
 *
 * Lo que NO se reporta importa tanto como lo que sí. Un panel lleno de "sin conexión" y
 * "versión vieja" —las dos cosas normales y que ya se resuelven solas— esconde el error real
 * que aparece una vez cada tres días. El ruido no es gratis: cuesta la atención que hace
 * falta para ver lo que sí pasa.
 */
export function debeReportar(e: unknown, online: boolean): boolean {
  const falla = clasificarFalla(e, online);
  return falla.tipo === "desconocida" || falla.tipo === "sin-permiso" || falla.tipo === "falta-migracion";
}

/** Arranca el monitoreo. Sin DSN configurado no hace nada: en desarrollo no molesta. */
export function iniciarMonitoreo(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || !import.meta.env.PROD) return;
  import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      // Sin session replay ni captura automática de red: los dos se llevarían el contenido
      // de las pantallas, que es justo lo que este archivo evita.
      tracesSampleRate: 0,
      beforeSend(evento) {
        if (evento.extra) evento.extra = anonimizar(evento.extra);
        // El breadcrumb de una petición puede traer el cuerpo con datos del equipo.
        evento.breadcrumbs = (evento.breadcrumbs ?? []).map((b) => ({ ...b, data: undefined }));
        return evento;
      },
    });
  }).catch(() => { /* si no carga, la app sigue: el monitoreo nunca puede romper el producto */ });
}

/** Reporta una falla, si corresponde. Nunca lanza. */
export function reportarFalla(e: unknown, contexto: string): void {
  try {
    const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
    if (!debeReportar(e, online)) return;
    import("@sentry/react").then((Sentry) => {
      Sentry.captureMessage(detalleTecnico(e), {
        level: "error",
        extra: anonimizar({ contexto, ruta: typeof location === "undefined" ? "" : location.hash }),
      });
    }).catch(() => { /* el monitoreo no puede romper nada */ });
  } catch { /* idem */ }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node node_modules/vitest/vitest.mjs run src/lib/monitoreo.test.ts > /tmp/m.log 2>&1; echo "EXIT: $?"; tail -8 /tmp/m.log
```
Expected: `EXIT: 0`, 10 tests passing.

- [ ] **Step 5: Wire it in**

En `src/main.tsx`, junto a `migrarPrefs()`:

```tsx
import { iniciarMonitoreo } from "./lib/monitoreo";
iniciarMonitoreo();
```

En `src/components/ErrorBoundary.tsx`, dentro de `componentDidCatch`, reemplazar el comentario
`// TODO: cuando se enchufe Sentry` por la llamada real:

```tsx
    reportarFalla(error, "error de render");
```

manteniendo el `console.error` que ya está.

- [ ] **Step 6: Full verification and commit**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
node scripts/peso.mjs > /tmp/p.log 2>&1; echo "PESO EXIT: $?"; tail -3 /tmp/p.log
git add -A
git commit -m "feat: monitoreo de errores que no se lleva datos del equipo"
```

**Queda del lado del usuario:** crear el proyecto en sentry.io (gratis hasta 5.000 errores por
mes), copiar el DSN, y agregarlo como variable `VITE_SENTRY_DSN` en Cloudflare Pages →
Settings → Environment variables. **Sin esa variable el monitoreo no hace nada** — no rompe,
simplemente no reporta.

---

### Task 5: Pruebas de las pantallas que más duelen

**Files:**
- Create: `src/features/board/Board.test.tsx`
- Create: `src/features/equipo/EnQueAnda.test.tsx`
- Create: `src/features/admin/BlanquearClave.test.tsx`

**Interfaces:** ninguna nueva. Sólo pruebas.

**Por qué estas tres.** 47 componentes y 5 archivos de test es una brecha demasiado grande para
cerrarla de una. Se empieza por donde un bug duele más:

- **`Board`**: si se rompe, nadie trabaja.
- **`EnQueAnda`**: es lo que va a mirar el jefe, y tiene reglas de encuadre que un test protege
  mejor que un comentario.
- **`BlanquearClave`**: toca contraseñas. Un bug ahí deja a alguien afuera.

**Lo que hay que probar es el comportamiento, no la implementación.** Nada de verificar
clases de CSS ni estructura de nodos: eso se rompe con cada cambio de estilo y no prueba nada.

- [ ] **Step 1: Write the Board test**

Crear `src/features/board/Board.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Board } from "./Board";
import type { Card } from "../../lib/types";

afterEach(cleanup);

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "DDJJ IIBB", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, proc_at: null,
    due_date: null, recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-08-01T09:00:00Z", ...over,
  };
}

function montar(cards: Card[], onOpen = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Board cards={cards} activity={[]} ownerId="u1" meName="Ana" onOpen={onOpen} />
    </QueryClientProvider>,
  );
  return { onOpen };
}

describe("Board", () => {
  it("muestra las tareas de la persona", () => {
    montar([card()]);
    expect(screen.getByText("DDJJ IIBB")).toBeTruthy();
  });

  it("no muestra las de otra persona", () => {
    montar([card({ owner: "u2", title: "De otro" })]);
    expect(screen.queryByText("De otro")).toBeNull();
  });

  it("abrir una tarea avisa a quien la monta", () => {
    const { onOpen } = montar([card()]);
    fireEvent.click(screen.getByText("DDJJ IIBB"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  // Se puede abrir sin mouse. Es la interacción central de la app y estuvo rota: la tarjeta
  // era un div con onClick, sin foco ni Enter.
  it("una tarea se abre con Enter", () => {
    const { onOpen } = montar([card()]);
    fireEvent.keyDown(screen.getByText("DDJJ IIBB").closest("[role='button'],button")!, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("una tarea vencida se distingue de una que vence lejos", () => {
    montar([card({ id: "a", title: "Vencida", due_date: "2020-01-01" })]);
    expect(screen.getByText(/venci/i)).toBeTruthy();
  });

  it("sin tareas no explota ni muestra columnas rotas", () => {
    expect(() => montar([])).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it and adapt to the real component**

```bash
node node_modules/vitest/vitest.mjs run src/features/board/Board.test.tsx > /tmp/bt.log 2>&1; echo "EXIT: $?"; tail -40 /tmp/bt.log
```

`Board` recibe más props de las que usa este test (`meId`, `meRole`, `team`, `query`,
`periodo`, `vigente`, `cerrado`) y varias son opcionales. **Leé la firma real antes de
adaptar** y agregá sólo las que el componente necesite para montar. Si algún test falla porque
el componente hace algo distinto de lo que asumí, **ajustá el test a la realidad y anotalo** —
pero si falla porque el componente está mal, **pará y reportalo**: eso es un bug encontrado,
que es justamente para lo que sirven estas pruebas.

- [ ] **Step 3: Write the EnQueAnda test**

Crear `src/features/equipo/EnQueAnda.test.tsx`. Leé primero el componente para saber su firma
exacta. Los comportamientos a fijar:

```
· lista a cada persona del equipo con lo que tiene abierto
· quien no tiene nada abierto aparece igual, sin destaque ni color de alarma
· el orden es alfabético (fijalo con dos personas cuyo orden por cantidad sería el inverso)
· la línea de encuadre está visible en pantalla, no escondida en un tooltip
· cuando una tarea lleva días sin moverse, el texto habla de LA TAREA y no de la persona
· sin fecha de inicio no se escribe ningún número de días
```

El de la persona sin destaque y el del orden alfabético son los importantes: son las reglas
que hoy sólo están escritas en un comentario, y un comentario no impide que alguien las
cambie sin darse cuenta.

- [ ] **Step 4: Write the BlanquearClave test**

Crear `src/features/admin/BlanquearClave.test.tsx`. Comportamientos:

```
· el botón inicial NO blanquea nada: primero pide confirmación
· la confirmación dice que la contraseña actual deja de servir
· se puede cancelar y no pasa nada
· tras blanquear, la clave se muestra UNA vez y el texto pide anotarla
· si la llamada falla, se muestra un mensaje entendible y NO se muestra ninguna clave
```

El último es el que más importa: mostrar una clave cuando el cambio no se aplicó dejaría a
alguien intentando entrar con una contraseña que no existe.

Simulá la llamada de red con `vi.stubGlobal("fetch", ...)`.

- [ ] **Step 5: Full verification and commit**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
echo "--- tests de interfaz ---"; find src -name "*.test.tsx" | wc -l
git add -A
git commit -m "test: pruebas de las tres pantallas donde un bug duele mas"
```
Expected: los tres en `EXIT: 0` y el contador de tests de interfaz en **8**.

---

### Task 6: Cierre — sacar el lastre y documentar el nivel

**Files:**
- Modify: `src/lib/version.ts`, `docs/ESTADO-DEL-PROYECTO.md`
- Create: `docs/NIVEL-DEL-PROYECTO.md`

- [ ] **Step 1: Remove the six dead dependencies**

Con la Task 1 publicada, correr el workflow **Dependencias** con:

```
accion:   quitar
paquetes: @base-ui/react class-variance-authority clsx shadcn tailwind-merge tw-animate-css
```

Después `git pull` y verificar que sigue todo verde:

```bash
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -4 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
node node_modules/knip/bin/knip.js > /tmp/k.log 2>&1; sed -n '1,6p' /tmp/k.log
```
Expected: tests y build en 0, y knip **sin la sección "Unused dependencies"**.

**Si algo se rompe**, la dependencia no estaba muerta: revertí el commit del workflow y
reportá cuál era y quién la usaba.

- [ ] **Step 2: Write the level doc**

Crear `docs/NIVEL-DEL-PROYECTO.md` con los números medidos: cobertura de libs, cobertura de
interfaz, peso de arranque contra el presupuesto, tiempo de CI, y las brechas que quedan
abiertas con su motivo. **Es el documento que se muestra cuando alguien pregunta qué tan serio
es esto** — así que va con números, no con adjetivos.

- [ ] **Step 3: Changelog**

En `src/lib/version.ts`, arriba de todo:

```ts
  {
    version: "2.13.0",
    fecha: "2026-08-05",
    cambios: [
      "La app abre más rápido: se sacó una librería de animación que pesaba lo mismo que media aplicación y se usaba en una sola pantalla.",
      "Si algo se rompe, ahora nos enteramos solos en vez de depender de que alguien lo cuente. No se envía nada de lo que escribís en las tareas.",
    ],
  },
```

- [ ] **Step 4: Final verification**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
node scripts/peso.mjs > /tmp/p.log 2>&1; echo "PESO EXIT: $?"; cat /tmp/p.log
```
Expected: los cinco en `EXIT: 0`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: nivel del proyecto medido y changelog 2.13.0"
```

---

## Lo que NO entra en este plan, y por qué

**Reescribir la arquitectura.** No hace falta. 96 de 98 libs con tests, cero `any`, cero
`console.log`, guardianes que impiden la deriva: eso *es* buena arquitectura. Lo que falta no
es estructura, es **instrumentación** — saber qué pasa cuando el código sale de esta máquina.
Reescribir algo que funciona por algo sin probar es cambiar problemas conocidos por
desconocidos.

**Migrar a Next.js, a un monorepo, o a microservicios.** Son respuestas a problemas de escala
que este proyecto no tiene: doce personas, un dominio, un equipo de una persona. Adoptarlos
agregaría complejidad diaria sin resolver nada de lo que hoy duele.

**Storybook.** Documentar componentes en aislamiento vale cuando hay varios equipos
consumiéndolos. Acá el sistema visual ya está documentado y con guardianes, que resuelve el
mismo problema por una fracción del costo.

**Subir la cobertura de interfaz al 80%.** Perseguir un porcentaje lleva a tests que verifican
que el código hace lo que hace. Tres pantallas bien probadas, elegidas por dónde duele un bug,
valen más que cuarenta con un test cada una.

---

## El orden importa

La Task 1 va primero porque desbloquea las otras. La 2 y la 3 no dependen de nada y dan
resultado visible enseguida. La 4 es la que más cambia cómo se opera el producto. La 5 es la
que más cuesta y la que menos se ve — y es la que evita que vuelvan los bugs de esta semana.

Si hubiera que elegir dos: **la 1 y la 4**. La primera saca la restricción que venía
condicionando cada decisión; la segunda es la diferencia entre operar un producto y esperar
que alguien avise.
