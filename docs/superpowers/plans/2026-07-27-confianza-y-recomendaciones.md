# Confianza del dato y motor de recomendaciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el sistema sepa **de qué datos puede fiarse** y, sobre esa base, proponga
**acciones concretas** en vez de sólo mostrar números.

**Architecture:** Tres capas encadenadas, todas **funciones puras** sobre datos existentes.
(1) El **ICR** mide qué tan representativo es el registro. (2) La **exposición** responde qué
vence si nadie hace nada. (3) El **motor de recomendaciones** compone las señales que ya
existen en frases accionables — y **se calla cuando el ICR dice que el dato no alcanza**. Esa
última regla es lo que separa un motor útil de un generador de ruido.

**Tech Stack:** TypeScript, React 19, vitest. Sin librerías nuevas, sin migraciones nuevas.

## Global Constraints

- **Encuadre no punitivo (regla dura).** Un ICR bajo **invalida las métricas, no a la
  persona**. Esa frase va impresa en la pantalla, no sólo en el código.
- **Cero emojis.** Íconos sólo Lucide. Monocromo; el color sólo comunica estado.
- **Sin dependencias nuevas. Sin migraciones nuevas. Sin tracking nuevo.** Si para medir la
  calidad del dato hubiera que instalar vigilancia, el remedio sería peor que la enfermedad.
- Funciones puras: **sin `new Date()` adentro** — la fecha entra por parámetro.
- **Muestra mínima siempre visible.** Ningún indicador se publica sin decir sobre cuántos
  casos se calculó (mismo criterio que `puntualidad.ts` con `muestraChica`).

---

## 0. Análisis del estado actual (qué de la lista 23–48 ya existe)

| Idea | Ya resuelto por |
|---|---|
| 23 Salud del equipo (score único) | `saludScore()` en `metrics.ts` — ya se muestra en Reporte |
| 40 Consistencia mensual | `estabilidad.ts` — **recién construido** en la tanda anterior |
| 42 Complejidad real (peso por tarea) | Campo `effort` (1/2/3/5 puntos), ya se usa en el ranking |
| 38 Ranking de procesos lentos | `analitica-operativas.ts` (tiempo por tipo) |
| 29 Mapa de especialización · 30 Mapa de reemplazos | `busfactor.ts` + `vacaciones.ts` (reemplazante) |
| 44 Cadena crítica | `deps.ts` (dependencias encadenadas) |
| 24 Evolución de cada tarea | `history[]` ya lo registra; se ve en el modal de la tarea |
| 34 Radar de eficiencia | Los ejes existen sueltos: salud, puntualidad, previsibilidad, retrabajo |

**Descartadas con motivo** (no por olvido):

- **26 KPI de interrupciones (pausas):** la tabla `card_pausas` existe pero está **vacía y sin
  UI**. Medir pausas que nadie registra daría 0 siempre — un indicador que miente.
- **35 Detección de rutina · 25 Historial del puesto:** necesitan años de historia. El
  proyecto tiene meses. Volverían a mirarse cuando haya datos.
- **39 Nivel de automatización:** no existe el concepto de "proceso automatizado" en el
  modelo. Habría que inventarlo antes.
- **36 Balance por horario · 27 Índice de concentración · 41 Huella operativa:** son
  **medición de personas**, no de procesos: a qué hora trabaja cada uno, si se fragmenta, su
  legajo de productividad. Cruzan la línea del encuadre no punitivo del proyecto. Si algún
  día se quieren, van con una decisión explícita tuya, no coladas en un plan técnico.
- **43 Índice de estabilidad del jefe:** conceptualmente buena (el jefe también afecta), pero
  hoy los cambios de prioridad no se registran como evento, así que no hay qué medir.
- **33 Modo auditoría (replay):** factible con `history[]`, pero es un visor grande y de uso
  esporádico. Queda para después de lo de acá, que rinde más por hora invertida.
- **46 Modo Cierre:** buena idea, pero es puro trabajo de UI condicional en muchas pantallas.
  Conviene hacerlo cuando el resto esté estable.

**Lo que entra, y por qué en este orden:**

| # | Idea | Por qué |
|---|---|---|
| 47 | **ICR — confianza del dato** ⭐ | Ya está **completamente diseñado** en `docs/PROPUESTA-ICR.md` (5 factores, pesos, salvaguardas) y el propio documento concluye que se calcula hoy sin datos nuevos. Es la base de todo lo demás. |
| 45 | **¿Qué pasa si no hago nada?** | Tu favorita. Dato trivial (`due_date` + `status`), impacto alto: convierte una lista en una consecuencia. |
| 28·31·32·37 | **Salud operativa** (espera hasta comenzar, edad de tareas, multitarea) | Cuatro métricas baratas que salen de la misma pasada sobre las cards. |
| 48 | **Motor de recomendaciones** ⭐ | La joya. NO es IA: es un motor de reglas sobre señales que ya existen. **Gateado por el ICR**: si el dato no es confiable, no recomienda. |

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/icr.ts` (nuevo) | **Puro.** Los 5 factores del ICR y el puntaje 0..100 con tamaño de muestra. |
| `src/lib/icr.test.ts` (nuevo) | Tests, incluidas las salvaguardas anti-castigo. |
| `src/lib/exposicion.ts` (nuevo) | **Puro.** Qué vence si nadie toca nada, por horizonte. |
| `src/lib/exposicion.test.ts` (nuevo) | Tests. |
| `src/lib/salud-operativa.ts` (nuevo) | **Puro.** Espera hasta comenzar, edad por estado, multitarea. |
| `src/lib/salud-operativa.test.ts` (nuevo) | Tests. |
| `src/lib/recomendaciones.ts` (nuevo) | **Puro.** Motor de reglas → recomendaciones accionables, gateado por ICR. |
| `src/lib/recomendaciones.test.ts` (nuevo) | Tests, incluido "con ICR bajo no recomienda". |
| `src/features/director/Director.tsx` (modificar) | Suma el bloque de exposición y las recomendaciones. |

---

## Task 1: ICR — Índice de Calidad del Registro

Implementa `docs/PROPUESTA-ICR.md` sección 3.2. **Leé ese documento antes de empezar**: tiene
los 5 factores, sus pesos y las 5 salvaguardas anti-castigo, que son parte del requisito.

**Files:**
- Create: `src/lib/icr.ts`
- Test: `src/lib/icr.test.ts`

**Interfaces:**
- Consumes: `Card` de `src/lib/types.ts` (`proc_at`, `done_at`, `created_at`, `status`, `card_type`, `history`).
- Produces:
  - `export interface FactorICR { clave: "F1"|"F2"|"F3"|"F4"|"F5"; nombre: string; valor: number; peso: number }`
  - `export interface ResultadoICR { puntaje: number | null; muestra: number; suficiente: boolean; factores: FactorICR[]; lectura: string }`
  - `export function icr(cards: Card[], hoyISO: string): ResultadoICR`
  - `export const MUESTRA_MINIMA = 8`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { icr, MUESTRA_MINIMA } from "./icr";
import type { Card } from "./types";

const HOY = "2026-07-31T12:00:00Z";

function card(over: Partial<Card> = {}): Card {
  return {
    id: Math.random().toString(36).slice(2), owner: "u1", title: "T", status: "term",
    description: "", checklist: [], comments: [], history: [],
    created_at: "2026-07-01T09:00:00Z",
    proc_at: "2026-07-02T09:00:00Z",
    done_at: "2026-07-02T17:00:00Z",
    due_date: "2026-07-10", recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], ...over,
  };
}
/** n tareas cerradas impecablemente. */
const buenas = (n: number) => Array.from({ length: n }, () => card());

describe("icr — muestra mínima", () => {
  it(`con menos de ${MUESTRA_MINIMA} cerradas no publica número`, () => {
    const r = icr(buenas(MUESTRA_MINIMA - 1), HOY);
    expect(r.suficiente).toBe(false);
    expect(r.puntaje).toBeNull();
    expect(r.muestra).toBe(MUESTRA_MINIMA - 1);
  });
  it("con muestra suficiente sí publica", () => {
    const r = icr(buenas(MUESTRA_MINIMA), HOY);
    expect(r.suficiente).toBe(true);
    expect(r.puntaje).not.toBeNull();
  });
  it("sin datos no explota", () => {
    expect(icr([], HOY).puntaje).toBeNull();
    expect(icr(null as unknown as Card[], HOY).muestra).toBe(0);
  });
});

describe("icr — registro impecable", () => {
  it("da un puntaje alto", () => {
    expect(icr(buenas(10), HOY).puntaje!).toBeGreaterThanOrEqual(90);
  });
  it("expone los 5 factores con sus pesos", () => {
    const f = icr(buenas(10), HOY).factores;
    expect(f.map((x) => x.clave)).toEqual(["F1", "F2", "F3", "F4", "F5"]);
    expect(f.reduce((s, x) => s + x.peso, 0)).toBe(100);
  });
});

describe("icr — F1 trazabilidad de estados", () => {
  it("cerrar sin haber pasado por 'En proceso' baja el puntaje", () => {
    const sinProc = Array.from({ length: 10 }, () => card({ proc_at: null }));
    const r = icr(sinProc, HOY);
    expect(r.factores.find((f) => f.clave === "F1")!.valor).toBe(0);
    expect(r.puntaje!).toBeLessThan(80);
  });
  it("proc_at posterior a done_at no cuenta como trazable", () => {
    const invertido = Array.from({ length: 10 }, () =>
      card({ proc_at: "2026-07-05T10:00:00Z", done_at: "2026-07-04T10:00:00Z" }));
    expect(icr(invertido, HOY).factores.find((f) => f.clave === "F1")!.valor).toBe(0);
  });
});

describe("icr — F2 registro no colapsado (con su salvaguarda)", () => {
  it("marcar 'En proceso' recién al terminar, en una tarea vieja, baja F2", () => {
    const colapsadas = Array.from({ length: 10 }, () => card({
      created_at: "2026-07-01T09:00:00Z",
      proc_at: "2026-07-20T16:55:00Z",
      done_at: "2026-07-20T17:00:00Z",
    }));
    expect(icr(colapsadas, HOY).factores.find((f) => f.clave === "F2")!.valor).toBe(0);
  });
  it("SALVAGUARDA: una tarea corta y reciente NO se penaliza", () => {
    const cortasLegitimas = Array.from({ length: 10 }, () => card({
      created_at: "2026-07-20T16:00:00Z",
      proc_at: "2026-07-20T16:55:00Z",
      done_at: "2026-07-20T17:00:00Z",
    }));
    expect(icr(cortasLegitimas, HOY).factores.find((f) => f.clave === "F2")!.valor).toBe(1);
  });
  it("SALVAGUARDA: una tarea larga bien registrada da F2 perfecto", () => {
    const larga = Array.from({ length: 10 }, () => card({
      created_at: "2026-07-01T09:00:00Z",
      proc_at: "2026-07-02T09:00:00Z",
      done_at: "2026-07-22T17:00:00Z",
    }));
    expect(icr(larga, HOY).factores.find((f) => f.clave === "F2")!.valor).toBe(1);
  });
});

describe("icr — exclusiones", () => {
  it("las operativas NO cuentan (por diseño no pasan por 'En proceso')", () => {
    const opers = Array.from({ length: 5 }, () => card({ card_type: "operativa", proc_at: null }));
    expect(icr([...buenas(8), ...opers], HOY).muestra).toBe(8);
  });
  it("sólo cuenta lo cerrado dentro de la ventana de 30 días", () => {
    const vieja = card({ done_at: "2026-01-05T10:00:00Z" });
    expect(icr([...buenas(8), vieja], HOY).muestra).toBe(8);
  });
  it("las abiertas no entran en la muestra de cerradas", () => {
    expect(icr([...buenas(8), card({ status: "pend", done_at: null })], HOY).muestra).toBe(8);
  });
});

describe("icr — lectura", () => {
  it("el texto recuerda que un ICR bajo invalida las métricas, no a la persona", () => {
    expect(icr(buenas(10), HOY).lectura).toContain("no a la persona");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node node_modules/vitest/vitest.mjs run src/lib/icr.test.ts`
Expected: FAIL — "Failed to resolve import ./icr"

- [ ] **Step 3: Implementar `src/lib/icr.ts`**

Requisitos exactos (de `docs/PROPUESTA-ICR.md` 3.2, con los pesos tal cual):

- `MUESTRA_MINIMA = 8`. Ventana: tareas con `done_at` dentro de los **30 días** previos a
  `hoyISO`. Se **excluyen** `card_type === "operativa"` (salvaguarda 5).
- **F1 Trazabilidad, peso 30:** proporción de cerradas con `proc_at` no nulo **y** anterior a
  `done_at`.
- **F2 Registro no colapsado, peso 25:** `1 −` proporción de cerradas donde
  `done_at − proc_at < 10 minutos` **Y** `done_at − created_at > 1 día`. Las dos condiciones
  juntas: sin la segunda, se castiga a quien hace tareas legítimamente cortas.
- **F3 Actualización oportuna, peso 20:** proporción de cerradas cuyo `done_at` cae dentro de
  **1 día** de la última señal real de trabajo (la última entrada de `history` por `at`; si no
  hay historial, se usa `proc_at`).
- **F4 Ausencia de huérfanas, peso 15:** `1 −` proporción de tareas **abiertas** con más de
  **10 días** sin ninguna entrada de historial. Si no hay abiertas, F4 = 1.
- **F5 Coherencia del cierre, peso 10:** proporción de cerradas **sin** reapertura. Detectar la
  reapertura buscando `TXT_REAPERTURA` de `src/lib/retrabajo.ts` en el `history` (importalo, no
  copies el literal: ese archivo advierte explícitamente que el texto debe venir de un solo lugar).
- `puntaje = Math.round(Σ(valor × peso))`, `null` si `!suficiente`.
- `lectura` (constante): `"Un ICR bajo invalida las métricas de ese conjunto, no a la persona."`
- Comentar en español por qué cada salvaguarda existe.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node node_modules/vitest/vitest.mjs run src/lib/icr.test.ts`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/icr.ts src/lib/icr.test.ts
git commit -m "feat: ICR — indice de calidad del registro (idea 47)"
```

---

## Task 2: ¿Qué pasa si no hago nada?

**Files:**
- Create: `src/lib/exposicion.ts`
- Test: `src/lib/exposicion.test.ts`

**Interfaces:**
- Consumes: `Card` de `src/lib/types.ts`.
- Produces:
  - `export interface Exposicion { horizonte: 1 | 3 | 7; titulo: string; total: number; porCategoria: { categoria: string; n: number }[] }`
  - `export function exposicion(cards: Card[], hoyISO: string): Exposicion[]`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { exposicion } from "./exposicion";
import type { Card } from "./types";

const HOY = "2026-07-10T12:00:00Z";

function card(over: Partial<Card> = {}): Card {
  return {
    id: Math.random().toString(36).slice(2), owner: "u1", title: "T", status: "pend",
    description: "", checklist: [], comments: [], history: [], done_at: null,
    due_date: "2026-07-11", recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-07-01T00:00:00Z",
    categoria: "IVA", ...over,
  };
}

describe("exposicion", () => {
  it("devuelve los tres horizontes: mañana, 3 días y 7 días", () => {
    expect(exposicion([], HOY).map((e) => e.horizonte)).toEqual([1, 3, 7]);
  });
  it("cuenta lo que vence dentro de cada horizonte", () => {
    const r = exposicion([
      card({ due_date: "2026-07-11" }),   // mañana
      card({ due_date: "2026-07-13" }),   // dentro de 3
      card({ due_date: "2026-07-16" }),   // dentro de 7
      card({ due_date: "2026-08-30" }),   // fuera
    ], HOY);
    expect(r.find((e) => e.horizonte === 1)!.total).toBe(1);
    expect(r.find((e) => e.horizonte === 3)!.total).toBe(2);  // acumulativo
    expect(r.find((e) => e.horizonte === 7)!.total).toBe(3);
  });
  it("lo YA vencido también está expuesto (sigue sin hacerse)", () => {
    expect(exposicion([card({ due_date: "2026-07-01" })], HOY).find((e) => e.horizonte === 1)!.total).toBe(1);
  });
  it("las terminadas NO están expuestas", () => {
    expect(exposicion([card({ status: "term", done_at: "x" })], HOY).find((e) => e.horizonte === 7)!.total).toBe(0);
  });
  it("agrupa por categoría, de mayor a menor", () => {
    const r = exposicion([
      card({ due_date: "2026-07-11", categoria: "Bancos" }),
      card({ due_date: "2026-07-11", categoria: "IVA" }),
      card({ due_date: "2026-07-11", categoria: "IVA" }),
    ], HOY);
    expect(r.find((e) => e.horizonte === 1)!.porCategoria).toEqual([
      { categoria: "IVA", n: 2 }, { categoria: "Bancos", n: 1 },
    ]);
  });
  it("las tareas sin categoría se agrupan como 'Sin categoría'", () => {
    const r = exposicion([card({ due_date: "2026-07-11", categoria: null })], HOY);
    expect(r.find((e) => e.horizonte === 1)!.porCategoria[0].categoria).toBe("Sin categoría");
  });
  it("las tareas sin vencimiento no exponen a nada", () => {
    expect(exposicion([card({ due_date: null })], HOY).every((e) => e.total === 0)).toBe(true);
  });
  it("los títulos son legibles", () => {
    const r = exposicion([], HOY);
    expect(r.find((e) => e.horizonte === 1)!.titulo).toBe("Mañana");
    expect(r.find((e) => e.horizonte === 3)!.titulo).toBe("En 3 días");
    expect(r.find((e) => e.horizonte === 7)!.titulo).toBe("En 7 días");
  });
  it("es defensiva ante entradas no-array", () => {
    expect(exposicion(null as unknown as Card[], HOY)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node node_modules/vitest/vitest.mjs run src/lib/exposicion.test.ts`
Expected: FAIL — "Failed to resolve import ./exposicion"

- [ ] **Step 3: Implementar `src/lib/exposicion.ts`**

Requisitos:
- Horizontes fijos `[1, 3, 7]` con títulos `"Mañana"`, `"En 3 días"`, `"En 7 días"`.
- **Acumulativo**: el de 3 incluye el de 1. Es lo que uno espera al leer "en 3 días".
- Cuenta tareas con `status !== "term"` y `due_date` no nulo cuya fecha sea `<= hoy + horizonte`
  (lo ya vencido entra: sigue sin hacerse).
- Comparación por **fecha calendario** (los primeros 10 caracteres del ISO), sin husos: mismo
  criterio que el resto del proyecto.
- `porCategoria` ordenado por `n` desc y, a igualdad, alfabético.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node node_modules/vitest/vitest.mjs run src/lib/exposicion.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/exposicion.ts src/lib/exposicion.test.ts
git commit -m "feat: exposicion — que vence si nadie hace nada (idea 45)"
```

---

## Task 3: Salud operativa (espera, edad, multitarea)

**Files:**
- Create: `src/lib/salud-operativa.ts`
- Test: `src/lib/salud-operativa.test.ts`

**Interfaces:**
- Consumes: `Card` de `src/lib/types.ts`.
- Produces:
  - `export interface SaludOperativa { esperaPromedioDias: number | null; edadPend: number | null; edadProc: number | null; multitarea: { owner: string; abiertas: number }[] }`
  - `export function saludOperativa(cards: Card[], hoyISO: string): SaludOperativa`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { saludOperativa } from "./salud-operativa";
import type { Card } from "./types";

const HOY = "2026-07-10T00:00:00Z";

function card(over: Partial<Card> = {}): Card {
  return {
    id: Math.random().toString(36).slice(2), owner: "u1", title: "T", status: "pend",
    description: "", checklist: [], comments: [], history: [], done_at: null, proc_at: null,
    due_date: null, recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-07-01T00:00:00Z", ...over,
  };
}

describe("saludOperativa — espera hasta comenzar", () => {
  it("mide de created_at a proc_at, no la duración del trabajo", () => {
    const r = saludOperativa([
      card({ created_at: "2026-07-01T00:00:00Z", proc_at: "2026-07-03T00:00:00Z" }),
      card({ created_at: "2026-07-01T00:00:00Z", proc_at: "2026-07-05T00:00:00Z" }),
    ], HOY);
    expect(r.esperaPromedioDias).toBe(3);
  });
  it("las que nunca arrancaron no promedian", () => {
    expect(saludOperativa([card({ proc_at: null })], HOY).esperaPromedioDias).toBeNull();
  });
});

describe("saludOperativa — edad por estado", () => {
  it("promedia los días desde created_at de las abiertas de cada columna", () => {
    const r = saludOperativa([
      card({ status: "pend", created_at: "2026-07-08T00:00:00Z" }),
      card({ status: "proc", created_at: "2026-07-05T00:00:00Z" }),
    ], HOY);
    expect(r.edadPend).toBe(2);
    expect(r.edadProc).toBe(5);
  });
  it("sin tareas en una columna, esa edad es null (no 0)", () => {
    const r = saludOperativa([card({ status: "pend" })], HOY);
    expect(r.edadProc).toBeNull();
  });
  it("las terminadas no tienen edad acumulada", () => {
    expect(saludOperativa([card({ status: "term", done_at: "x" })], HOY).edadPend).toBeNull();
  });
});

describe("saludOperativa — multitarea", () => {
  it("cuenta tareas abiertas por persona, de mayor a menor", () => {
    const r = saludOperativa([
      card({ owner: "a" }), card({ owner: "a" }), card({ owner: "b" }),
    ], HOY);
    expect(r.multitarea).toEqual([{ owner: "a", abiertas: 2 }, { owner: "b", abiertas: 1 }]);
  });
  it("no cuenta las terminadas", () => {
    expect(saludOperativa([card({ owner: "a", status: "term", done_at: "x" })], HOY).multitarea).toEqual([]);
  });
});

describe("saludOperativa — defensiva", () => {
  it("sin datos devuelve nulls sin explotar", () => {
    const r = saludOperativa([], HOY);
    expect(r).toEqual({ esperaPromedioDias: null, edadPend: null, edadProc: null, multitarea: [] });
  });
  it("tolera entradas no-array", () => {
    expect(saludOperativa(null as unknown as Card[], HOY).multitarea).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node node_modules/vitest/vitest.mjs run src/lib/salud-operativa.test.ts`
Expected: FAIL — "Failed to resolve import ./salud-operativa"

- [ ] **Step 3: Implementar `src/lib/salud-operativa.ts`**

Requisitos:
- Un día = `86400000` ms. Promedios redondeados a **1 decimal** con `Math.round(x * 10) / 10`.
- `esperaPromedioDias`: promedio de `proc_at − created_at` sobre las cards con ambos; `null` si
  ninguna.
- `edadPend` / `edadProc`: promedio de `hoy − created_at` de las abiertas de cada estado;
  `null` si no hay ninguna en ese estado (null ≠ 0: "no hay" no es "cero días").
- `multitarea`: cuenta `status !== "term"` por `owner`, ordenado desc y, a igualdad, por owner.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node node_modules/vitest/vitest.mjs run src/lib/salud-operativa.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/salud-operativa.ts src/lib/salud-operativa.test.ts
git commit -m "feat: salud operativa — espera, edad de tareas y multitarea"
```

---

## Task 4: Motor de recomendaciones

**Files:**
- Create: `src/lib/recomendaciones.ts`
- Test: `src/lib/recomendaciones.test.ts`

**Interfaces:**
- Consumes: `Exposicion` (Task 2), `SaludOperativa` (Task 3), `ResultadoICR` (Task 1),
  `Concentracion` de `src/lib/busfactor.ts`, `Previsibilidad` de `src/lib/previsibilidad.ts`,
  `FlujoPersona` de `src/lib/flujo-mensual.ts`.
- Produces:
  - `export type Prioridad = "alta" | "media" | "baja"`
  - `export interface Recomendacion { id: string; prioridad: Prioridad; texto: string; motivo: string }`
  - `export interface SenalesRecomendacion { icr: ResultadoICR; exposiciones: Exposicion[]; salud: SaludOperativa; concentraciones: Concentracion[]; previsibilidad: Previsibilidad; flujo: FlujoPersona[]; nombrePorId: Record<string, string> }`
  - `export function recomendaciones(s: SenalesRecomendacion): Recomendacion[]`
  - `export const ICR_MINIMO_PARA_RECOMENDAR = 50`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { recomendaciones, ICR_MINIMO_PARA_RECOMENDAR, type SenalesRecomendacion } from "./recomendaciones";
import type { ResultadoICR } from "./icr";

const icrOk: ResultadoICR = { puntaje: 90, muestra: 20, suficiente: true, factores: [], lectura: "" };

const BASE: SenalesRecomendacion = {
  icr: icrOk,
  exposiciones: [
    { horizonte: 1, titulo: "Mañana", total: 0, porCategoria: [] },
    { horizonte: 3, titulo: "En 3 días", total: 0, porCategoria: [] },
    { horizonte: 7, titulo: "En 7 días", total: 0, porCategoria: [] },
  ],
  salud: { esperaPromedioDias: 1, edadPend: 2, edadProc: 2, multitarea: [] },
  concentraciones: [],
  previsibilidad: { planificadas: 10, imprevistas: 1, total: 11, pctPlanificado: 91, alerta: false },
  flujo: [],
  nombrePorId: { u1: "Carolina", u2: "Patricia" },
};

describe("recomendaciones — el ICR manda", () => {
  it("con ICR bajo NO recomienda sobre el trabajo: recomienda arreglar el registro", () => {
    const r = recomendaciones({ ...BASE, icr: { ...icrOk, puntaje: ICR_MINIMO_PARA_RECOMENDAR - 1 },
      concentraciones: [{ categoria: "IVA", personas: 1, principal: "Carolina", pct: 95 }] });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("icr-bajo");
    expect(r[0].texto).toContain("registro");
  });
  it("con muestra insuficiente tampoco arriesga conclusiones", () => {
    const r = recomendaciones({ ...BASE, icr: { ...icrOk, puntaje: null, suficiente: false, muestra: 3 } });
    expect(r.every((x) => x.id === "muestra-chica")).toBe(true);
  });
  it("nunca culpa a una persona en el texto del ICR bajo", () => {
    const r = recomendaciones({ ...BASE, icr: { ...icrOk, puntaje: 20 } });
    expect(r[0].texto).not.toMatch(/culpa|responsable|descuid/i);
  });
});

describe("recomendaciones — reglas", () => {
  it("vencimientos inminentes generan una recomendación de prioridad alta", () => {
    const r = recomendaciones({ ...BASE, exposiciones: [
      { horizonte: 1, titulo: "Mañana", total: 4, porCategoria: [{ categoria: "IVA", n: 4 }] },
      { horizonte: 3, titulo: "En 3 días", total: 4, porCategoria: [] },
      { horizonte: 7, titulo: "En 7 días", total: 4, porCategoria: [] },
    ] });
    const x = r.find((y) => y.id === "vence-manana")!;
    expect(x.prioridad).toBe("alta");
    expect(x.texto).toContain("IVA");
  });
  it("la concentración de conocimiento propone formar un respaldo, no sacar trabajo", () => {
    const r = recomendaciones({ ...BASE, concentraciones: [{ categoria: "IVA", personas: 1, principal: "Carolina", pct: 82 }] });
    const x = r.find((y) => y.id.startsWith("concentracion"))!;
    expect(x.texto).toContain("IVA");
    expect(x.texto).toMatch(/respaldo|acompañ|formar/i);
    expect(x.texto).not.toMatch(/sacarle|quitarle/i);
  });
  it("demasiadas urgencias apuntan a la planificación, no a las personas", () => {
    const r = recomendaciones({ ...BASE, previsibilidad: { planificadas: 3, imprevistas: 9, total: 12, pctPlanificado: 25, alerta: true } });
    const x = r.find((y) => y.id === "previsibilidad")!;
    expect(x.texto).toMatch(/planific/i);
  });
  it("una carga muy concentrada al cierre sugiere adelantar trabajo", () => {
    const r = recomendaciones({ ...BASE, flujo: [
      { owner: "u1", dias: Array(31).fill(0).map((_, i) => (i > 24 ? 9 : 0)), total: 54, picoDia: 28, perfil: "tardio" },
    ] });
    const x = r.find((y) => y.id.startsWith("flujo-tardio"))!;
    expect(x.texto).toContain("Carolina");
    expect(x.texto).toMatch(/adelantar|primera/i);
  });
  it("mucha multitarea sugiere repartir, sin señalar a la persona", () => {
    const r = recomendaciones({ ...BASE, salud: { ...BASE.salud, multitarea: [{ owner: "u2", abiertas: 12 }] } });
    const x = r.find((y) => y.id.startsWith("multitarea"))!;
    expect(x.texto).toContain("Patricia");
    expect(x.texto).not.toMatch(/desorganiz|no puede|ineficaz/i);
  });
  it("todo en orden → sin recomendaciones (no inventa ruido)", () => {
    expect(recomendaciones(BASE)).toEqual([]);
  });
});

describe("recomendaciones — forma", () => {
  it("ordena por prioridad: alta primero", () => {
    const r = recomendaciones({ ...BASE,
      exposiciones: [
        { horizonte: 1, titulo: "Mañana", total: 3, porCategoria: [{ categoria: "IVA", n: 3 }] },
        { horizonte: 3, titulo: "En 3 días", total: 3, porCategoria: [] },
        { horizonte: 7, titulo: "En 7 días", total: 3, porCategoria: [] },
      ],
      previsibilidad: { planificadas: 3, imprevistas: 9, total: 12, pctPlanificado: 25, alerta: true },
    });
    expect(r[0].prioridad).toBe("alta");
  });
  it("cada recomendación explica en qué se basa", () => {
    const r = recomendaciones({ ...BASE, concentraciones: [{ categoria: "IVA", personas: 1, principal: "Carolina", pct: 82 }] });
    expect(r[0].motivo.length).toBeGreaterThan(0);
  });
  it("es defensiva ante señales incompletas", () => {
    expect(() => recomendaciones({} as SenalesRecomendacion)).not.toThrow();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node node_modules/vitest/vitest.mjs run src/lib/recomendaciones.test.ts`
Expected: FAIL — "Failed to resolve import ./recomendaciones"

- [ ] **Step 3: Implementar `src/lib/recomendaciones.ts`**

Requisitos:
- `ICR_MINIMO_PARA_RECOMENDAR = 50`. **Gate primero:** si `!suficiente`, devolver sólo la
  recomendación `"muestra-chica"`; si `puntaje < 50`, devolver **sólo** `"icr-bajo"` y nada
  más. Recomendar sobre datos que el propio sistema declara no representativos sería peor que
  no recomendar.
- Reglas (cada una devuelve 0 o 1 recomendación):
  - `vence-manana` (alta) si `exposiciones[h=1].total > 0` — menciona la categoría principal.
  - `concentracion-<categoria>` (media) por cada concentración — texto que propone **formar un
    respaldo / acompañar**, nunca sacarle trabajo a nadie.
  - `previsibilidad` (media) si `previsibilidad.alerta` — apunta al proceso de planificación.
  - `flujo-tardio-<owner>` (baja) por cada persona con `perfil === "tardio"` — sugiere
    adelantar parte del trabajo a la primera semana.
  - `multitarea-<owner>` (baja) si alguien tiene `abiertas >= 10` — sugiere repartir.
- Ordenar `alta` → `media` → `baja`, estable dentro de cada nivel.
- Los nombres salen de `nombrePorId`; si falta, usar `"—"` (nunca mostrar un uuid crudo).
- Comentar en español: **esto es un motor de REGLAS, no IA**, y por qué el ICR lo gatea.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node node_modules/vitest/vitest.mjs run src/lib/recomendaciones.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/recomendaciones.ts src/lib/recomendaciones.test.ts
git commit -m "feat: motor de recomendaciones gateado por el ICR (idea 48)"
```

---

## Task 5: Mostrarlo en el Director

**Files:**
- Modify: `src/features/director/Director.tsx`

**Interfaces:**
- Consumes: `icr()`, `exposicion()`, `saludOperativa()`, `recomendaciones()` de las tareas
  anteriores; `concentracion()` de `busfactor.ts` y `previsibilidad()` (ya usados en la vista);
  `flujoMensual()` de `flujo-mensual.ts` con `useSnapshots`.

- [ ] **Step 1: Agregar los tres bloques**

1. **Confianza del dato**: el puntaje ICR con su muestra, o `"Muestra insuficiente (n=X)"`.
   Debajo, en gris y siempre visible: `Un ICR bajo invalida las métricas de ese conjunto, no a
   la persona.`
2. **Si nadie hace nada**: los tres horizontes con su total y las 3 categorías principales.
3. **Recomendaciones**: lista de `recomendaciones()`; cada una con un punto de prioridad
   (`--danger` / `--warn` / `--ink2`), el texto y el motivo en gris. Si viene vacía:
   `Sin recomendaciones: no se detectaron situaciones que requieran acción.`

- [ ] **Step 2: Verificar tipos, tests y build**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run && node node_modules/vite/bin/vite.js build`
Expected: tsc exit 0, todo verde, build OK.

- [ ] **Step 3: Commit**

```bash
git add src/features/director/Director.tsx
git commit -m "feat: Director muestra confianza del dato, exposicion y recomendaciones"
```

---

## Verificación final

- tsc exit 0 · suite completa verde (860 actuales + ~47 nuevos) · build OK.
- Entrada en `src/lib/version.ts` antes de publicar a `main`.
- **Revisión visual del propietario:** el Director muestra el ICR con su muestra, los tres
  horizontes de exposición y las recomendaciones (o el vacío explicado).
