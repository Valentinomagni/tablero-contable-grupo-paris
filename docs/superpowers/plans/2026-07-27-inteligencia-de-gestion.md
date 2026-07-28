# Inteligencia de gestión — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el jefe entienda la situación del área en una pantalla, y que el trabajo de
cada persona se vea *distribuido en el tiempo*, no reducido a un porcentaje.

**Architecture:** Todo lo nuevo son **funciones puras** sobre datos que la app YA trae
(`daily_snapshots`, `cards`, `cards_archive`, `activity_log`) + vistas que las consumen. Sin
migraciones nuevas, sin tracking nuevo, sin dependencias nuevas. El "Modo Director" es
sobre todo **composición de señales que ya existen** (alertas, radar fiscal, bus factor,
utilización, cierre en riesgo), no lógica nueva.

**Tech Stack:** TypeScript, React 19, TanStack Query 5, vitest. Sin librerías nuevas: los
gráficos se dibujan con SVG propio, como los que ya hay en `src/components/charts.tsx`.

## Global Constraints

- **Encuadre no punitivo (regla dura del proyecto).** Toda métrica sobre personas describe
  *la situación o el proceso*, nunca califica a la persona. Nada de "rendimiento bajo",
  "saturado al 120%" ni rankings de gente con semáforo rojo. Se habla de *carga*,
  *distribución* y *redistribución posible*.
- **Cero emojis** en la UI (solo íconos Lucide). Monocromo negro/blanco; **el color sólo
  comunica estado** (verde/ámbar/rojo), nunca decora. Los mapas de calor van en **escala de
  grises**, porque intensidad no es estado.
- **Sin dependencias nuevas** y **sin migraciones nuevas** en este plan.
- Funciones puras: **sin `new Date()` adentro** — la fecha entra por parámetro, para que los
  tests sean estables (mismo criterio que `comparador.ts` y `evolucion.ts`).
- Defensivo: si faltan datos (`daily_snapshots` vacío, mes sin actividad), la vista muestra
  un vacío explicado, nunca un cero engañoso ni un crash.

---

## 0. Análisis del estado actual (por qué este plan y no otro)

Se auditaron las 41 ideas de la lista contra el código existente. **Más de la mitad ya está
implementada.** Construirlas de nuevo sería trabajo tirado, así que quedan afuera:

| Idea de la lista | Ya resuelto por | Dónde se ve |
|---|---|---|
| 5 Cuello de botella · 6 Riesgo de dependencia · 14 Sobreespecialización | `busfactor.ts` (concentración por categoría) | Reporte |
| 6 Saturación · 7 Capacidad libre · 11 Densidad de trabajo | `ociosidad.ts` (utilización por persona) | Reporte |
| 8 Dependencias bloqueadas | `deps.ts` + `delegaciones.ts` (+ chip "Bloqueada") | Tablero / Resumen |
| 10 Costo oculto (rehacer tareas) | `retrabajo.ts` (índice de reaperturas) | Análisis mensual |
| 3 Predicción del cierre | `cierre.ts` — "cierre en riesgo" ya proyecta si no se llega | Cierre |
| 15 Evolución del proceso | `evolucion.ts` (curva individual) | Organigrama |
| 15/16 Balance por marca y sucursal | `comparador.ts` (comparativa mensual) | Reporte |
| 9 Tiempo esperando (parcial) | `tiempos.ts` (SLA desde `proc_at`) | Tarea / Reporte |
| 17 Radar (parcial) | `radar.ts` — pero es de **vencimientos fiscales**, no el radar general | Reporte |
| 18 Madurez del equipo · 19 Auditoría de hábitos | **Ya analizado** en `docs/PROPUESTA-ICR.md` — quedó esperando tu decisión | (gate abierto) |

**Lo que NO existe y aporta de verdad** — esto es lo que construye este plan:

| # | Idea | Por qué entra |
|---|---|---|
| 1 | **Flujo mensual por persona** ⭐ | Hoy el mes es UN porcentaje agregado. No se ve *cuándo* trabaja cada uno. Es tu idea estrella y los datos ya están (`daily_snapshots`). |
| 2 | **Mapa de calor del mes** | Mismo dato que #1, otra lectura: qué días revienta el área. Sale casi gratis una vez hecho #1. |
| 17+19 | **Modo Director** ⭐ | Todas las señales existen pero están repartidas en 6 pantallas. Juntarlas en una es alto valor y poca lógica nueva. |
| 4 | **Índice de estabilidad** | `evolucion.ts` da la curva pero no cuánto *varía*. Un 95-94-96 y un 100-30-98 hoy se ven igual de promedio. |
| 13 | **Índice de previsibilidad** | Separa trabajo planificado de urgencias. Mide a la ORGANIZACIÓN, no a la persona — que es exactamente el encuadre que queremos. |

**Descartadas a propósito** (con motivo, no por olvido):
- **21 Simulador de carga:** para simular hay que modelar capacidad por persona en horas, y
  hoy no existe ese dato. Sin él, el simulador daría números inventados con cara de
  precisos. Requiere decidir antes cómo se mide la capacidad.
- **5 "¿Qué pasa si...?" (vacaciones):** mismo problema, y además `vacaciones.ts` ya cubre
  el traspaso al reemplazante, que es la parte accionable.
- **22 Kaizen / 18 Madurez:** dependen del gate abierto del ICR. Si aprobás
  `docs/PROPUESTA-ICR.md`, salen casi solos después.
- **10 Tiempo administrativo / 11 Tiempo muerto:** requieren registro de tiempo que el
  propio `PROPUESTA-ICR.md` desaconseja (el cronómetro). No se reabre acá.

> **Nota de orden, importante.** Antes de este plan hay dos cosas pendientes que lo
> condicionan: las **migraciones 32 y 33** (sin ellas no se ven períodos ni consultas) y las
> **fases 2b/3/4 de períodos**. Este plan NO depende de ellas para funcionar, pero conviene
> verificar lo ya entregado antes de sumar superficie nueva.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/flujo-mensual.ts` (nuevo) | **Puro.** Distribución de carga por día del mes y por persona; perfil (temprano/tardío/uniforme); niveles del mapa de calor. |
| `src/lib/flujo-mensual.test.ts` (nuevo) | Tests de lo anterior. |
| `src/lib/estabilidad.ts` (nuevo) | **Puro.** Variabilidad de una serie mensual (coeficiente de variación) + etiqueta legible. |
| `src/lib/estabilidad.test.ts` (nuevo) | Tests. |
| `src/lib/previsibilidad.ts` (nuevo) | **Puro.** Planificado vs. imprevisto sobre las cards de un mes. |
| `src/lib/previsibilidad.test.ts` (nuevo) | Tests. |
| `src/lib/director.ts` (nuevo) | **Puro.** Compone las señales existentes en un tablero de estado (semáforo + titular por área). |
| `src/lib/director.test.ts` (nuevo) | Tests. |
| `src/features/reporte/FlujoMensual.tsx` (nuevo) | Vista del flujo + mapa de calor. SVG propio, escala de grises. |
| `src/features/director/Director.tsx` (nuevo) | Pantalla "Modo Director". |
| `src/features/reporte/Reporte.tsx` (modificar) | Monta `<FlujoMensual>`. |
| `src/App.tsx` (modificar) | Ruta `__director` + entrada de menú, sólo para gestores. |

---

## Task 1: Flujo mensual por persona (lógica pura)

**Files:**
- Create: `src/lib/flujo-mensual.ts`
- Test: `src/lib/flujo-mensual.test.ts`

**Interfaces:**
- Consumes: `Snapshot` de `src/lib/types.ts` — `{ day: string; owner: string; open_count: number; open_effort: number; done_count: number; done_effort: number; activity_qty: number }`.
- Produces:
  - `export type PerfilCarga = "temprano" | "tardio" | "uniforme" | "sin-datos"`
  - `export interface FlujoPersona { owner: string; dias: number[]; total: number; picoDia: number; perfil: PerfilCarga }`
  - `export function flujoMensual(snaps: Snapshot[], mes: string): FlujoPersona[]`
  - `export function perfilDe(dias: number[]): PerfilCarga`
  - `export function nivelCarga(valor: number, max: number): 0 | 1 | 2 | 3 | 4`
  - `export function TEXTO_PERFIL: Record<PerfilCarga, string>`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { flujoMensual, perfilDe, nivelCarga, TEXTO_PERFIL } from "./flujo-mensual";
import type { Snapshot } from "./types";

function snap(day: string, owner: string, done_count: number): Snapshot {
  return { day, owner, open_count: 0, open_effort: 0, done_count, done_effort: 0, activity_qty: 0 };
}

describe("perfilDe", () => {
  it("carga concentrada en la primera mitad → temprano", () => {
    const dias = Array(31).fill(0); dias[2] = 5; dias[6] = 8; dias[10] = 4;
    expect(perfilDe(dias)).toBe("temprano");
  });
  it("carga concentrada al cierre → tardio", () => {
    const dias = Array(31).fill(0); dias[24] = 9; dias[27] = 7; dias[29] = 6;
    expect(perfilDe(dias)).toBe("tardio");
  });
  it("carga repartida → uniforme", () => {
    const dias = Array(31).fill(2);
    expect(perfilDe(dias)).toBe("uniforme");
  });
  it("sin carga → sin-datos (no inventa un perfil)", () => {
    expect(perfilDe(Array(31).fill(0))).toBe("sin-datos");
  });
});

describe("flujoMensual", () => {
  const SNAPS = [
    snap("2026-07-03", "u1", 4), snap("2026-07-05", "u1", 6),
    snap("2026-07-28", "u2", 9),
    snap("2026-06-10", "u1", 99),   // otro mes: no debe contar
  ];

  it("agrupa por persona y sólo toma el mes pedido", () => {
    const r = flujoMensual(SNAPS, "2026-07");
    expect(r.map((f) => f.owner).sort()).toEqual(["u1", "u2"]);
    expect(r.find((f) => f.owner === "u1")!.total).toBe(10);
  });
  it("ubica cada día en su posición (1 = índice 0)", () => {
    const u1 = flujoMensual(SNAPS, "2026-07").find((f) => f.owner === "u1")!;
    expect(u1.dias[2]).toBe(4);   // día 3
    expect(u1.dias[4]).toBe(6);   // día 5
    expect(u1.dias[0]).toBe(0);
  });
  it("marca el día de mayor carga", () => {
    const u1 = flujoMensual(SNAPS, "2026-07").find((f) => f.owner === "u1")!;
    expect(u1.picoDia).toBe(5);
  });
  it("clasifica el perfil de cada persona", () => {
    const r = flujoMensual(SNAPS, "2026-07");
    expect(r.find((f) => f.owner === "u1")!.perfil).toBe("temprano");
    expect(r.find((f) => f.owner === "u2")!.perfil).toBe("tardio");
  });
  it("ordena de mayor a menor carga total", () => {
    const r = flujoMensual([snap("2026-07-02","a",1), snap("2026-07-02","b",50)], "2026-07");
    expect(r[0].owner).toBe("b");
  });
  it("sin snapshots devuelve lista vacía, no explota", () => {
    expect(flujoMensual([], "2026-07")).toEqual([]);
    expect(flujoMensual(null as unknown as Snapshot[], "2026-07")).toEqual([]);
  });
  it("ignora filas con fecha inválida", () => {
    expect(flujoMensual([snap("basura", "u1", 5)], "2026-07")).toEqual([]);
  });
});

describe("nivelCarga", () => {
  it("0 cuando no hubo nada", () => {
    expect(nivelCarga(0, 10)).toBe(0);
  });
  it("escala en 4 niveles hasta el máximo", () => {
    expect(nivelCarga(10, 10)).toBe(4);
    expect(nivelCarga(1, 10)).toBe(1);
  });
  it("máximo 0 no divide por cero", () => {
    expect(nivelCarga(0, 0)).toBe(0);
  });
});

describe("TEXTO_PERFIL", () => {
  it("describe la situación, sin calificar a la persona", () => {
    expect(TEXTO_PERFIL.temprano).toBe("Mayor carga al principio del mes");
    expect(TEXTO_PERFIL.tardio).toBe("Mayor carga hacia el cierre");
    expect(TEXTO_PERFIL.uniforme).toBe("Carga repartida en el mes");
    expect(TEXTO_PERFIL["sin-datos"]).toBe("Sin actividad registrada");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node node_modules/vitest/vitest.mjs run src/lib/flujo-mensual.test.ts`
Expected: FAIL — "Failed to resolve import ./flujo-mensual"

- [ ] **Step 3: Implementar `src/lib/flujo-mensual.ts`**

```ts
import type { Snapshot } from "./types";

// Flujo de trabajo dentro del mes, por persona. Hoy el mes se resume en UN porcentaje
// agregado y no se ve CUÁNDO trabaja cada quien. Esto lo abre por día.
//
// ENCUADRE (regla dura del proyecto): describe la DISTRIBUCIÓN de la carga, no evalúa a
// nadie. "Mayor carga hacia el cierre" es un dato del proceso —sirve para repartir mejor—,
// no un juicio sobre la persona. Por eso no hay etiquetas de bueno/malo ni semáforo acá.
//
// PURA: la fecha entra por `mes`; sin `new Date()` adentro (tests estables).

export type PerfilCarga = "temprano" | "tardio" | "uniforme" | "sin-datos";

export const TEXTO_PERFIL: Record<PerfilCarga, string> = {
  temprano: "Mayor carga al principio del mes",
  tardio: "Mayor carga hacia el cierre",
  uniforme: "Carga repartida en el mes",
  "sin-datos": "Sin actividad registrada",
};

export interface FlujoPersona {
  owner: string;
  /** 31 posiciones: índice 0 = día 1. */
  dias: number[];
  total: number;
  /** Día (1..31) de mayor carga; 0 si no hubo. */
  picoDia: number;
  perfil: PerfilCarga;
}

// Umbral para decir que la carga se cargó de un lado. 60% es deliberadamente conservador:
// con 50% cualquier ruido daría "temprano" o "tardío" y el dato perdería sentido.
const SESGO = 0.6;

export function perfilDe(dias: number[]): PerfilCarga {
  const total = (dias ?? []).reduce((s, v) => s + v, 0);
  if (total <= 0) return "sin-datos";
  const mitad = Math.ceil(dias.length / 2);
  const primera = dias.slice(0, mitad).reduce((s, v) => s + v, 0);
  if (primera / total >= SESGO) return "temprano";
  if ((total - primera) / total >= SESGO) return "tardio";
  return "uniforme";
}

export function flujoMensual(snaps: Snapshot[], mes: string): FlujoPersona[] {
  if (!Array.isArray(snaps)) return [];
  const porOwner = new Map<string, number[]>();
  for (const s of snaps) {
    if (!s?.day || !s.owner || !s.day.startsWith(mes)) continue;
    const dia = Number(s.day.slice(8, 10));
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) continue;
    if (!porOwner.has(s.owner)) porOwner.set(s.owner, Array(31).fill(0));
    porOwner.get(s.owner)![dia - 1] += s.done_count ?? 0;
  }
  return [...porOwner.entries()]
    .map(([owner, dias]) => {
      const total = dias.reduce((s, v) => s + v, 0);
      let picoDia = 0, max = 0;
      dias.forEach((v, i) => { if (v > max) { max = v; picoDia = i + 1; } });
      return { owner, dias, total, picoDia, perfil: perfilDe(dias) };
    })
    .sort((a, b) => b.total - a.total);
}

/**
 * Nivel de intensidad 0..4 para el mapa de calor. Se pinta en ESCALA DE GRISES: la
 * intensidad no es un estado, y en este proyecto el color sólo comunica estado.
 */
export function nivelCarga(valor: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!(valor > 0) || !(max > 0)) return 0;
  const n = Math.ceil((valor / max) * 4);
  return Math.min(4, Math.max(1, n)) as 1 | 2 | 3 | 4;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node node_modules/vitest/vitest.mjs run src/lib/flujo-mensual.test.ts`
Expected: PASS (15 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/flujo-mensual.ts src/lib/flujo-mensual.test.ts
git commit -m "feat: flujo de carga por dia del mes y por persona (logica pura)"
```

---

## Task 2: Índice de estabilidad

**Files:**
- Create: `src/lib/estabilidad.ts`
- Test: `src/lib/estabilidad.test.ts`

**Interfaces:**
- Produces:
  - `export type NivelEstabilidad = "muy-estable" | "estable" | "variable" | "muy-variable" | "sin-datos"`
  - `export interface Estabilidad { cv: number; nivel: NivelEstabilidad; texto: string }`
  - `export function estabilidad(valores: number[]): Estabilidad`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { estabilidad } from "./estabilidad";

describe("estabilidad", () => {
  it("una serie casi idéntica es muy estable", () => {
    const r = estabilidad([95, 94, 96, 95, 95]);
    expect(r.nivel).toBe("muy-estable");
    expect(r.cv).toBeLessThan(0.05);
  });
  it("una serie que salta es muy variable", () => {
    expect(estabilidad([100, 30, 98, 20, 100]).nivel).toBe("muy-variable");
  });
  it("dos series con el MISMO promedio se distinguen por su variación", () => {
    const a = estabilidad([60, 60, 60]);
    const b = estabilidad([10, 60, 110]);
    expect(a.nivel).toBe("muy-estable");
    expect(b.nivel).toBe("muy-variable");
  });
  it("menos de 3 datos no alcanza para hablar de estabilidad", () => {
    expect(estabilidad([50, 90]).nivel).toBe("sin-datos");
    expect(estabilidad([]).nivel).toBe("sin-datos");
  });
  it("promedio 0 no divide por cero", () => {
    expect(estabilidad([0, 0, 0]).nivel).toBe("sin-datos");
  });
  it("es defensiva ante entradas no-array", () => {
    expect(estabilidad(null as unknown as number[]).nivel).toBe("sin-datos");
  });
  it("el texto describe el proceso, no a la persona", () => {
    expect(estabilidad([95, 94, 96]).texto).toBe("Resultados parejos mes a mes");
    expect(estabilidad([100, 20, 100]).texto).toBe("Resultados muy dispares entre meses");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node node_modules/vitest/vitest.mjs run src/lib/estabilidad.test.ts`
Expected: FAIL — "Failed to resolve import ./estabilidad"

- [ ] **Step 3: Implementar `src/lib/estabilidad.ts`**

```ts
// Estabilidad de una serie mensual: no CUÁNTO se produce, sino cuánto VARÍA.
// `evolucion.ts` ya da la curva; esto responde otra pregunta: 95-94-96 y 100-30-98 tienen
// promedios parecidos y significan cosas muy distintas.
//
// ENCUADRE: mide la regularidad del PROCESO. Un resultado disparejo suele hablar de carga
// mal repartida o de urgencias que entran de golpe —no de la persona—, así que los textos
// describen la serie y nunca califican a nadie.
//
// Se usa el coeficiente de variación (desvío estándar / promedio): es adimensional, así que
// permite comparar series de magnitudes distintas.

export type NivelEstabilidad = "muy-estable" | "estable" | "variable" | "muy-variable" | "sin-datos";

export interface Estabilidad { cv: number; nivel: NivelEstabilidad; texto: string }

const TEXTO: Record<NivelEstabilidad, string> = {
  "muy-estable": "Resultados parejos mes a mes",
  estable: "Resultados bastante parejos",
  variable: "Resultados con altibajos",
  "muy-variable": "Resultados muy dispares entre meses",
  "sin-datos": "Faltan meses para poder compararlo",
};

/** Con menos de 3 meses cualquier conclusión sería ruido. */
const MINIMO_MESES = 3;

export function estabilidad(valores: number[]): Estabilidad {
  const v = Array.isArray(valores) ? valores.filter((n) => typeof n === "number" && isFinite(n)) : [];
  if (v.length < MINIMO_MESES) return { cv: 0, nivel: "sin-datos", texto: TEXTO["sin-datos"] };
  const media = v.reduce((s, n) => s + n, 0) / v.length;
  if (media <= 0) return { cv: 0, nivel: "sin-datos", texto: TEXTO["sin-datos"] };
  const varianza = v.reduce((s, n) => s + (n - media) ** 2, 0) / v.length;
  const cv = Math.sqrt(varianza) / media;
  const nivel: NivelEstabilidad =
    cv < 0.05 ? "muy-estable" : cv < 0.15 ? "estable" : cv < 0.35 ? "variable" : "muy-variable";
  return { cv, nivel, texto: TEXTO[nivel] };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node node_modules/vitest/vitest.mjs run src/lib/estabilidad.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/estabilidad.ts src/lib/estabilidad.test.ts
git commit -m "feat: indice de estabilidad de una serie mensual"
```

---

## Task 3: Índice de previsibilidad

**Files:**
- Create: `src/lib/previsibilidad.ts`
- Test: `src/lib/previsibilidad.test.ts`

**Interfaces:**
- Consumes: `Card` de `src/lib/types.ts` (usa `created_at`, `due_date`, `card_type`).
- Produces:
  - `export interface Previsibilidad { planificadas: number; imprevistas: number; total: number; pctPlanificado: number; alerta: boolean }`
  - `export function previsibilidad(cards: Card[], mes: string): Previsibilidad`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { previsibilidad } from "./previsibilidad";
import type { Card } from "./types";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "T", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: "2026-07-20",
    recurring: false, priority: "media", effort: 2, card_type: "normal", deps: [],
    created_at: "2026-06-15T00:00:00Z", ...over,
  };
}

describe("previsibilidad", () => {
  it("creada ANTES del mes que vence → planificada", () => {
    const r = previsibilidad([card({ created_at: "2026-06-15T00:00:00Z", due_date: "2026-07-20" })], "2026-07");
    expect(r.planificadas).toBe(1);
    expect(r.imprevistas).toBe(0);
  });
  it("creada DENTRO del mes que vence → imprevista", () => {
    const r = previsibilidad([card({ created_at: "2026-07-18T00:00:00Z", due_date: "2026-07-20" })], "2026-07");
    expect(r.imprevistas).toBe(1);
  });
  it("calcula el porcentaje planificado", () => {
    const r = previsibilidad([
      card({ created_at: "2026-06-01T00:00:00Z" }),
      card({ created_at: "2026-06-01T00:00:00Z" }),
      card({ created_at: "2026-07-10T00:00:00Z" }),
      card({ created_at: "2026-07-10T00:00:00Z" }),
    ], "2026-07");
    expect(r.total).toBe(4);
    expect(r.pctPlanificado).toBe(50);
  });
  it("avisa cuando las urgencias superan a lo planificado", () => {
    const r = previsibilidad([
      card({ created_at: "2026-07-10T00:00:00Z" }),
      card({ created_at: "2026-07-11T00:00:00Z" }),
      card({ created_at: "2026-06-01T00:00:00Z" }),
    ], "2026-07");
    expect(r.alerta).toBe(true);
  });
  it("no avisa cuando la mayoría estaba planificada", () => {
    const r = previsibilidad([
      card({ created_at: "2026-06-01T00:00:00Z" }),
      card({ created_at: "2026-06-02T00:00:00Z" }),
      card({ created_at: "2026-07-10T00:00:00Z" }),
    ], "2026-07");
    expect(r.alerta).toBe(false);
  });
  it("ignora las tareas sin vencimiento (no se pueden planificar)", () => {
    expect(previsibilidad([card({ due_date: null })], "2026-07").total).toBe(0);
  });
  it("ignora las operativas (son a demanda por definición)", () => {
    expect(previsibilidad([card({ card_type: "operativa" })], "2026-07").total).toBe(0);
  });
  it("sin datos devuelve ceros sin dividir por cero", () => {
    const r = previsibilidad([], "2026-07");
    expect(r).toEqual({ planificadas: 0, imprevistas: 0, total: 0, pctPlanificado: 0, alerta: false });
  });
  it("es defensiva ante entradas no-array", () => {
    expect(previsibilidad(null as unknown as Card[], "2026-07").total).toBe(0);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node node_modules/vitest/vitest.mjs run src/lib/previsibilidad.test.ts`
Expected: FAIL — "Failed to resolve import ./previsibilidad"

- [ ] **Step 3: Implementar `src/lib/previsibilidad.ts`**

```ts
import type { Card } from "./types";

// Previsibilidad: cuánto del trabajo del mes estaba previsto y cuánto entró de golpe.
//
// POR QUÉ IMPORTA EL ENCUADRE: esta métrica mide a la ORGANIZACIÓN, no a las personas. Si un
// mes el 60% entra como urgencia, el problema es de planificación del área —no de quien la
// ejecutó—. Es de las pocas métricas que apunta hacia arriba, y por eso vale la pena.
//
// HEURÍSTICA (explícita, para no confundirla con una verdad): se considera PLANIFICADA la
// tarea creada ANTES del mes en que vence, e IMPREVISTA la creada dentro de ese mismo mes.
// No es perfecta —alguien puede cargar tarde una tarea que sabía—, pero no requiere que
// nadie complete un campo nuevo, y por eso no se degrada con el uso.
//
// PURA: el mes entra por parámetro.

export interface Previsibilidad {
  planificadas: number;
  imprevistas: number;
  total: number;
  pctPlanificado: number;
  /** true cuando las urgencias superan a lo planificado: señal para revisar el proceso. */
  alerta: boolean;
}

const VACIO: Previsibilidad = { planificadas: 0, imprevistas: 0, total: 0, pctPlanificado: 0, alerta: false };

export function previsibilidad(cards: Card[], mes: string): Previsibilidad {
  if (!Array.isArray(cards)) return { ...VACIO };
  let planificadas = 0, imprevistas = 0;
  for (const c of cards) {
    // Sin vencimiento no hay nada que planificar; las operativas son a demanda por diseño.
    if (!c?.due_date || c.card_type === "operativa") continue;
    if (!c.due_date.startsWith(mes)) continue;
    const creadaEn = (c.created_at ?? "").slice(0, 7);
    if (!creadaEn) continue;
    if (creadaEn < mes) planificadas++; else imprevistas++;
  }
  const total = planificadas + imprevistas;
  if (total === 0) return { ...VACIO };
  return {
    planificadas, imprevistas, total,
    pctPlanificado: Math.round((planificadas / total) * 100),
    alerta: imprevistas > planificadas,
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node node_modules/vitest/vitest.mjs run src/lib/previsibilidad.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/previsibilidad.ts src/lib/previsibilidad.test.ts
git commit -m "feat: indice de previsibilidad (planificado vs urgencias)"
```

---

## Task 4: Vista del flujo mensual + mapa de calor

**Files:**
- Create: `src/features/reporte/FlujoMensual.tsx`
- Modify: `src/features/reporte/Reporte.tsx` (montar la vista al final, antes de `<Comparador>`)

**Interfaces:**
- Consumes: `flujoMensual(snaps, mes)`, `nivelCarga(valor, max)`, `TEXTO_PERFIL`, tipo
  `FlujoPersona` — todos de `src/lib/flujo-mensual.ts` (Task 1). `useSnapshots(true)` de
  `src/hooks/useData.ts` (ya existe y ya se usa en `Reporte.tsx:69`).

- [ ] **Step 1: Crear el componente**

Requisitos concretos:
- Recibe `{ team: Profile[]; mes: string }`.
- Lee `useSnapshots(true).data ?? []` y llama `flujoMensual(snaps, mes)`.
- Para cada persona dibuja **una barra de 31 celdas** (`div` con `grid-template-columns:
  repeat(31, 1fr)`), en **escala de grises**: `nivelCarga` 0..4 mapea a
  `["transparent", "var(--chip)", "#a1a1aa", "#71717a", "#3f3f46"]`.
- Al lado, el nombre y el `TEXTO_PERFIL[perfil]` en texto chico gris.
- Muestra la escala de días (1, 10, 20, 31) una sola vez arriba.
- Si `flujoMensual` devuelve `[]`: `<EmptyState title="Todavía no hay actividad diaria registrada en este mes." />`.
- Cada celda lleva `title={`Día ${i+1}: ${valor} tareas`}` para que se pueda inspeccionar.
- Nombre de la persona resuelto con `team.find(u => u.id === owner)?.name ?? "—"`.
- **Sin emojis.** Encabezado: `Flujo de trabajo en el mes`, y una bajada que explique el
  encuadre: `Muestra cuándo se concentra el trabajo de cada persona, para repartir mejor la carga.`

- [ ] **Step 2: Montarlo en el Reporte**

En `src/features/reporte/Reporte.tsx`, importar y montar antes de `<Comparador />`:

```tsx
<FlujoMensual team={teamSeg} mes={mesActualPrefix()} />
```

- [ ] **Step 3: Verificar tipos, tests y build**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run && node node_modules/vite/bin/vite.js build`
Expected: tsc exit 0, todos los tests en verde, build OK.

- [ ] **Step 4: Commit**

```bash
git add src/features/reporte/FlujoMensual.tsx src/features/reporte/Reporte.tsx
git commit -m "feat: vista de flujo mensual por persona con mapa de calor"
```

---

## Task 5: Modo Director (composición de señales)

**Files:**
- Create: `src/lib/director.ts`
- Test: `src/lib/director.test.ts`
- Create: `src/features/director/Director.tsx`
- Modify: `src/App.tsx` (ruta `__director`, sólo `esGestor`)

**Interfaces:**
- Consumes: `previsibilidad()` (Task 3).
- Produces:
  - `export type Semaforo = "ok" | "atencion" | "riesgo"`
  - `export interface PanelDirector { area: string; semaforo: Semaforo; titular: string; detalle: string }`
  - `export function panelesDirector(e: EntradaDirector): PanelDirector[]`
  - `export interface EntradaDirector { vencidas: number; bloqueadas: number; venceEnDias: number | null; concentracion: number; pctPlanificado: number }`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { panelesDirector, type EntradaDirector } from "./director";

const BASE: EntradaDirector = { vencidas: 0, bloqueadas: 0, venceEnDias: null, concentracion: 0, pctPlanificado: 100 };
const areaDe = (e: EntradaDirector, area: string) => panelesDirector(e).find((p) => p.area === area)!;

describe("panelesDirector", () => {
  it("todo en orden → los cinco paneles en verde", () => {
    const ps = panelesDirector(BASE);
    expect(ps).toHaveLength(5);
    expect(ps.every((p) => p.semaforo === "ok")).toBe(true);
  });
  it("tareas vencidas ponen Riesgos en rojo", () => {
    expect(areaDe({ ...BASE, vencidas: 3 }, "Riesgos").semaforo).toBe("riesgo");
  });
  it("pocas bloqueadas es atención; muchas es riesgo", () => {
    expect(areaDe({ ...BASE, bloqueadas: 2 }, "Dependencias").semaforo).toBe("atencion");
    expect(areaDe({ ...BASE, bloqueadas: 8 }, "Dependencias").semaforo).toBe("riesgo");
  });
  it("un vencimiento muy cerca pone el Calendario en rojo", () => {
    expect(areaDe({ ...BASE, venceEnDias: 1 }, "Calendario").semaforo).toBe("riesgo");
    expect(areaDe({ ...BASE, venceEnDias: 12 }, "Calendario").semaforo).toBe("ok");
  });
  it("mucha concentración de conocimiento es riesgo de continuidad", () => {
    expect(areaDe({ ...BASE, concentracion: 3 }, "Continuidad").semaforo).toBe("riesgo");
  });
  it("demasiadas urgencias marcan la planificación", () => {
    expect(areaDe({ ...BASE, pctPlanificado: 30 }, "Planificación").semaforo).toBe("riesgo");
  });
  it("los titulares describen la situación, sin nombrar ni juzgar personas", () => {
    const p = areaDe({ ...BASE, bloqueadas: 8 }, "Dependencias");
    expect(p.titular).toBe("8 tareas detenidas");
    expect(p.titular).not.toMatch(/culpa|responsable de|por causa/i);
  });
  it("es defensivo ante una entrada incompleta", () => {
    expect(panelesDirector({} as EntradaDirector)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node node_modules/vitest/vitest.mjs run src/lib/director.test.ts`
Expected: FAIL — "Failed to resolve import ./director"

- [ ] **Step 3: Implementar `src/lib/director.ts`**

```ts
// Modo Director: el estado del área en una sola pantalla.
//
// POR QUÉ EXISTE: las señales ya están todas en el sistema (vencidas, bloqueadas, radar
// fiscal, bus factor, previsibilidad), pero repartidas en seis pantallas. Un director no va a
// recorrerlas: quiere saber si hay que preocuparse por algo, y recién ahí entrar.
//
// ESTA FUNCIÓN NO CALCULA NADA NUEVO: recibe números ya calculados por las libs existentes y
// sólo decide semáforo y titular. Así el criterio de "cuándo es rojo" vive en UN lugar
// testeable, en vez de repetido en el JSX.
//
// ENCUADRE: los titulares hablan de TAREAS y del PROCESO. Nunca nombran a una persona ni
// atribuyen culpa — mismo criterio que busfactor.ts y delegaciones.ts.

export type Semaforo = "ok" | "atencion" | "riesgo";

export interface PanelDirector { area: string; semaforo: Semaforo; titular: string; detalle: string }

export interface EntradaDirector {
  /** Tareas abiertas cuyo vencimiento ya pasó. */
  vencidas: number;
  /** Tareas que no pueden avanzar porque esperan a otra. */
  bloqueadas: number;
  /** Días hasta el próximo vencimiento fiscal; null si no hay ninguno a la vista. */
  venceEnDias: number | null;
  /** Categorías que hoy dependen de una sola persona (bus factor). */
  concentracion: number;
  /** % del trabajo del mes que estaba planificado (ver previsibilidad.ts). */
  pctPlanificado: number;
}

const n = (v: unknown, def = 0) => (typeof v === "number" && isFinite(v) ? v : def);

export function panelesDirector(e: EntradaDirector): PanelDirector[] {
  const vencidas = n(e?.vencidas);
  const bloqueadas = n(e?.bloqueadas);
  const concentracion = n(e?.concentracion);
  const pctPlanificado = n(e?.pctPlanificado, 100);
  const venceEnDias = typeof e?.venceEnDias === "number" ? e.venceEnDias : null;

  return [
    {
      area: "Riesgos",
      semaforo: vencidas > 0 ? "riesgo" : "ok",
      titular: vencidas > 0 ? `${vencidas} ${vencidas === 1 ? "tarea vencida" : "tareas vencidas"}` : "Sin tareas vencidas",
      detalle: "Tareas abiertas cuya fecha de entrega ya pasó.",
    },
    {
      area: "Dependencias",
      semaforo: bloqueadas >= 5 ? "riesgo" : bloqueadas > 0 ? "atencion" : "ok",
      titular: bloqueadas > 0 ? `${bloqueadas} ${bloqueadas === 1 ? "tarea detenida" : "tareas detenidas"}` : "Nada detenido",
      detalle: "No pueden avanzar hasta que se libere otra tarea.",
    },
    {
      area: "Calendario",
      semaforo: venceEnDias === null ? "ok" : venceEnDias <= 2 ? "riesgo" : venceEnDias <= 7 ? "atencion" : "ok",
      titular: venceEnDias === null ? "Sin vencimientos próximos"
        : venceEnDias <= 0 ? "Vence hoy" : `Próximo vencimiento en ${venceEnDias} días`,
      detalle: "Vencimientos fiscales del período.",
    },
    {
      area: "Continuidad",
      semaforo: concentracion >= 3 ? "riesgo" : concentracion > 0 ? "atencion" : "ok",
      titular: concentracion > 0 ? `${concentracion} ${concentracion === 1 ? "proceso depende" : "procesos dependen"} de una sola persona` : "Conocimiento repartido",
      detalle: "Riesgo de continuidad si esa persona no está. Se resuelve formando un respaldo.",
    },
    {
      area: "Planificación",
      semaforo: pctPlanificado < 50 ? "riesgo" : pctPlanificado < 75 ? "atencion" : "ok",
      titular: `${pctPlanificado}% del trabajo estaba previsto`,
      detalle: "El resto entró como urgencia dentro del mes.",
    },
  ];
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node node_modules/vitest/vitest.mjs run src/lib/director.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Crear `src/features/director/Director.tsx`**

Requisitos concretos:
- Recibe `{ cards: Card[]; team: Profile[]; annos: Announcement[] }`.
- Arma `EntradaDirector` reutilizando lo que YA existe:
  - `vencidas`: `cards.filter(c => c.status !== "term" && dueInfo(c)?.days < 0).length` (`dueInfo` de `src/lib/metrics.ts`).
  - `bloqueadas`: tareas abiertas con alguna dep no terminada (mismo criterio que `Reporte.tsx`).
  - `venceEnDias`: del primer elemento de `proximosVencimientos(annos, new Date(), 30)` (`src/lib/vencimientos.ts`).
  - `concentracion`: cantidad de categorías en riesgo que devuelve `busfactor.ts`.
  - `pctPlanificado`: `previsibilidad(cards, mesActual).pctPlanificado`.
- Renderiza los 5 paneles en una grilla de tarjetas grandes. El semáforo es **un punto de
  color** (`var(--done)` / `var(--warn)` / `var(--danger)`) — el único color de la pantalla,
  porque acá el color SÍ comunica estado.
- Cada panel: área en mayúsculas chico, titular grande, detalle en gris.
- **Sin emojis.**

- [ ] **Step 6: Agregar la ruta en `src/App.tsx`**

- Sumar `"__director"` a la lista de vistas no-persona (`isPersonView`).
- Renderizar `: view === "__director" ? <Director cards={scopedCards} team={equipoVisible} annos={annos} />`.
- La entrada del menú se muestra sólo con `esGestor` (un empleado no necesita esta pantalla).

- [ ] **Step 7: Verificar tipos, tests y build**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run && node node_modules/vite/bin/vite.js build`
Expected: tsc exit 0, todos los tests en verde, build OK.

- [ ] **Step 8: Commit**

```bash
git add src/lib/director.ts src/lib/director.test.ts src/features/director/Director.tsx src/App.tsx
git commit -m "feat: Modo Director — el estado del area en una pantalla"
```

---

## Verificación final

- `node node_modules/typescript/bin/tsc -b` → exit 0
- `node node_modules/vitest/vitest.mjs run` → todo verde (821 actuales + ~39 nuevos)
- `node node_modules/vite/bin/vite.js build` → OK
- Entrada en `src/lib/version.ts` (changelog) antes de publicar a `main`.
- **Revisión visual del propietario:** Reporte → "Flujo de trabajo en el mes" muestra una
  barra por persona; menú → "Director" muestra los cinco paneles con su semáforo.

## Lo que este plan NO hace (y por qué)

- **No toca la base de datos.** Cero migraciones: todo sale de datos que ya se guardan.
- **No agrega tracking de tiempo.** El cronómetro sigue desaconsejado en `PROPUESTA-ICR.md`.
- **No mide personas contra un objetivo.** Ninguna métrica de acá produce un ranking de
  gente con semáforo. Cuando aparece una persona (flujo mensual), es para *repartir carga*,
  y el texto lo dice explícitamente.
