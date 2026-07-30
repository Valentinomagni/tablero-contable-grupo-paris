# Solidez y sistema visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el Tablero no se rompa nunca delante de quien lo evalúa, y que se vea como un producto pago — cerrando las tres brechas concretas que encontró la auditoría: recuperación de fallas, sistema tipográfico, y consolidación visual.

**Architecture:** Tres capas independientes. (1) Una lib pura que **clasifica** fallas y decide qué acción ofrecer, consumida por el ErrorBoundary y por una red global en `main.tsx`. (2) Un sistema visual con escala tipográfica y tokens de foco/movimiento en Tailwind, más `Panel` y `Skeleton` como únicos componentes de superficie. (3) Un normalizador en el borde de Supabase para que una fila malformada no tumbe una pantalla.

**Tech Stack:** React 19, TypeScript, Tailwind, vitest, oxlint, Vite/rolldown. **Cero dependencias nuevas.**

---

## Diagnóstico: qué encontró la auditoría

Números medidos sobre el repo, no impresiones:

| Hallazgo | Medición | Por qué importa |
|---|---|---|
| **No hay sistema tipográfico** | **764** usos de tamaño de texto repartidos en **13 valores distintos**; 499 son píxeles a mano (`text-[13px]` ×311, `text-[11px]` ×60, `text-[10px]` ×9…) | Es el delator más claro de "esto no lo diseñó nadie". Un producto pago tiene 5-6 pasos deliberados, no 13 valores ad-hoc |
| **Deriva visual de superficies** | `Panel` existe y se usa en **2** archivos; **16** archivos siguen con el mismo par de estilos copiado a mano | Cada copia se separa un poco. Ya pasó una vez con las sombras (`--ring` vs `--ring-sh`) |
| **Recuperación de fallas engañosa** | 11 módulos con carga diferida + service worker, y el ErrorBoundary ofrece "Reintentar" para todo | Ver abajo: es un bug con nombre y apellido |
| **Accesibilidad y foco** | **11** `aria-label`/`role` en 165 archivos; **cero** reglas `focus-visible` | El anillo de foco es de las cosas que más rápido separan "hecho a mano" de "producto" |
| **Estados de carga** | `Cargando…` como texto pelado en 2 lugares | Un esqueleto en vez de texto es la señal más barata de software caro |
| **Promesas sin capturar** | ningún handler de `unhandledrejection` | Un fallo así hoy no deja rastro en ninguna parte |

Lo que ya está **bien** y no se toca: cero `any`, cero `console.log` en producción, cero `dangerouslySetInnerHTML` (sin superficie de XSS), tokens de color monocromos con doble tema en un solo origen, ErrorBoundary en dos niveles, 1016 tests. La base es sólida; esto es la capa de acabado.

### El bug que más probable es que te muerda justo el día de la demo

La app parte en 11 módulos con carga diferida y registra un service worker. Cuando publicás una versión nueva, quien tenga la app abierta —o el shell viejo en caché— pide un módulo cuyo hash **ya no existe** en el servidor. El navegador tira `Failed to fetch dynamically imported module`, el `lazy()` explota, y el ErrorBoundary muestra:

> Algo se rompió en esta pantalla · **[Reintentar]**

"Reintentar" **no puede funcionar nunca** en ese caso: el archivo realmente no está. La persona va a apretar ese botón tres veces, ver el mismo error, y concluir que el sistema está roto — cuando lo único que hacía falta era recargar. Ofrecer la acción equivocada como principal es peor que no ofrecer ninguna. La Fase 1 arregla exactamente esto.

## Global Constraints

- **CERO dependencias nuevas.** No hay npm, pnpm, yarn ni corepack en esta máquina (verificado). Todo a mano. Ver la sección "Sobre agregar herramientas" al final.
- `node` está en `C:\Users\Vmagni\AppData\Local\OpenAI\Codex\bin\node.exe`. En Bash: `export PATH="/c/Users/Vmagni/AppData/Local/OpenAI/Codex/bin:$PATH"`.
- Tests: `node node_modules/vitest/vitest.mjs run` · Tipos: `node node_modules/typescript/bin/tsc -b` · Lint: `node node_modules/oxlint/bin/oxlint` · Build: `node node_modules/vite/bin/vite.js build`.
- Códigos de salida explícitos siempre: `comando > /tmp/log 2>&1; echo "EXIT: $?"`. **Nunca** juzgar por `comando | tail` — el exit code que se ve es el de `tail`.
- **El hook de pre-commit corre tsc + los 1016 tests y tarda ~90 s.** Al llamar `git commit`, pasarle a Bash un timeout de **420000 ms** o se corta a la mitad.
- **Cero emojis** en cualquier texto que vea un usuario. Iconos sólo de `lucide-react`.
- Comentarios en español, explicando el **por qué**, no el qué.
- **Encuadre no punitivo**: las métricas describen situaciones y procesos, nunca juzgan personas.
- Ninguna tarea cambia el esquema de la base. Cero migraciones nuevas en este plan.
- Toda función que dependa de la fecha recibe el instante por parámetro (pura y testeable).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/fallas.ts` | **Puro.** Clasifica un error en un tipo con título, explicación y acción recomendada. |
| `src/lib/fallas.test.ts` | Tests de la clasificación. |
| `src/components/ErrorBoundary.tsx` | Usa la clasificación para ofrecer la acción correcta y un detalle copiable. |
| `src/lib/recuperacion.ts` | Efectos de recuperación: recarga dura limpiando cachés y service worker. Aislado por ser lo único impuro. |
| `src/main.tsx` | Red global: `unhandledrejection`, `error` y `vite:preloadError`. |
| `tailwind.config.js` | Escala tipográfica y tokens de movimiento. |
| `src/index.css` | Anillo de foco global, `prefers-reduced-motion`, animación del esqueleto. |
| `src/components/Skeleton.tsx` | Estado de carga. Reemplaza el texto "Cargando…". |
| `src/components/Panel.tsx` | Única superficie de tarjeta. Gana variantes. |
| `src/components/Panel.guard.test.ts` | Test guardián: falla si vuelve a aparecer una tarjeta hecha a mano. |
| `src/lib/normalizar.ts` | Sanea filas que llegan de Supabase antes de que las toque un componente. |

---

## FASE 1 — Que no se rompa

### Task 1: Lib pura que clasifica fallas

**Files:**
- Create: `src/lib/fallas.ts`
- Test: `src/lib/fallas.test.ts`

**Interfaces:**
- Produces:
  - `export type TipoDeFalla = "version-vieja" | "sin-conexion" | "sin-permiso" | "falta-migracion" | "desconocida"`
  - `export type AccionSugerida = "actualizar" | "reintentar" | "ninguna"`
  - `export interface Falla { tipo: TipoDeFalla; titulo: string; explicacion: string; accion: AccionSugerida }`
  - `export function clasificarFalla(e: unknown, online: boolean): Falla`
  - `export function detalleTecnico(e: unknown): string`

- [ ] **Step 1: Write the failing test**

Crear `src/lib/fallas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { clasificarFalla, detalleTecnico } from "./fallas";

describe("clasificarFalla — versión vieja tras publicar", () => {
  // El caso real: se publica una versión nueva, el navegador tiene el shell viejo en caché
  // y pide un módulo cuyo hash ya no existe. "Reintentar" NO puede funcionar nunca acá.
  it("detecta el módulo que ya no existe (Chrome/Edge)", () => {
    const f = clasificarFalla(new Error("Failed to fetch dynamically imported module: https://x/assets/Reporte-a1b2.js"), true);
    expect(f.tipo).toBe("version-vieja");
    expect(f.accion).toBe("actualizar");
  });

  it("detecta la variante de Safari", () => {
    expect(clasificarFalla(new Error("Importing a module script failed."), true).tipo).toBe("version-vieja");
  });

  it("detecta ChunkLoadError por nombre", () => {
    const e = new Error("loading chunk 3 failed");
    e.name = "ChunkLoadError";
    expect(clasificarFalla(e, true).tipo).toBe("version-vieja");
  });

  it("explica en lenguaje de usuario, sin jerga técnica", () => {
    const f = clasificarFalla(new Error("Failed to fetch dynamically imported module"), true);
    expect(f.explicacion).not.toMatch(/módulo|chunk|fetch|hash/i);
    expect(f.explicacion.length).toBeGreaterThan(20);
  });
});

describe("clasificarFalla — sin conexión", () => {
  // ORDEN IMPORTANTE: sin red, un módulo también falla al bajar. Ahí la acción correcta es
  // esperar la conexión, NO actualizar: actualizar sin red deja la pantalla en blanco.
  it("estando offline, un fallo de carga es falta de conexión y no versión vieja", () => {
    const f = clasificarFalla(new Error("Failed to fetch dynamically imported module"), false);
    expect(f.tipo).toBe("sin-conexion");
    expect(f.accion).not.toBe("actualizar");
  });

  it("detecta un fallo de red común estando online", () => {
    expect(clasificarFalla(new TypeError("Failed to fetch"), true).tipo).toBe("sin-conexion");
  });

  it("detecta la variante de Safari", () => {
    expect(clasificarFalla(new TypeError("Load failed"), true).tipo).toBe("sin-conexion");
  });
});

describe("clasificarFalla — errores de Postgres", () => {
  it("42501 es falta de permiso, y no se ofrece reintentar", () => {
    const f = clasificarFalla({ code: "42501", message: "new row violates row-level security policy" }, true);
    expect(f.tipo).toBe("sin-permiso");
    expect(f.accion).toBe("ninguna");
  });

  it("reconoce el mensaje de RLS sin código", () => {
    expect(clasificarFalla({ message: "permission denied for table cards" }, true).tipo).toBe("sin-permiso");
  });

  it("42P01 es una migración que falta", () => {
    const f = clasificarFalla({ code: "42P01", message: 'relation "public.card_periodos" does not exist' }, true);
    expect(f.tipo).toBe("falta-migracion");
    expect(f.accion).toBe("ninguna");
  });

  it("42703 (columna inexistente) también es migración que falta", () => {
    expect(clasificarFalla({ code: "42703", message: "column cards.checklist does not exist" }, true).tipo).toBe("falta-migracion");
  });
});

describe("clasificarFalla — el resto", () => {
  it("un error cualquiera es desconocido y se puede reintentar", () => {
    const f = clasificarFalla(new Error("Cannot read properties of undefined"), true);
    expect(f.tipo).toBe("desconocida");
    expect(f.accion).toBe("reintentar");
  });

  it("nunca devuelve null, ni con entradas absurdas", () => {
    for (const raro of [null, undefined, 0, "", [], {}]) {
      const f = clasificarFalla(raro, true);
      expect(f.tipo).toBe("desconocida");
      expect(f.titulo.length).toBeGreaterThan(0);
    }
  });

  it("ningún título ni explicación queda vacío en ningún tipo", () => {
    const casos: unknown[] = [
      new Error("Failed to fetch dynamically imported module"),
      new TypeError("Failed to fetch"),
      { code: "42501" },
      { code: "42P01" },
      new Error("cualquier cosa"),
    ];
    for (const c of casos) {
      const f = clasificarFalla(c, true);
      expect(f.titulo.trim()).not.toBe("");
      expect(f.explicacion.trim()).not.toBe("");
    }
  });
});

describe("detalleTecnico", () => {
  it("incluye el mensaje para poder reportarlo", () => {
    expect(detalleTecnico(new Error("algo puntual falló"))).toContain("algo puntual falló");
  });

  it("incluye el código de Postgres cuando lo hay", () => {
    expect(detalleTecnico({ code: "42501", message: "denied" })).toContain("42501");
  });

  it("no explota con entradas raras", () => {
    expect(typeof detalleTecnico(null)).toBe("string");
    expect(typeof detalleTecnico(undefined)).toBe("string");
  });

  // El detalle se muestra en pantalla y se copia al portapapeles: un texto enorme es
  // inservible para pegarlo en una consulta.
  it("recorta un mensaje kilométrico", () => {
    expect(detalleTecnico(new Error("x".repeat(5000))).length).toBeLessThan(1200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node node_modules/vitest/vitest.mjs run src/lib/fallas.test.ts > /tmp/f.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/f.log
```
Expected: EXIT distinto de 0, con `Failed to resolve import "./fallas"`.

- [ ] **Step 3: Write the implementation**

Crear `src/lib/fallas.ts`:

```ts
// Clasificación de fallas: convierte un error crudo en algo que se le pueda MOSTRAR a una
// persona, junto con la acción que de verdad la desatasca.
//
// POR QUÉ EXISTE. La app se parte en módulos que se bajan a demanda y hay un service worker
// cacheando el shell. Cuando se publica una versión nueva, el navegador que tiene el shell
// viejo pide un módulo cuyo hash ya no existe y falla. El ErrorBoundary mostraba
// "Reintentar" para eso, y reintentar NO PUEDE funcionar nunca: el archivo no está. La
// persona aprieta tres veces, ve el mismo error y concluye que el sistema está roto, cuando
// sólo hacía falta recargar. Ofrecer la acción equivocada como principal es peor que no
// ofrecer ninguna.
//
// PURA: `online` entra por parámetro; no lee `navigator` adentro.

export type TipoDeFalla = "version-vieja" | "sin-conexion" | "sin-permiso" | "falta-migracion" | "desconocida";
export type AccionSugerida = "actualizar" | "reintentar" | "ninguna";

export interface Falla {
  tipo: TipoDeFalla;
  titulo: string;
  /** En lenguaje de usuario. Sin la palabra "módulo", "chunk" ni "hash". */
  explicacion: string;
  accion: AccionSugerida;
}

/** Tope del detalle técnico: tiene que poder pegarse en una consulta, no ser un volcado. */
const MAX_DETALLE = 1000;

function mensajeDe(e: unknown): string {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const o = e as { message?: unknown; error_description?: unknown };
    if (typeof o.message === "string") return o.message;
    if (typeof o.error_description === "string") return o.error_description;
  }
  return "";
}

function codigoDe(e: unknown): string {
  if (e && typeof e === "object") {
    const c = (e as { code?: unknown }).code;
    if (typeof c === "string") return c;
    if (typeof c === "number") return String(c);
  }
  return "";
}

function nombreDe(e: unknown): string {
  if (e && typeof e === "object") {
    const n = (e as { name?: unknown }).name;
    if (typeof n === "string") return n;
  }
  return "";
}

/** ¿Es el fallo de un módulo que se baja a demanda? Cada motor lo redacta distinto. */
function esFalloDeModulo(msg: string, nombre: string): boolean {
  if (nombre === "ChunkLoadError") return true;
  return /failed to fetch dynamically imported module/i.test(msg)
    || /importing a module script failed/i.test(msg)   // Safari
    || /error loading dynamically imported module/i.test(msg)
    || /loading chunk \S+ failed/i.test(msg);
}

/** ¿Huele a red caída? */
function esFalloDeRed(msg: string): boolean {
  return /failed to fetch/i.test(msg)
    || /load failed/i.test(msg)                        // Safari
    || /networkerror/i.test(msg)
    || /network request failed/i.test(msg);
}

/**
 * Clasifica la falla. El ORDEN de las ramas es lo importante de esta función:
 * sin conexión, un módulo también falla al bajar, y ahí actualizar es lo PEOR que se puede
 * hacer — una recarga sin red deja la pantalla en blanco. Por eso lo offline se resuelve
 * antes que la versión vieja.
 */
export function clasificarFalla(e: unknown, online: boolean): Falla {
  const msg = mensajeDe(e);
  const codigo = codigoDe(e);
  const nombre = nombreDe(e);
  const deCarga = esFalloDeModulo(msg, nombre) || esFalloDeRed(msg);

  if (deCarga && !online) {
    return {
      tipo: "sin-conexion",
      titulo: "Sin conexión",
      explicacion: "No hay internet en este momento. Tus cambios guardados están a salvo; en cuanto vuelva la conexión podés seguir.",
      accion: "reintentar",
    };
  }

  if (esFalloDeModulo(msg, nombre)) {
    return {
      tipo: "version-vieja",
      titulo: "Hay una versión nueva",
      explicacion: "Se publicó una actualización mientras tenías la app abierta. Actualizá para cargar la última versión; no vas a perder nada.",
      accion: "actualizar",
    };
  }

  if (esFalloDeRed(msg)) {
    return {
      tipo: "sin-conexion",
      titulo: "No se pudo conectar",
      explicacion: "No se pudo llegar al servidor. Revisá tu conexión y probá de nuevo.",
      accion: "reintentar",
    };
  }

  if (codigo === "42501" || /row-level security|permission denied/i.test(msg)) {
    return {
      tipo: "sin-permiso",
      titulo: "No tenés permiso para esto",
      explicacion: "Tu cuenta no puede hacer esta acción. Si creés que debería poder, avisá por Consultas desde tu perfil.",
      accion: "ninguna",
    };
  }

  if (codigo === "42P01" || codigo === "42703" || codigo === "PGRST204"
      || /does not exist/i.test(msg)) {
    return {
      tipo: "falta-migracion",
      titulo: "Falta una actualización de la base",
      explicacion: "Esta parte necesita una actualización de la base de datos que todavía no se aplicó. El resto de la app funciona normal.",
      accion: "ninguna",
    };
  }

  return {
    tipo: "desconocida",
    titulo: "Algo se rompió en esta pantalla",
    explicacion: "El resto del equipo puede seguir trabajando sin problema. Probá de nuevo, y si sigue pasando copiá el detalle y mandalo por Consultas.",
    accion: "reintentar",
  };
}

/** Texto corto y copiable para pegar en una consulta. Nunca vacío. */
export function detalleTecnico(e: unknown): string {
  const partes: string[] = [];
  const nombre = nombreDe(e);
  const codigo = codigoDe(e);
  if (nombre) partes.push(nombre);
  if (codigo) partes.push(`[${codigo}]`);
  partes.push(mensajeDe(e) || "sin mensaje");
  return partes.join(" ").slice(0, MAX_DETALLE);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node node_modules/vitest/vitest.mjs run src/lib/fallas.test.ts > /tmp/f.log 2>&1; echo "EXIT: $?"; tail -8 /tmp/f.log
```
Expected: `EXIT: 0`, 18 tests passing.

- [ ] **Step 5: Verify types and lint**

Run:
```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
```
Expected: `TSC EXIT: 0` sin salida, `LINT EXIT: 0`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fallas.ts src/lib/fallas.test.ts
git commit -m "feat: clasificacion de fallas con la accion correcta para cada una"
```

---

### Task 2: ErrorBoundary que ofrece la acción correcta

**Files:**
- Create: `src/lib/recuperacion.ts`
- Modify: `src/components/ErrorBoundary.tsx` (reescritura del `render`)
- Test: `src/components/ErrorBoundary.test.tsx` (agregar casos al archivo existente)

**Interfaces:**
- Consumes: `clasificarFalla(e, online)`, `detalleTecnico(e)`, `type Falla` de `src/lib/fallas.ts` (Task 1).
- Produces:
  - `export async function actualizarApp(): Promise<void>` en `src/lib/recuperacion.ts`
  - `export function estaOnline(): boolean` en `src/lib/recuperacion.ts`

- [ ] **Step 1: Write the recovery module**

Crear `src/lib/recuperacion.ts`:

```ts
// Los ÚNICOS efectos impuros de la recuperación de fallas, aislados acá para que la
// clasificación (`fallas.ts`) siga siendo pura y testeable sin simular el navegador.

/** ¿Hay conexión? Envuelto para poder inyectarlo en los tests. */
export function estaOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

/**
 * Recarga de verdad, para el caso "hay una versión nueva".
 *
 * Un `location.reload()` pelado NO alcanza: el service worker puede devolver el shell viejo
 * desde la caché y volver a pedir el mismo módulo que no existe, dejando a la persona en un
 * bucle. Así que primero se borra la caché y se desregistra el service worker, y sólo
 * después se recarga. Cada paso va en su propio try: si el navegador no soporta uno, los
 * demás tienen que ejecutarse igual.
 */
export async function actualizarApp(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      const nombres = await caches.keys();
      await Promise.all(nombres.map((n) => caches.delete(n)));
    }
  } catch { /* sin Cache API: seguimos */ }

  try {
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* sin service worker: seguimos */ }

  try {
    window.location.reload();
  } catch { /* en tests no hay location real */ }
}
```

- [ ] **Step 2: Write the failing test**

Agregar al final de `src/components/ErrorBoundary.test.tsx` (sin borrar lo que ya está):

```tsx
describe("ErrorBoundary — ofrece la acción correcta según la falla", () => {
  // Un componente que revienta con el error que le pasemos.
  function Explota({ error }: { error: Error }): never {
    throw error;
  }

  it("con un módulo que ya no existe, ofrece ACTUALIZAR y no reintentar", () => {
    const e = new Error("Failed to fetch dynamically imported module: /assets/Reporte-a1.js");
    render(<ErrorBoundary><Explota error={e} /></ErrorBoundary>);
    expect(screen.getByText(/versión nueva/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /actualizar/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^reintentar$/i })).toBeNull();
  });

  it("con un error cualquiera, sigue ofreciendo reintentar", () => {
    render(<ErrorBoundary><Explota error={new Error("undefined is not a function")} /></ErrorBoundary>);
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeTruthy();
  });

  it("con falta de permiso, no ofrece ninguna acción que no vaya a servir", () => {
    const e = Object.assign(new Error("permission denied for table cards"), { code: "42501" });
    render(<ErrorBoundary><Explota error={e} /></ErrorBoundary>);
    expect(screen.getByText(/no tenés permiso/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /reintentar/i })).toBeNull();
  });

  it("muestra el detalle técnico para poder reportarlo", () => {
    render(<ErrorBoundary><Explota error={new Error("fallo puntual xyz")} /></ErrorBoundary>);
    expect(screen.getByText(/fallo puntual xyz/)).toBeTruthy();
  });

  it("la explicación no le tira jerga técnica a la persona", () => {
    const e = new Error("Failed to fetch dynamically imported module");
    render(<ErrorBoundary><Explota error={e} /></ErrorBoundary>);
    expect(screen.getByText(/versión nueva/i).textContent).not.toMatch(/chunk|module/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```bash
node node_modules/vitest/vitest.mjs run src/components/ErrorBoundary.test.tsx > /tmp/eb.log 2>&1; echo "EXIT: $?"; tail -30 /tmp/eb.log
```
Expected: EXIT distinto de 0. Los tests nuevos fallan porque el boundary todavía muestra el
texto fijo "Algo se rompió en esta pantalla" y el botón "Recargar la app".

- [ ] **Step 4: Rewrite the ErrorBoundary**

Reemplazar el contenido completo de `src/components/ErrorBoundary.tsx` por:

```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw, Copy } from "lucide-react";
import { clasificarFalla, detalleTecnico } from "../lib/fallas";
import { actualizarApp, estaOnline } from "../lib/recuperacion";

interface Props { children: ReactNode }
interface State { error: Error | null }

// Red de contención (docs/SEGURIDAD.md): un error de render en cualquier parte del árbol
// ya no deja la pantalla en blanco — se muestra una pantalla de recuperación sobria.
// Se usa en dos niveles: uno RAÍZ (main.tsx, toda la app) y uno por VISTA (App.tsx,
// con key={view} para que cambiar de vista resetee el boundary solo y el Shell/nav
// sigan andando aunque una vista puntual se rompa).
//
// La acción que se ofrece NO es fija: la decide `clasificarFalla`. Antes había un
// "Reintentar" para todo, y para el caso más frecuente —una versión nueva publicada
// mientras la app estaba abierta— reintentar no puede funcionar nunca, porque el archivo
// que pide el navegador ya no existe en el servidor. Ver el comentario de `lib/fallas.ts`.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Sin servicio de monitoreo externo: el canal para que un error llegue a quien lo puede
    // resolver es Consultas, y para eso la persona necesita poder COPIAR el detalle. Por eso
    // el detalle se muestra en pantalla y no sólo en la consola, que nadie va a abrir.
    console.error("ErrorBoundary capturó un error de render:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  copiarDetalle = (detalle: string) => {
    navigator.clipboard?.writeText(detalle).catch(() => { /* sin permiso de portapapeles */ });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const falla = clasificarFalla(error, estaOnline());
    const detalle = detalleTecnico(error);

    return (
      <div className="min-h-[280px] flex flex-col items-center justify-center gap-3 text-center px-6 py-10">
        <span className="grid place-items-center w-11 h-11 rounded-full bg-warn-soft text-warn">
          <AlertTriangle size={20} />
        </span>
        <h2 className="text-lg font-bold m-0 text-ink">{falla.titulo}</h2>
        <p className="text-ink2 text-sm m-0 max-w-[420px]">{falla.explicacion}</p>

        <div className="flex flex-wrap gap-2.5 justify-center mt-1">
          {falla.accion === "actualizar" && (
            <button onClick={() => { void actualizarApp(); }}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-accent text-[color:var(--accent-ink)]">
              <RefreshCw size={14} /> Actualizar
            </button>
          )}
          {falla.accion === "reintentar" && (
            <button onClick={this.reset}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-accent text-[color:var(--accent-ink)]">
              <RotateCcw size={14} /> Reintentar
            </button>
          )}
          <button onClick={() => this.copiarDetalle(detalle)}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold border border-line bg-surface2 text-ink hover:bg-surface transition-colors">
            <Copy size={14} /> Copiar detalle
          </button>
        </div>

        <p className="text-2xs text-ink2 m-0 mt-2 max-w-[460px] break-words font-mono opacity-70">{detalle}</p>
      </div>
    );
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
node node_modules/vitest/vitest.mjs run src/components/ErrorBoundary.test.tsx > /tmp/eb.log 2>&1; echo "EXIT: $?"; tail -10 /tmp/eb.log
```
Expected: `EXIT: 0`, todos los tests del archivo en verde.

**Nota:** `text-2xs` se define en la Task 4. Hasta entonces Tailwind ignora la clase
desconocida y el texto queda en el tamaño heredado — no rompe nada, ni el build ni el test.

- [ ] **Step 6: Full verification**

Run:
```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
```
Expected: `TSC EXIT: 0`, `LINT EXIT: 0`, `TESTS EXIT: 0`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/recuperacion.ts src/components/ErrorBoundary.tsx src/components/ErrorBoundary.test.tsx
git commit -m "fix: la pantalla de error ofrece actualizar cuando hay version nueva"
```

---

### Task 3: Red global para fallas que no pasan por React

**Files:**
- Modify: `src/main.tsx`
- Create: `src/lib/red-global.ts`
- Test: `src/lib/red-global.test.ts`

**Interfaces:**
- Consumes: `clasificarFalla(e, online)` de `src/lib/fallas.ts` (Task 1); `actualizarApp()`, `estaOnline()` de `src/lib/recuperacion.ts` (Task 2).
- Produces: `export function instalarRedGlobal(avisar: (mensaje: string, accion?: { texto: string; hacer: () => void }) => void): () => void`

- [ ] **Step 1: Write the failing test**

Crear `src/lib/red-global.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { instalarRedGlobal } from "./red-global";

let desinstalar: (() => void) | null = null;
afterEach(() => { desinstalar?.(); desinstalar = null; });

describe("instalarRedGlobal", () => {
  it("avisa cuando una promesa queda sin capturar", () => {
    const avisar = vi.fn();
    desinstalar = instalarRedGlobal(avisar);
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), {
      reason: new Error("algo falló en segundo plano"),
    }));
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it("ante una versión nueva ofrece la acción de actualizar", () => {
    const avisar = vi.fn();
    desinstalar = instalarRedGlobal(avisar);
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), {
      reason: new Error("Failed to fetch dynamically imported module"),
    }));
    const accion = avisar.mock.calls[0][1];
    expect(accion?.texto).toMatch(/actualizar/i);
    expect(typeof accion?.hacer).toBe("function");
  });

  it("escucha también el evento propio de Vite para módulos que no cargan", () => {
    const avisar = vi.fn();
    desinstalar = instalarRedGlobal(avisar);
    window.dispatchEvent(Object.assign(new Event("vite:preloadError"), {
      payload: new Error("Failed to fetch dynamically imported module"),
    }));
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  // Un aviso por cada fallo idéntico convierte una falla en una avalancha de carteles, y la
  // persona deja de leerlos. Peor: un bucle de reintentos podría dispararlo cien veces.
  it("no repite el mismo aviso una y otra vez", () => {
    const avisar = vi.fn();
    desinstalar = instalarRedGlobal(avisar);
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(Object.assign(new Event("unhandledrejection"), {
        reason: new Error("el mismo error"),
      }));
    }
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it("dos fallas distintas sí avisan las dos veces", () => {
    const avisar = vi.fn();
    desinstalar = instalarRedGlobal(avisar);
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new Error("una") }));
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new Error("otra") }));
    expect(avisar).toHaveBeenCalledTimes(2);
  });

  it("desinstalar deja de avisar, para no filtrar handlers entre tests ni recargas", () => {
    const avisar = vi.fn();
    const quitar = instalarRedGlobal(avisar);
    quitar();
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new Error("x") }));
    expect(avisar).not.toHaveBeenCalled();
  });

  it("no explota si el evento viene sin motivo", () => {
    const avisar = vi.fn();
    desinstalar = instalarRedGlobal(avisar);
    expect(() => window.dispatchEvent(new Event("unhandledrejection"))).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node node_modules/vitest/vitest.mjs run src/lib/red-global.test.ts > /tmp/rg.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/rg.log
```
Expected: EXIT distinto de 0, con `Failed to resolve import "./red-global"`.

- [ ] **Step 3: Write the implementation**

Crear `src/lib/red-global.ts`:

```ts
import { clasificarFalla } from "./fallas";
import { actualizarApp, estaOnline } from "./recuperacion";

// Fallas que NO pasan por el árbol de React y por lo tanto el ErrorBoundary no ve:
// una promesa rechazada en segundo plano, un error suelto en un listener, o el evento propio
// de Vite cuando un módulo diferido no se puede bajar.
//
// Sin esto, ese tipo de falla no deja rastro en ninguna parte: la acción simplemente no pasa
// y la persona se queda esperando sin saber que algo falló.
//
// `avisar` se inyecta en vez de importar el toast directo: así se testea sin montar la UI, y
// la lib no queda atada a la librería de notificaciones del momento.

type Accion = { texto: string; hacer: () => void };
type Avisar = (mensaje: string, accion?: Accion) => void;

export function instalarRedGlobal(avisar: Avisar): () => void {
  // Un aviso por fallo idéntico convierte una falla en una avalancha de carteles y la persona
  // deja de leerlos. Se recuerda lo ya avisado y se muestra una sola vez por falla distinta.
  const yaAvisado = new Set<string>();

  const manejar = (e: unknown) => {
    const falla = clasificarFalla(e, estaOnline());
    const clave = falla.tipo + "|" + falla.titulo;
    if (yaAvisado.has(clave)) return;
    yaAvisado.add(clave);

    const accion: Accion | undefined = falla.accion === "actualizar"
      ? { texto: "Actualizar", hacer: () => { void actualizarApp(); } }
      : undefined;
    avisar(falla.titulo + ". " + falla.explicacion, accion);
  };

  const onRejection = (ev: Event) => manejar((ev as PromiseRejectionEvent).reason);
  const onError = (ev: Event) => manejar((ev as ErrorEvent).error ?? (ev as ErrorEvent).message);
  // Vite avisa por su cuenta cuando falla el preload de un módulo diferido, y ese evento
  // llega antes (y con mejor información) que el error genérico.
  const onPreload = (ev: Event) => manejar((ev as Event & { payload?: unknown }).payload);

  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("error", onError);
  window.addEventListener("vite:preloadError", onPreload);

  return () => {
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("error", onError);
    window.removeEventListener("vite:preloadError", onPreload);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node node_modules/vitest/vitest.mjs run src/lib/red-global.test.ts > /tmp/rg.log 2>&1; echo "EXIT: $?"; tail -8 /tmp/rg.log
```
Expected: `EXIT: 0`, 7 tests passing.

- [ ] **Step 5: Wire it into main.tsx**

En `src/main.tsx`, agregar a los imports (después de `import { ErrorBoundary } ...`):

```tsx
import { toast } from "sonner";
import { instalarRedGlobal } from "./lib/red-global";
```

Y justo después de la línea `migrarPrefs();`, agregar:

```tsx
// Red global para las fallas que no pasan por React (ver lib/red-global.ts). Se instala una
// sola vez, antes de montar: una promesa que se rompe durante el arranque también tiene que
// avisar. No se desinstala nunca porque vive todo lo que vive la pestaña.
instalarRedGlobal((mensaje, accion) => {
  toast.error(mensaje, accion ? { action: { label: accion.texto, onClick: accion.hacer } } : undefined);
});
```

- [ ] **Step 6: Full verification**

Run:
```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
```
Expected: los cuatro en `EXIT: 0`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/red-global.ts src/lib/red-global.test.ts src/main.tsx
git commit -m "feat: red global para promesas rechazadas y modulos que no cargan"
```

---

## FASE 2 — Que entre por los ojos

### Task 4: Escala tipográfica, foco visible y tokens de movimiento

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/index.css`
- Test: `src/lib/tipografia.guard.test.ts` (crear)

**Interfaces:**
- Produces: las clases `text-2xs`, `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`,
  `text-2xl` con valores propios; la clase de utilidad `.foco` no existe (el foco es global).

**Contexto medido:** hoy hay **764** usos de tamaño de texto repartidos en **13 valores
distintos** (499 con píxeles a mano). Esta tarea define **7 pasos** y la Task 5 hace el
reemplazo mecánico.

**Los tamaños de Tailwind cambian de valor, a propósito.** Es un cambio deliberado hacia una
densidad de dashboard profesional, y hay que decir los números:

| Clase | Tailwind | Nuevo | Usos hoy | Efecto |
|---|---|---|---|---|
| `text-2xs` | (no existía) | 11px | 0 | nueva, para metadatos |
| `text-xs` | 12px | 12px | 117 | sin cambio |
| `text-sm` | 14px | 13px | 124 | −1px, más denso |
| `text-base` | 16px | 14px | 1 | −2px, pasa a ser el cuerpo real |
| `text-lg` | 18px | 16px | 16 | −2px |
| `text-xl` | 20px | 19px | 0 | — |
| `text-2xl` | 24px | 26px | 7 | +2px, las cifras grandes pesan más |

- [ ] **Step 1: Write the failing guard test**

Crear `src/lib/tipografia.guard.test.ts`:

```ts
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// La primera línea (`/// <reference types="node" />`) NO es decorativa y no se puede borrar:
// `tsconfig.app.json` fija `"types": ["vite/client"]`, así que los tipos de Node no entran
// solos y `tsc` corta con TS2591 en el import de `node:fs`. La alternativa era agregar "node"
// a ese `types`, pero eso mete los globales de Node en el chequeo de TODO el código de la
// app: un `process.env` perdido en código de navegador dejaría de ser un error. Esta forma
// resuelve el problema en el único archivo que lo tiene.
//
// GUARDIÁN, no test de lógica. Existe para que la escala tipográfica no se erosione: el
// modo en que se rompe un sistema de diseño no es una decisión, es un `text-[13px]` puesto
// a las apuradas que nadie revisa. Un test que falla es la única forma de que eso no pase.
//
// Si de verdad hace falta un tamaño nuevo, se agrega A LA ESCALA en tailwind.config.js —
// que es justamente la conversación que este test fuerza a tener.

function archivosFuente(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) { out.push(...archivosFuente(ruta)); continue; }
    if (/\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) out.push(ruta);
  }
  return out;
}

describe("escala tipográfica", () => {
  it("ningún archivo usa un tamaño de texto en píxeles a mano", () => {
    const culpables: string[] = [];
    for (const ruta of archivosFuente("src")) {
      const texto = readFileSync(ruta, "utf8");
      const encontrados = texto.match(/text-\[\d+(\.\d+)?px\]/g);
      if (encontrados) culpables.push(`${ruta}: ${[...new Set(encontrados)].join(", ")}`);
    }
    expect(culpables, `Usá la escala (text-2xs .. text-2xl) en vez de píxeles a mano:\n${culpables.join("\n")}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node node_modules/vitest/vitest.mjs run src/lib/tipografia.guard.test.ts > /tmp/tg.log 2>&1; echo "EXIT: $?"; tail -25 /tmp/tg.log
```
Expected: EXIT distinto de 0, y la lista de archivos con `text-[13px]` y compañía. **Esto
confirma que el guardián detecta el problema real antes de arreglarlo.**

- [ ] **Step 3: Add the scale to Tailwind**

En `tailwind.config.js`, dentro de `theme.extend`, agregar después de la línea de `fontFamily`:

```js
      // Escala tipográfica — 7 pasos, con su interlineado y su tracking.
      // POR QUÉ: había 764 usos de tamaño repartidos en 13 valores distintos, 499 de ellos
      // con píxeles a mano. Eso es lo que hace que una app se vea armada de a pedazos.
      // Los tamaños grandes llevan tracking negativo porque Inter, a partir de ~16px, se ve
      // suelta con el tracking por defecto: apretarla es lo que la hace ver editorial.
      // Ojo: estos valores PISAN los de Tailwind (sm pasa de 14 a 13, lg de 18 a 16). Es
      // deliberado, hacia una densidad de dashboard profesional.
      fontSize: {
        "2xs": ["11px", { lineHeight: "1.45" }],
        xs: ["12px", { lineHeight: "1.45" }],
        sm: ["13px", { lineHeight: "1.5" }],
        base: ["14px", { lineHeight: "1.55" }],
        lg: ["16px", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
        xl: ["19px", { lineHeight: "1.3", letterSpacing: "-0.015em" }],
        "2xl": ["22px", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        "3xl": ["26px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "4xl": ["32px", { lineHeight: "1.1", letterSpacing: "-0.025em" }],
      },
      transitionTimingFunction: {
        // Una sola curva para toda la app. Salidas rápidas y frenada suave: es lo que se
        // percibe como "responde al toque" en vez de "tiene animaciones".
        salida: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: { rapido: "120ms", medio: "200ms" },
```

- [ ] **Step 4: Add the focus ring and motion rules to the stylesheet**

> **Corregido durante la ejecución.** `src/index.css` **ya tenía** dos reglas parecidas, que
> mi auditoría no vio porque busqué sólo en archivos `.tsx`:
> ```css
> :focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
> @media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
> ```
> Agregar las nuevas sin más deja **cuatro reglas para dos cosas**: las de abajo ganan por
> cascada y las de arriba quedan como duplicados muertos, que es precisamente la deriva que
> este plan viene a cerrar. Así que **primero se borran esas dos líneas viejas** y después se
> agregan las nuevas, que las reemplazan y las amplían (selector explícito, caso de la barra
> lateral oscura, `animation-iteration-count`).

Primero, **borrar** de `src/index.css` estas dos líneas ya existentes:

```css
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
```

```css
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
```

Y después agregar al final del archivo:

```css
/* ============================================================
   FOCO VISIBLE (accesibilidad y percepción de calidad).
   Reemplaza una regla anterior que aplicaba a TODO con el selector universal, sin
   distinguir la barra lateral oscura — donde el negro del acento sobre negro es
   invisible, o sea que justo ahí no se veía. Se usa :focus-visible y no :focus para que el anillo
   aparezca al tabular y NO al hacer clic con el mouse, que es lo que molesta y lleva
   a que alguien lo desactive con outline:none.
   ============================================================ */
:where(a, button, input, select, textarea, [tabindex]):focus-visible{
  outline:2px solid var(--accent);
  outline-offset:2px;
  border-radius:6px;
}
/* El foco dentro de la barra lateral oscura necesita su propio color: el negro del
   acento sobre fondo negro es invisible. */
:where(aside) :where(a, button, [tabindex]):focus-visible{
  outline-color:var(--side-ink);
}

/* ============================================================
   MOVIMIENTO. Contenido: sólo opacidad y transform, que el navegador compone en GPU.
   Nada de animar width/height/top, que fuerza recálculo de layout y se ve a saltos.
   ============================================================ */
@keyframes aparecer{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes latir{0%,100%{opacity:1}50%{opacity:.45}}

.aparecer{animation:aparecer 200ms cubic-bezier(0.22,1,0.36,1) both}
.latir{animation:latir 1.4s ease-in-out infinite}

/* Respetar a quien pidió menos movimiento en su sistema operativo. No es un detalle
   de cortesía: para algunas personas el movimiento produce mareo real. */
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{
    animation-duration:.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.01ms !important;
  }
}
```

- [ ] **Step 5: Verify the build works and nothing broke**

El guardián sigue en rojo a propósito hasta la Task 5. Verificar el resto:

```bash
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"; tail -4 /tmp/b.log
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"
node node_modules/vitest/vitest.mjs run --exclude "**/tipografia.guard.test.ts" > /tmp/all.log 2>&1; echo "TESTS EXIT (sin el guardian): $?"; tail -6 /tmp/all.log
```
Expected: `BUILD EXIT: 0`, `TSC EXIT: 0`, `TESTS EXIT (sin el guardian): 0`.

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.js src/index.css src/lib/tipografia.guard.test.ts
git commit -m "feat: escala tipografica, foco visible y tokens de movimiento"
```

**Nota para quien ejecute:** este commit deja el guardián de tipografía en ROJO. El hook de
pre-commit corre toda la suite, así que **este commit va a ser rechazado** hasta que la Task 5
esté hecha. Hacé las Tasks 4 y 5 seguidas y commiteá una sola vez, al final de la Task 5, con
los archivos de las dos.

---

### Task 5: Migrar los 499 tamaños a mano a la escala

**Files:**
- Modify: los archivos de `src/` que usan `text-[Npx]` (499 ocurrencias)

**Interfaces:**
- Consumes: las clases de la escala definidas en la Task 4.
- Produces: nada nuevo. Es un reemplazo mecánico.

**Tabla de conversión** (el criterio es el paso más cercano; `10px` sube a `11px`, que además
es una mejora de legibilidad):

> **Corregido durante la ejecución.** El inventario real es **571** tamaños a mano en **20**
> valores distintos, no 499 en 13: mi grep original (`text-\[1[0-9]px\]`) sólo capturaba
> enteros de 10 a 19 y se perdió los decimales (`11.5px` ×28, `10.5px` ×15, `12.5px` ×14,
> `13.5px` ×6, `9.5px`) y los grandes (`22px`, `26px` ×2, `32px` ×2, `34px`, `9px` ×3). Con la
> tabla incompleta, el guardián habría quedado en rojo con 73 casos sin migrar. Por eso la
> escala tiene **9** pasos y no 7: los tamaños grandes existían y no tenían dónde caer.

| A mano | Escala | Valor |
|---|---|---|
| `text-[9px]`, `text-[9.5px]`, `text-[10px]`, `text-[10.5px]`, `text-[11px]`, `text-[11.5px]` | `text-2xs` | 11px |
| `text-[12px]`, `text-[12.5px]` | `text-xs` | 12px |
| `text-[13px]`, `text-[13.5px]` | `text-sm` | 13px |
| `text-[14px]`, `text-[15px]` | `text-base` | 14px |
| `text-[16px]`, `text-[17px]` | `text-lg` | 16px |
| `text-[18px]`, `text-[19px]` | `text-xl` | 19px |
| `text-[22px]` | `text-2xl` | 22px |
| `text-[26px]` | `text-3xl` | 26px |
| `text-[32px]`, `text-[34px]` | `text-4xl` | 32px |

- [ ] **Step 1: Record the starting point**

```bash
grep -ro "text-\[1[0-9]px\]" src --include=*.tsx | wc -l
```
Expected: `499`. Si da otro número, anotarlo y usar ese como referencia.

- [ ] **Step 2: Do the mechanical replacement**

El orden importa: los de dos dígitos primero, para que `text-[1px]` no exista y no haya
solapamientos. Todos los patrones son exactos, así que no hay ambigüedad.

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"
FILES=$(grep -rl "text-\[1[0-9]px\]" src --include=*.tsx)
sed -i \
  -e 's/text-\[10px\]/text-2xs/g' \
  -e 's/text-\[11px\]/text-2xs/g' \
  -e 's/text-\[12px\]/text-xs/g' \
  -e 's/text-\[13px\]/text-sm/g' \
  -e 's/text-\[14px\]/text-base/g' \
  -e 's/text-\[15px\]/text-base/g' \
  -e 's/text-\[16px\]/text-lg/g' \
  -e 's/text-\[17px\]/text-lg/g' \
  -e 's/text-\[18px\]/text-xl/g' \
  -e 's/text-\[19px\]/text-xl/g' \
  $FILES
echo "EXIT: $?"
```

- [ ] **Step 3: Verify none are left, and that no duplicate classes appeared**

```bash
echo "a mano que quedan (debe ser 0):"; grep -ro "text-\[[0-9.]*px\]" src --include=*.tsx | wc -l
echo "clases de texto duplicadas en un mismo className (debe ser 0):"
grep -roE "text-(2xs|xs|sm|base|lg|xl|2xl)[^\"']*text-(2xs|xs|sm|base|lg|xl|2xl)" src --include=*.tsx | wc -l
```
Expected: los dos en `0`. El segundo chequeo importa porque un archivo podía tener
`text-sm text-[13px]` y el reemplazo lo dejaría con la clase repetida.

Si el segundo da más de 0, listar los casos con el mismo `grep -rnE ...` y quitar a mano la
clase repetida en cada uno.

- [ ] **Step 4: Verify the guard test now passes**

```bash
node node_modules/vitest/vitest.mjs run src/lib/tipografia.guard.test.ts > /tmp/tg.log 2>&1; echo "EXIT: $?"; tail -8 /tmp/tg.log
```
Expected: `EXIT: 0`, 1 test passing.

- [ ] **Step 5: Full verification**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
```
Expected: los cuatro en `EXIT: 0`.

- [ ] **Step 6: Commit (junto con la Task 4)**

```bash
git add -A
git commit -m "refactor: 499 tamanos de texto a mano pasan a la escala tipografica"
```

---

### Task 6: Esqueletos de carga en lugar de "Cargando…"

**Files:**
- Create: `src/components/Skeleton.tsx`
- Create: `src/components/Skeleton.test.tsx`
- Modify: `src/App.tsx` (el fallback de `Suspense` y la pantalla de carga inicial)

**Interfaces:**
- Consumes: la clase `.latir` y la escala tipográfica de la Task 4; `cn` de `src/lib/ui`.
- Produces:
  - `export function Skeleton({ className }: { className?: string })`
  - `export function SkeletonVista()`

- [ ] **Step 1: Write the failing test**

Crear `src/components/Skeleton.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton, SkeletonVista } from "./Skeleton";

describe("Skeleton", () => {
  it("se anuncia como contenido que está cargando, para quien usa lector de pantalla", () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector('[aria-busy="true"]');
    expect(el).toBeTruthy();
  });

  it("queda fuera del árbol accesible: es decoración, no contenido", () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it("acepta clases para dar la forma del hueco que va a ocupar", () => {
    const { container } = render(<Skeleton className="h-8 w-40" />);
    expect(container.querySelector(".h-8.w-40")).toBeTruthy();
  });

  it("late, para que se lea como espera y no como algo colgado", () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector(".latir")).toBeTruthy();
  });
});

describe("SkeletonVista", () => {
  it("dibuja varios huecos: uno solo no insinúa una pantalla", () => {
    const { container } = render(<SkeletonVista />);
    expect(container.querySelectorAll(".latir").length).toBeGreaterThan(2);
  });

  it("no muestra la palabra Cargando: el esqueleto ya lo dice", () => {
    const { container } = render(<SkeletonVista />);
    expect(container.textContent ?? "").not.toMatch(/cargando/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node node_modules/vitest/vitest.mjs run src/components/Skeleton.test.tsx > /tmp/sk.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/sk.log
```
Expected: EXIT distinto de 0, con `Failed to resolve import "./Skeleton"`.

- [ ] **Step 3: Write the component**

Crear `src/components/Skeleton.tsx`:

```tsx
import { cn } from "../lib/ui";

// Hueco que late mientras se carga algo.
//
// POR QUÉ, y no es cosmético: un "Cargando…" en texto le dice a la persona que espere sin
// darle idea de qué va a aparecer, y la pantalla salta cuando el contenido llega. Un
// esqueleto con la forma de lo que viene reserva el espacio (no hay salto) y hace que la
// espera se sienta más corta de lo que es. Es la señal más barata que existe de software
// terminado.
//
// Accesibilidad: `aria-hidden` porque las barras grises no son contenido, y `aria-busy` en
// el contenedor para que un lector de pantalla anuncie que se está cargando en vez de leer
// el vacío.

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-busy="true">
      <div aria-hidden="true" className={cn("latir rounded-md bg-surface2", className ?? "h-4 w-full")} />
    </div>
  );
}

/**
 * Esqueleto genérico de una vista completa, para el `Suspense` que espera un módulo.
 * Insinúa la forma que comparten casi todas las pantallas: un título, una fila de
 * indicadores y una tarjeta grande.
 */
export function SkeletonVista() {
  return (
    <div className="px-4 sm:px-6 pt-5 pb-10 max-w-[1100px] w-full mx-auto flex flex-col gap-4">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node node_modules/vitest/vitest.mjs run src/components/Skeleton.test.tsx > /tmp/sk.log 2>&1; echo "EXIT: $?"; tail -8 /tmp/sk.log
```
Expected: `EXIT: 0`, 6 tests passing.

- [ ] **Step 5: Use it in App.tsx**

En `src/App.tsx`, agregar al bloque de imports:

```tsx
import { SkeletonVista } from "./components/Skeleton";
```

Reemplazar la línea del fallback de `Suspense`:

```tsx
        <Suspense fallback={<div className="px-6 py-8 text-ink2 text-sm">Cargando…</div>}>
```

por:

```tsx
        <Suspense fallback={<SkeletonVista />}>
```

Y reemplazar la pantalla de carga inicial:

```tsx
  if (loading) return <div className="min-h-screen grid place-items-center text-ink2">Cargando…</div>;
```

por:

```tsx
  // Esqueleto y no "Cargando…": es la primerísima pantalla que ve cualquiera al abrir la app.
  if (loading) return <div className="min-h-screen bg-bg"><SkeletonVista /></div>;
```

- [ ] **Step 6: Full verification**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
echo "no debe quedar ningun Cargando… en App.tsx:"; grep -c "Cargando" src/App.tsx || true
```
Expected: los cuatro comandos en `EXIT: 0`, y el `grep` en `0`.

- [ ] **Step 7: Commit**

```bash
git add src/components/Skeleton.tsx src/components/Skeleton.test.tsx src/App.tsx
git commit -m "feat: esqueletos de carga en lugar de texto Cargando"
```

---

### Task 7: `Panel` como única superficie — parte 1 (reporte y resumen)

**Files:**
- Modify: `src/components/Panel.tsx`
- Create: `src/components/Panel.test.tsx`
- Modify: `src/features/reporte/Reporte.tsx`, `src/features/reporte/AnalisisMensual.tsx`,
  `src/features/reporte/Comparador.tsx`, `src/features/resumen/Resumen.tsx`,
  `src/features/resumen/Delegaciones.tsx`, `src/features/resumen/RadarVencimientos.tsx`,
  `src/features/semana/Semana.tsx`

**Interfaces:**
- Produces: `export function Panel({ children, className, densidad }: { children: ReactNode; className?: string; densidad?: "normal" | "compacta" })`

- [ ] **Step 1: Write the failing test**

Crear `src/components/Panel.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Panel } from "./Panel";

describe("Panel", () => {
  // ANCLA DE LA MIGRACIÓN: este test es lo que hace que reemplazar 16 tarjetas hechas a mano
  // sea seguro sin mirar la pantalla. Si `Panel` produce exactamente las clases que estaban
  // escritas a mano, el cambio no puede alterar el aspecto de nada.
  it("produce las mismas clases que la tarjeta que estaba copiada a mano", () => {
    const { container } = render(<Panel>x</Panel>);
    const el = container.firstElementChild as HTMLElement;
    for (const clase of ["bg-surface", "border", "border-line", "rounded-2xl", "p-[18px]"]) {
      expect(el.className, `falta la clase ${clase}`).toContain(clase);
    }
  });

  it("lleva la sombra de tarjeta del sistema, no una propia", () => {
    const { container } = render(<Panel>x</Panel>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.boxShadow).toContain("var(--ring-sh)");
    expect(el.style.boxShadow).toContain("var(--shadow)");
  });

  it("deja agregar clases sin perder las propias", () => {
    const { container } = render(<Panel className="mt-4">x</Panel>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("mt-4");
    expect(el.className).toContain("bg-surface");
  });

  it("la densidad compacta cambia el padding y nada más", () => {
    const { container } = render(<Panel densidad="compacta">x</Panel>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("p-3");
    expect(el.className).not.toContain("p-[18px]");
    expect(el.className).toContain("rounded-2xl");
  });

  it("renderiza lo que le pongan adentro", () => {
    const { getByText } = render(<Panel><span>contenido</span></Panel>);
    expect(getByText("contenido")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node node_modules/vitest/vitest.mjs run src/components/Panel.test.tsx > /tmp/p.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/p.log
```
Expected: EXIT distinto de 0 — el test de `densidad` falla porque la prop todavía no existe.

- [ ] **Step 3: Add the variant to Panel**

Reemplazar el cuerpo de la función en `src/components/Panel.tsx` (dejando intacto el
comentario de arriba, que explica por qué existe el componente):

```tsx
export function Panel({ children, className, densidad = "normal" }: {
  children: ReactNode;
  className?: string;
  /** `compacta` para tarjetas dentro de otra tarjeta o filas densas. */
  densidad?: "normal" | "compacta";
}) {
  return (
    <div
      className={cn(
        "bg-surface border border-line rounded-2xl",
        densidad === "compacta" ? "p-3" : "p-[18px]",
        className,
      )}
      style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node node_modules/vitest/vitest.mjs run src/components/Panel.test.tsx > /tmp/p.log 2>&1; echo "EXIT: $?"; tail -8 /tmp/p.log
```
Expected: `EXIT: 0`, 5 tests passing.

- [ ] **Step 5: Migrate the seven files**

Para cada uno de estos siete archivos:

```
src/features/reporte/Reporte.tsx
src/features/reporte/AnalisisMensual.tsx
src/features/reporte/Comparador.tsx
src/features/resumen/Resumen.tsx
src/features/resumen/Delegaciones.tsx
src/features/resumen/RadarVencimientos.tsx
src/features/semana/Semana.tsx
```

hacé esto, **archivo por archivo**:

1. Buscá los `<div>` cuyo `className` contenga `bg-surface` junto con `rounded-2xl`:
   ```bash
   grep -n "bg-surface" src/features/reporte/Reporte.tsx
   ```
2. Reemplazá la etiqueta por `<Panel>`, moviendo al `className` de `Panel` **sólo** las
   clases que no sean `bg-surface`, `border`, `border-line`, `rounded-2xl` ni `p-[18px]`
   (esas cinco ya las pone `Panel`). Si el div traía un `style` con `boxShadow`, se borra:
   `Panel` ya lo aplica.
3. Cerrá con `</Panel>` la etiqueta correspondiente.
4. Agregá el import si no está: `import { Panel } from "../../components/Panel";`

**Ejemplo concreto de la transformación.** Antes:

```tsx
<div className="bg-surface border border-line rounded-2xl p-[18px] mb-4 flex flex-col gap-3"
  style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
  <h3 className="text-lg font-semibold m-0">Puntualidad</h3>
</div>
```

Después:

```tsx
<Panel className="mb-4 flex flex-col gap-3">
  <h3 className="text-lg font-semibold m-0">Puntualidad</h3>
</Panel>
```

**REGLA DURA: no toques nada más que esto.** Ni el contenido, ni los textos, ni la lógica.
Si un div tiene un padding distinto (por ejemplo `p-3`), usá `<Panel densidad="compacta">`;
si tiene un padding que no es ninguno de los dos, dejá ese div **sin migrar** y anotalo en el
reporte final — un padding raro puede ser intencional y decidirlo requiere ver la pantalla.

**Nunca edites JSX con expresiones regulares.** Ya pasó una vez en este proyecto y dejó un
`</div>` donde iba un `</Panel>`, rompiendo el archivo. Usá ediciones puntuales y exactas.

- [ ] **Step 6: Full verification**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
echo "tarjetas a mano que quedan en esos 7 archivos (deberia ser 0):"
grep -c "bg-surface.*rounded-2xl\|rounded-2xl.*bg-surface" src/features/reporte/*.tsx src/features/resumen/*.tsx src/features/semana/*.tsx 2>/dev/null | grep -v ":0" || echo "(ninguna)"
```
Expected: los cuatro comandos en `EXIT: 0`. El `grep` final idealmente sin resultados; si
queda alguno, tiene que ser uno de los casos de padding raro anotados en el paso 5.

- [ ] **Step 7: Commit**

```bash
git add src/components/Panel.tsx src/components/Panel.test.tsx src/features/reporte src/features/resumen src/features/semana
git commit -m "refactor: reporte y resumen usan Panel en vez de tarjetas a mano"
```

---

### Task 8: `Panel` como única superficie — parte 2, y el guardián

**Files:**
- Modify: `src/features/arqueo/MisArqueos.tsx`, `src/features/calendario/Calendario.tsx`,
  `src/features/cierre/Cierre.tsx`, `src/features/hoy/MiDia.tsx`,
  `src/features/mimes/MiMes.tsx`, `src/features/notas/Notas.tsx`,
  `src/features/organigrama/Organigrama.tsx`, `src/components/Login.tsx`
- Create: `src/components/Panel.guard.test.ts`

**Interfaces:**
- Consumes: `Panel` con la prop `densidad` de la Task 7.
- Produces: nada nuevo de código. El guardián que impide la recaída.

- [ ] **Step 1: Migrate the eight remaining files**

Mismo procedimiento **exacto** que el Step 5 de la Task 7, archivo por archivo, sobre estos ocho:

```
src/features/arqueo/MisArqueos.tsx
src/features/calendario/Calendario.tsx
src/features/cierre/Cierre.tsx
src/features/hoy/MiDia.tsx
src/features/mimes/MiMes.tsx
src/features/notas/Notas.tsx
src/features/organigrama/Organigrama.tsx
src/components/Login.tsx
```

Recordá el procedimiento (se repite acá porque quizá estés leyendo esta tarea sin la anterior):

1. `grep -n "bg-surface" <archivo>` para ubicar las tarjetas.
2. Cambiar el `<div>` por `<Panel>`, dejando en su `className` **sólo** las clases que no
   sean `bg-surface`, `border`, `border-line`, `rounded-2xl` ni `p-[18px]`.
3. Borrar el `style` con `boxShadow`: `Panel` ya lo pone.
4. Cerrar con `</Panel>`.
5. Import: `import { Panel } from "../../components/Panel";` (en `Login.tsx` es `"./Panel"`).

Con `p-3` en vez de `p-[18px]`, usar `<Panel densidad="compacta">`. Con un padding que no sea
ninguno de los dos, **dejarlo sin migrar** y anotarlo.

**Cuidado especial con `Login.tsx`:** es la primera pantalla que ve cualquiera y es la única
que se ve sin sesión. Si algo de esta tarea no cierra, dejala sin migrar y reportalo — es la
que menos conviene romper y la que menos se gana migrando.

**Nunca edites JSX con expresiones regulares.**

- [ ] **Step 2: Verify before adding the guard**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
```
Expected: los tres en `EXIT: 0`.

- [ ] **Step 3: Write the guard test**

Crear `src/components/Panel.guard.test.ts`:

```ts
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// La primera línea no se puede borrar: `tsconfig.app.json` fija `"types": ["vite/client"]`,
// así que sin ella `tsc` corta con TS2591 en el import de `node:fs`. Mismo motivo que en
// `src/lib/tipografia.guard.test.ts`.
//
// GUARDIÁN. `Panel` ya existía y se usaba en 2 archivos mientras otros 16 tenían la misma
// tarjeta copiada a mano. Así es como se deshace un sistema de diseño: nadie decide cambiarlo,
// simplemente cada copia se va separando un poco. Ya había pasado con las sombras, que
// llegaron a tener dos variantes distintas dando vueltas.
//
// Este test hace que la próxima tarjeta a mano no compile en verde. Si hace falta una
// superficie nueva de verdad, se le agrega una variante a `Panel` — que es la conversación
// que este test fuerza a tener.

/** Único archivo autorizado a definir el aspecto de una tarjeta. */
const EXCEPCIONES = ["Panel.tsx"];

function archivosFuente(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) { out.push(...archivosFuente(ruta)); continue; }
    if (!/\.tsx$/.test(nombre) || /\.test\.tsx$/.test(nombre)) continue;
    if (EXCEPCIONES.includes(nombre)) continue;
    out.push(ruta);
  }
  return out;
}

describe("Panel es la única superficie de tarjeta", () => {
  it("ningún archivo dibuja una tarjeta a mano", () => {
    const culpables: string[] = [];
    for (const ruta of archivosFuente("src")) {
      const texto = readFileSync(ruta, "utf8");
      // La firma de la tarjeta: fondo de superficie + esquina grande en el mismo className.
      for (const linea of texto.split("\n")) {
        if (/className=/.test(linea) && /bg-surface\b/.test(linea) && /rounded-2xl/.test(linea)) {
          culpables.push(`${ruta}: ${linea.trim().slice(0, 90)}`);
        }
      }
    }
    expect(culpables, `Usá <Panel> en vez de dibujar la tarjeta a mano:\n${culpables.join("\n")}`).toEqual([]);
  });

  it("nadie repite la sombra de tarjeta por su cuenta", () => {
    const culpables: string[] = [];
    for (const ruta of archivosFuente("src")) {
      if (/var\(--ring-sh\),\s*var\(--shadow\)/.test(readFileSync(ruta, "utf8"))) culpables.push(ruta);
    }
    expect(culpables, `La sombra de tarjeta la pone Panel:\n${culpables.join("\n")}`).toEqual([]);
  });
});
```

- [ ] **Step 4: Run the guard and fix whatever it finds**

```bash
node node_modules/vitest/vitest.mjs run src/components/Panel.guard.test.ts > /tmp/pg.log 2>&1; echo "EXIT: $?"; tail -30 /tmp/pg.log
```
Expected: `EXIT: 0`, 2 tests passing.

Si falla, la lista dice exactamente qué archivo y qué línea quedaron sin migrar: migralos con
el mismo procedimiento del Step 1 y volvé a correr. Si un caso es un padding raro que
decidiste no migrar, **agregá ese nombre de archivo a `EXCEPCIONES` junto con un comentario
de una línea explicando por qué** — una excepción documentada es honesta; un test borrado, no.

- [ ] **Step 5: Full verification**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
```
Expected: los cuatro en `EXIT: 0`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: Panel es la unica superficie de tarjeta, con test guardian"
```

---

## FASE 3 — Que el dato no rompa la pantalla

### Task 9: Normalizador en el borde de Supabase

**Files:**
- Create: `src/lib/normalizar.ts`
- Create: `src/lib/normalizar.test.ts`
- Modify: `src/hooks/useData.ts` (sólo la consulta de `cards`)

**Interfaces:**
- Consumes: el tipo `Card` de `src/lib/types.ts`.
- Produces:
  - `export function normalizarCard(fila: unknown): Card | null`
  - `export function normalizarCards(filas: unknown): Card[]`

**Por qué:** hoy lo que devuelve Supabase se trata como `Card` por fe. Si una fila viene con
`checklist` en `null` en vez de `[]` —porque una migración no corrió, porque alguien editó a
mano, porque un valor viejo quedó de otra versión— el `.map()` de un componente explota a diez
niveles de profundidad y la pantalla se cae con un error que no dice nada útil. Sanear en el
borde convierte "la pantalla se rompe" en "esa tarjeta no aparece", que es infinitamente mejor.

- [ ] **Step 1: Write the failing test**

Crear `src/lib/normalizar.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizarCard, normalizarCards } from "./normalizar";

const FILA_OK = {
  id: "c1", owner: "u1", title: "IVA", status: "pend", description: "",
  checklist: [], comments: [], history: [], done_at: null, proc_at: null,
  due_date: "2026-07-20", recurring: false, priority: "media", effort: 2,
  card_type: "normal", deps: [], created_at: "2026-07-01T00:00:00Z",
};

describe("normalizarCard", () => {
  it("deja pasar una fila correcta sin cambiarla", () => {
    const c = normalizarCard(FILA_OK)!;
    expect(c.id).toBe("c1");
    expect(c.title).toBe("IVA");
  });

  // El caso que motiva todo esto: un null donde el componente espera un arreglo.
  it("convierte los arreglos nulos en arreglos vacíos", () => {
    const c = normalizarCard({ ...FILA_OK, checklist: null, comments: null, history: null, deps: null })!;
    expect(c.checklist).toEqual([]);
    expect(c.comments).toEqual([]);
    expect(c.history).toEqual([]);
    expect(c.deps).toEqual([]);
  });

  it("también si vienen como algo que no es un arreglo", () => {
    const c = normalizarCard({ ...FILA_OK, checklist: "no soy un arreglo", deps: 42 })!;
    expect(c.checklist).toEqual([]);
    expect(c.deps).toEqual([]);
  });

  it("un estado desconocido cae a pendiente en vez de romper el tablero", () => {
    // Una columna inventada dejaría la tarjeta sin carril y sin forma de verla.
    expect(normalizarCard({ ...FILA_OK, status: "zaraza" })!.status).toBe("pend");
  });

  it("una prioridad desconocida cae a media", () => {
    expect(normalizarCard({ ...FILA_OK, priority: "urgentisima" })!.priority).toBe("media");
  });

  it("un tipo de tarjeta desconocido cae a normal", () => {
    expect(normalizarCard({ ...FILA_OK, card_type: "otra cosa" })!.card_type).toBe("normal");
  });

  it("un esfuerzo que no es número cae a 1, para que las sumas no den NaN", () => {
    // Un solo NaN contamina todos los totales del reporte sin dejar rastro de dónde salió.
    expect(normalizarCard({ ...FILA_OK, effort: "mucho" })!.effort).toBe(1);
  });

  it("el título ausente no deja la tarjeta sin nombre", () => {
    expect(normalizarCard({ ...FILA_OK, title: null })!.title).toBe("(sin título)");
  });

  // Sin id o sin owner la tarjeta es inservible: no se puede abrir ni guardar.
  it("descarta una fila sin id", () => {
    expect(normalizarCard({ ...FILA_OK, id: null })).toBeNull();
  });

  it("descarta una fila sin owner", () => {
    expect(normalizarCard({ ...FILA_OK, owner: undefined })).toBeNull();
  });

  it("descarta lo que no es un objeto", () => {
    for (const raro of [null, undefined, 0, "", [], "texto"]) {
      expect(normalizarCard(raro)).toBeNull();
    }
  });
});

describe("normalizarCards", () => {
  it("una fila podrida no se lleva puestas a las buenas", () => {
    const cards = normalizarCards([FILA_OK, { ...FILA_OK, id: null }, { ...FILA_OK, id: "c2" }]);
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("con una entrada que no es lista devuelve lista vacía, sin explotar", () => {
    expect(normalizarCards(null)).toEqual([]);
    expect(normalizarCards({ raro: true })).toEqual([]);
  });

  it("filtra los nulos del arreglo", () => {
    expect(normalizarCards([FILA_OK, null, undefined])).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node node_modules/vitest/vitest.mjs run src/lib/normalizar.test.ts > /tmp/n.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/n.log
```
Expected: EXIT distinto de 0, con `Failed to resolve import "./normalizar"`.

- [ ] **Step 3: Write the implementation**

Crear `src/lib/normalizar.ts`:

```ts
import type { Card, Status } from "./types";

// Saneado en el BORDE: lo último que pasa antes de que un dato de la base entre a un
// componente.
//
// POR QUÉ. Hasta acá, lo que devolvía Supabase se trataba como `Card` por fe. Si una fila
// llega con `checklist` en `null` en vez de `[]` —una migración que no corrió, una edición a
// mano, un valor viejo de otra versión—, el `.map()` de un componente explota diez niveles
// más abajo y se cae la pantalla entera con un mensaje que no ayuda a nadie.
//
// La decisión de diseño: una fila inservible se DESCARTA en silencio, no se corrige a la
// fuerza ni se deja pasar. Que falte una tarjeta es un problema chico y visible; que se caiga
// la pantalla es un problema grande. Y un `effort` que no es número es peor que ruidoso: un
// solo NaN contamina todos los totales del reporte sin dejar rastro de dónde salió.

const ESTADOS: Status[] = ["pend", "proc", "term"];
const PRIORIDADES = ["alta", "media", "baja"] as const;
const TIPOS = ["normal", "operativa"] as const;

function texto(v: unknown, porDefecto = ""): string {
  return typeof v === "string" ? v : porDefecto;
}

function textoONulo(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function lista<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function unaDe<T extends string>(v: unknown, opciones: readonly T[], porDefecto: T): T {
  return typeof v === "string" && (opciones as readonly string[]).includes(v) ? (v as T) : porDefecto;
}

/** Una fila cruda convertida en `Card`, o `null` si es inservible. */
export function normalizarCard(fila: unknown): Card | null {
  if (!fila || typeof fila !== "object" || Array.isArray(fila)) return null;
  const f = fila as Record<string, unknown>;

  // Sin id ni owner la tarjeta no se puede abrir ni guardar: no hay nada que rescatar.
  const id = texto(f.id);
  const owner = texto(f.owner);
  if (!id || !owner) return null;

  const esfuerzo = Number(f.effort);

  return {
    ...f,
    id,
    owner,
    title: texto(f.title) || "(sin título)",
    status: unaDe(f.status, ESTADOS, "pend"),
    description: texto(f.description),
    checklist: lista(f.checklist),
    comments: lista(f.comments),
    history: lista(f.history),
    deps: lista<string>(f.deps).filter((d) => typeof d === "string"),
    done_at: textoONulo(f.done_at),
    proc_at: textoONulo(f.proc_at),
    due_date: textoONulo(f.due_date),
    recurring: f.recurring === true,
    priority: unaDe(f.priority, PRIORIDADES, "media"),
    effort: Number.isFinite(esfuerzo) && esfuerzo > 0 ? esfuerzo : 1,
    card_type: unaDe(f.card_type, TIPOS, "normal"),
    created_at: texto(f.created_at),
  } as Card;
}

/** Lista saneada. Una fila podrida no se lleva puestas a las demás. */
export function normalizarCards(filas: unknown): Card[] {
  if (!Array.isArray(filas)) return [];
  const out: Card[] = [];
  for (const f of filas) {
    const c = normalizarCard(f);
    if (c) out.push(c);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node node_modules/vitest/vitest.mjs run src/lib/normalizar.test.ts > /tmp/n.log 2>&1; echo "EXIT: $?"; tail -8 /tmp/n.log
```
Expected: `EXIT: 0`, 15 tests passing.

Si `Status` no se exporta desde `src/lib/types.ts`, cambiá el import por
`import type { Card } from "./types";` y declará `const ESTADOS = ["pend", "proc", "term"] as const;`
usando `unaDe(f.status, ESTADOS, "pend")` igual que los otros.

- [ ] **Step 5: Wire it into the cards query**

En `src/hooks/useData.ts`, ubicar el hook `useCards`:

```bash
grep -n "useCards" -A 12 src/hooks/useData.ts
```

Agregar el import arriba del archivo:

```ts
import { normalizarCards } from "../lib/normalizar";
```

y envolver lo que devuelve la consulta de `cards` con `normalizarCards(...)`, dejando el
manejo de errores como está. Es decir, donde hoy devuelve los datos crudos (algo como
`return data ?? []`), pasa a:

```ts
    // Saneado en el borde (lib/normalizar.ts): una fila rara no puede tumbar una pantalla.
    return normalizarCards(data);
```

**Sólo la consulta de `cards`.** Las demás tablas quedan como están: `cards` es la que
alimenta casi todas las vistas y la que más columnas fue acumulando entre migraciones, así
que es donde el saneado paga. Extenderlo al resto sin una razón concreta sería agregar
código por simetría.

- [ ] **Step 6: Full verification**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
```
Expected: los cuatro en `EXIT: 0`. **Si algún test de otra parte se pone en rojo acá, es un
hallazgo, no un estorbo:** significa que algo dependía de un dato sin sanear. Reportalo con
la salida textual en vez de ajustar el normalizador para que el test viejo pase.

- [ ] **Step 7: Commit**

```bash
git add src/lib/normalizar.ts src/lib/normalizar.test.ts src/hooks/useData.ts
git commit -m "feat: saneado de filas en el borde de Supabase"
```

---

## CIERRE

### Task 10: Changelog, documentación y verificación final

**Files:**
- Modify: `src/lib/version.ts`
- Modify: `docs/ESTADO-DEL-PROYECTO.md`
- Create: `docs/SISTEMA-VISUAL.md`

**Interfaces:**
- Consumes: todo lo anterior. No produce código.

- [ ] **Step 1: Add the changelog entry**

En `src/lib/version.ts`, agregar una entrada **arriba de todo** en `CHANGELOG` (no editar
`APP_VERSION`, que se deriva sola):

```ts
  {
    version: "2.9.0",
    fecha: "2026-07-29",
    cambios: [
      "Si publicamos una versión nueva mientras tenés la app abierta, ahora te avisa y te ofrece actualizar con un botón. Antes mostraba un error genérico y el botón de reintentar no podía funcionar.",
      "Las pantallas de error ahora dicen qué pasó en lenguaje claro, ofrecen la acción que de verdad sirve, y te dejan copiar el detalle para mandarlo por Consultas.",
      "Si algo falla en segundo plano, ahora te enterás en vez de que la acción quede sin efecto en silencio.",
      "Mientras carga una pantalla ahora se ve la forma de lo que viene, en lugar de la palabra \"Cargando\".",
      "Tipografía unificada en toda la app: se acabaron las diferencias de un píxel entre pantallas.",
      "Al navegar con el teclado ahora se ve claramente dónde estás parado.",
      "Si tenés activado \"reducir movimiento\" en tu sistema, la app lo respeta.",
      "Las tarjetas de todas las pantallas ahora salen del mismo componente, así no se van separando con el tiempo.",
      "Una tarea con datos incompletos ya no puede tumbar una pantalla entera.",
    ],
  },
```

- [ ] **Step 2: Write the design system doc**

Crear `docs/SISTEMA-VISUAL.md`:

```markdown
# Sistema visual

Qué usar y qué no, para que la app no se vaya separando con el tiempo. Hay dos tests
guardianes que hacen cumplir esto: `src/lib/tipografia.guard.test.ts` y
`src/components/Panel.guard.test.ts`.

## Tipografía

Siete pasos, definidos en `tailwind.config.js`. **Nunca** un tamaño en píxeles a mano.

| Clase | Tamaño | Para qué |
|---|---|---|
| `text-2xs` | 11px | metadatos, chips, sellos |
| `text-xs` | 12px | texto de apoyo, notas al pie |
| `text-sm` | 13px | el caballito de batalla: listas, tablas, descripciones |
| `text-base` | 14px | cuerpo |
| `text-lg` | 16px | título de sección |
| `text-xl` | 19px | título de pantalla |
| `text-2xl` | 26px | una cifra que tiene que pesar |

Estos valores **pisan** los de Tailwind (su `text-sm` es 14px, el nuestro 13px). Es
deliberado: densidad de dashboard profesional. Si te falta un tamaño, se agrega a la escala
—no se pone a mano— y esa es la conversación que el guardián fuerza a tener.

Los números que se comparan van con `tnum` (cifras de ancho fijo), así no bailan las columnas.

## Superficies

Una tarjeta es `<Panel>`. Siempre. Con `densidad="compacta"` cuando va dentro de otra tarjeta.
Nadie repite `bg-surface ... rounded-2xl` ni la sombra `var(--ring-sh),var(--shadow)` por su
cuenta: `Panel` es el único lugar donde eso se decide.

## Color

Todo sale de las variables de `src/index.css`. La marca es monocroma —negro, blanco, grises—
y el color aparece **sólo** en estados: `--done` (verde), `--warn` (ámbar), `--danger` (rojo).
Nunca un color hexadecimal escrito en un componente.

## Movimiento

Una sola curva (`ease-salida`) y dos duraciones (`duration-rapido` 120ms, `duration-medio`
200ms). Se animan **sólo** opacidad y `transform`, que el navegador compone en GPU; animar
`width`, `height` o `top` fuerza recálculo de layout y se ve a saltos.

`.aparecer` para algo que entra, `.latir` para algo que espera.

`prefers-reduced-motion` está respetado globalmente. No es cortesía: para algunas personas el
movimiento produce mareo real.

## Foco

Global, con `:focus-visible` (aparece al tabular, no al hacer clic con el mouse). Dentro de la
barra lateral oscura usa `--side-ink`, porque el negro del acento sobre negro es invisible.
**Nunca** `outline: none` sin poner otro indicador en su lugar.

## Estados de carga

`<Skeleton>` con la forma de lo que va a aparecer, o `<SkeletonVista>` para una pantalla
completa. Nunca la palabra "Cargando": reserva el espacio, evita el salto, y hace que la
espera se sienta más corta.

## Errores

Nunca un mensaje crudo de la base en pantalla. Todo pasa por `clasificarFalla` de
`src/lib/fallas.ts`, que devuelve título, explicación en lenguaje de usuario y **la acción que
de verdad desatasca**. Ofrecer "Reintentar" cuando reintentar no puede funcionar es peor que
no ofrecer nada.
```

- [ ] **Step 3: Update the project status doc**

En `docs/ESTADO-DEL-PROYECTO.md`:

1. En la sección 1, actualizar la versión a **v2.9.0** y el número de tests al que dé la
   corrida final del Step 4.
2. Agregar al final de la tabla de la sección 3:

```markdown
| Recuperación de fallas (versión nueva, sin conexión, permisos) | Hecho |
| Sistema visual: escala tipográfica, foco, movimiento, esqueletos | Hecho |
| `Panel` en todas las pantallas, con test guardián | Hecho |
| Saneado de filas en el borde de Supabase | Hecho |
```

3. En la sección 4 (Pendiente MÍO), **borrar** el punto 1 sobre migrar las pantallas al
   componente `Panel`: lo hicieron las Tasks 7 y 8.

- [ ] **Step 4: Final full verification**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"; tail -6 /tmp/l.log
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
echo "--- guardianes ---"
node node_modules/vitest/vitest.mjs run src/lib/tipografia.guard.test.ts src/components/Panel.guard.test.ts > /tmp/g.log 2>&1; echo "GUARDIANES EXIT: $?"
echo "--- higiene ---"
echo "tamanos a mano (0):"; grep -ro "text-\[[0-9.]*px\]" src --include=*.tsx | wc -l
echo "console.log (0):"; grep -r "console\.log" src --include=*.ts --include=*.tsx | grep -v test | wc -l
echo "any (0):"; grep -r ": any\|as any" src --include=*.ts --include=*.tsx | grep -v test | wc -l
```
Expected: `TSC EXIT: 0`, `LINT EXIT: 0`, `TESTS EXIT: 0`, `BUILD EXIT: 0`,
`GUARDIANES EXIT: 0`, y los tres contadores de higiene en `0`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: changelog 2.9.0 y sistema visual documentado"
```

---

## Sobre agregar herramientas (respuesta directa)

Pediste que agregue programas si sirven y son portables. **No puedo agregar ninguna
dependencia**, y no es una preferencia: en esta máquina no hay `npm`, `pnpm`, `yarn` ni
`corepack` (verificado). Sin gestor de paquetes no se puede instalar nada ni regenerar el
`package-lock.json`, y subir un `package.json` desincronizado rompería el CI.

Lo que **habría** agregado, para que quede anotado el día que haya npm:

| Herramienta | Para qué | Reemplazo en este plan |
|---|---|---|
| **Sentry** | ver los errores que le pasan al equipo sin que tengan que contártelos | El detalle copiable del ErrorBoundary + el canal de Consultas. Manual, pero funciona |
| **zod** | validar en el borde con esquemas declarativos | `lib/normalizar.ts`, a mano. Menos elegante, mismo efecto donde importa |
| **Framer Motion** | transiciones ricas | Dos `@keyframes` y dos tokens. Para esta app alcanza: el movimiento sobrio se ve más caro que el abundante |
| **axe-core** | auditar accesibilidad automáticamente | Foco visible global y `aria-busy` a mano. Cubre lo más grave, no todo |

Nada de esto es bloqueante para el objetivo. La diferencia real entre esta app y un producto
de 2000 dólares no estaba en las librerías que le faltan: estaba en los 13 tamaños de letra,
en las 16 tarjetas copiadas y en un botón que ofrecía reintentar algo que no podía funcionar.

## Lo que este plan deja afuera a propósito

- **Rediseñar pantallas.** Esto unifica el sistema, no cambia la disposición de nada. Un
  rediseño necesita que vos mires y opines; esto se verifica con tests.
- **Un tema claro/oscuro nuevo.** Los tokens de color ya están bien: monocromos, en un solo
  origen, con doble tema. Tocarlos sería empeorar algo que funciona.
- **Migrar las tablas restantes al normalizador.** Sólo `cards`, que es la que alimenta casi
  todo. Extenderlo por simetría es agregar código sin un problema que lo justifique.
- **`aria-label` en los 165 archivos.** Se hizo lo de mayor impacto (foco visible global,
  `aria-busy` en la carga). Una pasada completa de accesibilidad merece su propio plan y una
  herramienta que la mida, no un barrido a ojo.

---

## Hallazgo: Panel cubre el 40% de las superficies

Al ejecutar las Tasks 7 y 8 se midió cuántas superficies de tarjeta hay realmente en `src/`.
La premisa del plan —"~15 archivos tienen el mismo par de estilos copiado a mano"— no es lo
que hay en el árbol.

**Números** (contando instancias renderizadas, no líneas de código: varios archivos reusaban
una const `card` en un solo lugar del texto pero la aplicaban en 5 o 9 tarjetas):

- **41** instancias de superficie tipo tarjeta con `bg-surface` + `rounded-2xl`.
- **18** son la tarjeta canónica (`bg-surface` + `p-[18px]`), la única que `Panel` reproduce
  exactamente y de la que `Panel.test.tsx` prueba que la migración es visualmente neutra.
- **17 migradas** a `Panel` en las Tasks 7 y 8. La 18.ª es `MiMes.tsx:51`, ver abajo.
- **23** son otras 4 o 5 superficies, genuinamente distintas:

| Padding | Instancias | Archivos |
|---|---|---|
| `p-4` (fichas de estadística, centradas) | 8 | `reporte/Reporte.tsx`, `reporte/AnalisisMensual.tsx`, `arqueo/MisArqueos.tsx` |
| `px-5 py-4` | 6 | `resumen/Resumen.tsx`, `resumen/Delegaciones.tsx`, `resumen/RadarVencimientos.tsx`, `mimes/MiMes.tsx` |
| sin padding (`overflow-hidden`, el padding lo ponen los hijos) | 6 | `calendario/Calendario.tsx`, `cierre/Cierre.tsx`, `hoy/MiDia.tsx`, `notas/Notas.tsx` |
| `p-8` | 2 | `organigrama/Organigrama.tsx`, `components/Login.tsx` |
| `p-5` | 1 | `cierre/Cierre.tsx` |

**Recomendación: decidir las variantes mirando la pantalla, no el diff.** No se agregaron
variantes nuevas a `Panel` a propósito. Forzar cualquiera de estas 23 dentro de `Panel` cambia
el padding —y en las que no traen `border border-line`, agrega un borde— y eso es un cambio
visual que no se puede verificar con tests. Las candidatas naturales son una variante de ficha
de estadística (`p-4`, centrada) y una sin padding para los shells `overflow-hidden`, que
juntas cubrirían 14 de las 23.

**El caso `MiMes.tsx:51`** es la única tarjeta canónica que quedó sin migrar, y es la que pide
una variante de `Panel` **sin borde**: tiene el padding correcto (`p-[18px]`) pero lleva
`border-l-[3px]` con `border-done` o `border-warn` como acento de estado. `Panel` agrega
`border border-line`, y `border-done` —que es una utilidad de color de borde, no de un solo
lado— terminaría pintando los cuatro lados en verde o naranja en vez de sólo la barra
izquierda. Es un cambio visual claro, así que se dejó como estaba.

**Alcance del guardián.** Por todo esto `src/components/Panel.guard.test.ts` es angosto: cubre
la tarjeta canónica y la sombra inválida, y declara en su comentario de cabecera que no cubre
el resto. La alternativa era un chequeo amplio con ~15 excepciones, que aparenta una cobertura
que no existe.
