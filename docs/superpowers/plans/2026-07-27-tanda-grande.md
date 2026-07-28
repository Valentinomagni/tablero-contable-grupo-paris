# Tanda grande — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar lo que ya está construido pero invisible, implementar las propuestas que
ya fueron diseñadas y evaluadas, y limpiar lo que sobra — en una sola tanda.

**Architecture:** Casi nada de acá es invención nueva. La mayor parte es **cablear trabajo que
ya existe** (libs sin consumidor, propuestas ya escritas en `docs/`) y **sacar lo que estorba**.
Sólo dos tareas agregan lógica genuinamente nueva.

**Tech Stack:** TypeScript, React 19, TanStack Query 5, vitest. Sin librerías nuevas.

## Global Constraints

- **5S y Kaizen son los valores del proyecto**, no un adorno: Seiri (sacar lo que no sirve),
  Seiton (un lugar para cada cosa), Seiso (limpiar), Seiketsu (que no se vuelva a ensuciar),
  Shitsuke (sostenerlo). Cada tarea dice a qué S responde.
- **Encuadre no punitivo (regla dura).** Ninguna señal de acá puede alimentar una evaluación
  de desempeño. `ociosidad.ts` tiene el estándar escrito en su encabezado; todo lo nuevo tiene
  que poder pasar esa línea.
- **Cero emojis.** Íconos sólo Lucide. Monocromo; el color sólo comunica estado.
- **Sin dependencias nuevas.** Una migración nueva sólo donde se diga explícitamente.
- Funciones puras: sin `new Date()` adentro — la fecha entra por parámetro.

---

## 0. Hallazgos que motivan este plan

Auditoría del 27/07 (ver `docs/AUDITORIA-5S-KAIZEN.md` para el detalle):

**Construido y NO conectado — valor más barato que existe:**

| Qué | Estado |
|---|---|
| `estabilidad.ts` | Lib completa con tests. **Ninguna pantalla la usa.** La construí y no la cablé. |
| `useEscribirPeriodo` | Hook creado en períodos Fase 2. **No se usa**: el mismo `upsert` está escrito a mano en Board y CardModal. |
| `useResumenMensual` + `mv_resumen_mensual` | Vista materializada de la migración 30. **Cero consumidores** (el comentario en `useData.ts:38-48` explica por qué: le faltan campos y filtros). |
| `card_pausas` | Tabla creada en la migración 31. **Cero uso.** Depende del cronómetro, que está desaconsejado. |

**Propuestas ya diseñadas y evaluadas, sin implementar:**

| Propuesta | Dónde está diseñada | Estado |
|---|---|---|
| **P1 — Confirmación de tarea estancada** | `docs/PROPUESTAS-ADOPCION.md:48` | **La #1 recomendada del documento.** No existe. |
| **P3 — Retomar donde quedaste** | `docs/PROPUESTAS-ADOPCION.md:95` | No existe. |
| **ICR mec. 1 — Confiabilidad por métrica** | `docs/PROPUESTA-ICR.md:138` | *"Es lo que convierte al ICR en algo útil. Sin esto, el ICR es un número suelto."* Esfuerzo bajo. |
| **ICR mec. 4 — Separar productividad de calidad** | `docs/PROPUESTA-ICR.md` | Decisión de diseño, esfuerzo bajo. |
| **Períodos Fase 3 y 4** | `docs/PROPUESTA-PERIODOS.md:334` | Fase 4 es la **queja original #2** del propietario. |

**Ya implementado (no repetir):** P2 cierre de jornada (`MiDia.tsx`), P9 tiempo máximo
(`tiempos.ts`), el botón "Marcar terminada" de un toque (parte de P5).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/components/Panel.tsx` (nuevo) | Tarjeta estándar. Hoy el estilo está copiado en 23 archivos. |
| `src/lib/estancadas.ts` (nuevo) | **Puro.** Qué tarea conviene preguntar y cuándo (P1), con toda la calibración. |
| `src/lib/estancadas.test.ts` (nuevo) | Tests, sobre todo de la calibración anti-molestia. |
| `src/lib/confianza-metrica.ts` (nuevo) | **Puro.** Traduce un ICR a un rótulo de confiabilidad para poner al lado de un número. |
| `src/lib/confianza-metrica.test.ts` (nuevo) | Tests. |
| `src/components/BadgeConfianza.tsx` (nuevo) | El badge visual que consume lo anterior. |
| `src/features/board/EstancadaPrompt.tsx` (nuevo) | El aviso de P1, con sus salidas reales. |
| `src/lib/periodo-cierre.ts` (nuevo) | **Puro.** Si un período está cerrado y por lo tanto es de sólo lectura. |
| `src/lib/periodo-cierre.test.ts` (nuevo) | Tests. |
| `migracion-34-checklist-diario.sql` (nuevo) | `task_occurrences.checklist` y `.obs` (Fase 4). |

---

# BLOQUE A — Limpieza (5S: Seiri + Seiton)

## Task A1: Sacar las seis librerías que nadie usa

**5S: Seiri.** Verificado a mano: nadie las importa, no existe `src/components/ui`, y `cn()`
está escrito a mano sin `clsx` ni `tailwind-merge`. Además Dependabot va a abrir PRs
semanales de librerías que no usamos.

**Files:**
- Modify: `package.json` (quitar 6 dependencias)

- [ ] **Step 1: Confirmar que nadie las importa**

Run:
```bash
grep -rn "clsx\|tailwind-merge\|class-variance-authority\|@base-ui\|tw-animate-css\|from \"shadcn\"" src/
```
Expected: sin resultados.

- [ ] **Step 2: Quitarlas**

Sacar de `package.json` → `dependencies`: `@base-ui/react`, `class-variance-authority`,
`clsx`, `shadcn`, `tailwind-merge`, `tw-animate-css`. Después: `npm install` para regenerar
el lockfile.

- [ ] **Step 3: Verificar que nada se rompió**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run && node node_modules/vite/bin/vite.js build`
Expected: tsc exit 0, todos los tests verdes, build OK.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: sacar 6 dependencias que no se usaban (5S seiri)"
```

---

## Task A2: Un solo lugar para escribir un período

**5S: Seiton.** Hoy hay tres implementaciones del mismo `upsert`: el hook (muerto) y dos
copias a mano. Si mañana cambia la forma de escribir un período, hay que acordarse de tocar
dos archivos.

**Files:**
- Modify: `src/features/board/Board.tsx` (usar el hook en vez del upsert inline)
- Modify: `src/features/board/CardModal.tsx` (ídem)

**Interfaces:**
- Consumes: `useEscribirPeriodo()` de `src/hooks/useData.ts:338`, que ya existe y hace
  `upsert` con `onConflict: "card_id,periodo"` + actualización optimista sobre
  `["card_periodos"]`.

- [ ] **Step 1: Reemplazar el upsert de Board.tsx**

En la rama `if (esEscrituraPeriodo(c.card_type))` del `mutationFn` de `move`, cambiar el
`supabase.from("card_periodos").upsert(...)` por una llamada al hook. Como el hook es una
mutación de react-query y no se puede llamar dentro de otra `mutationFn`, la forma correcta es
extraer la función de escritura a `src/lib/periodo-escritura.ts` y que **el hook y el Board
llamen a la misma función**. Firma a agregar en `periodo-escritura.ts`:

```ts
import { supabase } from "./supabase";
import type { FilaPeriodo } from "./periodo-escritura";

/** ÚNICO lugar donde se escribe una fila de período. Lo usan el hook y las mutaciones. */
export async function guardarPeriodo(fila: FilaPeriodo): Promise<void> {
  const { error } = await supabase.from("card_periodos").upsert(fila, { onConflict: "card_id,periodo" });
  if (error) throw error;
}
```

Board y CardModal pasan a llamar `await guardarPeriodo(fila)`. El hook `useEscribirPeriodo`
también, en su `mutationFn`.

- [ ] **Step 2: Verificar**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run`
Expected: tsc exit 0, tests verdes.

- [ ] **Step 3: Confirmar que no quedó ningún upsert suelto**

Run: `grep -rn 'from("card_periodos").upsert' src/`
Expected: **una sola** aparición, dentro de `guardarPeriodo` en `periodo-escritura.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/periodo-escritura.ts src/hooks/useData.ts src/features/board/Board.tsx src/features/board/CardModal.tsx
git commit -m "refactor: un solo lugar para escribir un periodo (5S seiton)"
```

---

## Task A3: Componente Panel + arreglar las llamadas repetidas

**5S: Seiton + Seiso.** El estilo de tarjeta está copiado en 23 archivos, ya con dos variantes
distintas (`--ring` vs `--ring-sh`). Y `Director.tsx` llama dos veces con los mismos argumentos
a `concentracionPorCategoria` y `previsibilidad`.

**Files:**
- Create: `src/components/Panel.tsx`
- Modify: `src/features/director/Director.tsx` (usar Panel + guardar los cálculos repetidos)
- Modify: `src/features/reporte/FlujoMensual.tsx` (usar Panel)

**Interfaces:**
- Produces: `export function Panel({ children, className }: { children: React.ReactNode; className?: string }): JSX.Element`

- [ ] **Step 1: Crear el componente**

```tsx
import type { ReactNode } from "react";
import { cn } from "../lib/ui";

// Tarjeta estándar del tablero. ANTES de esto, el mismo par de estilos estaba copiado en 23
// archivos de features/, ya con dos variantes distintas de sombra dando vueltas — que es
// exactamente cómo empieza la deriva visual. Un lugar para cada cosa (5S, Seiton).
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-surface border border-line rounded-2xl p-[18px]", className)}
      style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Arreglar las llamadas repetidas del Director**

En `src/features/director/Director.tsx`, guardar el resultado una sola vez:

```tsx
const concentraciones = concentracionPorCategoria(archives, team);
const prevision = previsibilidad(norm, mes);
```
y usar `concentraciones.length` para el panel y `concentraciones` / `prevision` en las señales
del motor, en vez de volver a llamar a las funciones.

- [ ] **Step 3: Migrar Director y FlujoMensual a `<Panel>`**

Reemplazar los `<div className={CARD} style={SOMBRA}>` por `<Panel>`. **No migrar los otros 21
archivos en esta tarea** — se hace de a poco para poder verificar visualmente cada tanda.

- [ ] **Step 4: Verificar**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run && node node_modules/vite/bin/vite.js build`
Expected: todo verde.

- [ ] **Step 5: Commit**

```bash
git add src/components/Panel.tsx src/features/director/Director.tsx src/features/reporte/FlujoMensual.tsx
git commit -m "refactor: componente Panel y calculos repetidos del Director (5S seiton/seiso)"
```

---

# BLOQUE B — Conectar lo ya construido

## Task B1: Confiabilidad por métrica (ICR mecanismo 1)

`docs/PROPUESTA-ICR.md` lo define como *"lo que convierte al ICR en algo útil: cada gráfico
dice de qué se puede fiar. Sin esto, el ICR es un número suelto."* Esfuerzo bajo, riesgo bajo
(califica al dato, no a la persona; no aparece ningún nombre).

**Files:**
- Create: `src/lib/confianza-metrica.ts`
- Test: `src/lib/confianza-metrica.test.ts`
- Create: `src/components/BadgeConfianza.tsx`
- Modify: `src/features/director/Director.tsx` (badge junto a los paneles que dependen del dato)

**Interfaces:**
- Consumes: `ResultadoICR` de `src/lib/icr.ts`.
- Produces:
  - `export type NivelConfianza = "alta" | "media" | "baja" | "sin-datos"`
  - `export interface Confianza { nivel: NivelConfianza; rotulo: string; explicacion: string }`
  - `export function confianzaDe(icr: ResultadoICR): Confianza`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { confianzaDe } from "./confianza-metrica";
import type { ResultadoICR } from "./icr";

const icrCon = (puntaje: number | null, suficiente = true, muestra = 20): ResultadoICR =>
  ({ puntaje, muestra, suficiente, factores: [], lectura: "" });

describe("confianzaDe", () => {
  it("85 o más es confianza alta", () => {
    expect(confianzaDe(icrCon(90)).nivel).toBe("alta");
    expect(confianzaDe(icrCon(85)).nivel).toBe("alta");
  });
  it("entre 70 y 84 es media", () => {
    expect(confianzaDe(icrCon(75)).nivel).toBe("media");
  });
  it("por debajo de 70 es baja", () => {
    expect(confianzaDe(icrCon(60)).nivel).toBe("baja");
    expect(confianzaDe(icrCon(20)).nivel).toBe("baja");
  });
  it("sin muestra suficiente no arriesga un nivel", () => {
    expect(confianzaDe(icrCon(null, false, 3)).nivel).toBe("sin-datos");
  });
  it("el rótulo habla del DATO, nunca de personas", () => {
    for (const p of [90, 75, 40]) {
      const c = confianzaDe(icrCon(p));
      expect(c.rotulo).not.toMatch(/persona|equipo|empleado|rendimiento/i);
    }
  });
  it("la explicación de confianza baja dice que no conviene decidir con esto", () => {
    expect(confianzaDe(icrCon(40)).explicacion).toMatch(/no conviene|no deberían|no alcanza/i);
  });
  it("es defensiva ante un icr ausente", () => {
    expect(confianzaDe(undefined as unknown as ResultadoICR).nivel).toBe("sin-datos");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node node_modules/vitest/vitest.mjs run src/lib/confianza-metrica.test.ts`
Expected: FAIL — "Failed to resolve import ./confianza-metrica"

- [ ] **Step 3: Implementar**

Umbrales de `docs/PROPUESTA-ICR.md` 3.4: ≥85 alta, 70–84 media, <70 baja, sin muestra →
`sin-datos`. Rótulos: `"Dato confiable"`, `"Dato usable con criterio"`, `"Dato poco
representativo"`, `"Sin datos suficientes"`. La explicación de "baja" tiene que contener
`"no conviene"`. **Ningún rótulo puede mencionar personas.**

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node node_modules/vitest/vitest.mjs run src/lib/confianza-metrica.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Crear el badge y montarlo**

`BadgeConfianza.tsx`: un chip chico con punto de color (`--done` / `--warn` / `--danger` /
`--ink2`) y el rótulo, con `title` = explicación. Montarlo en el Director al lado del título
"Qué conviene hacer" y del bloque de exposición.

- [ ] **Step 6: Verificar y commit**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run`

```bash
git add src/lib/confianza-metrica.ts src/lib/confianza-metrica.test.ts src/components/BadgeConfianza.tsx src/features/director/Director.tsx
git commit -m "feat: badge de confiabilidad por metrica (ICR mecanismo 1)"
```

---

## Task B2: Conectar el índice de estabilidad

Lo construí en la tanda anterior con 7 tests y **nunca lo cablé**. El lugar natural es el
Organigrama, junto a la curva de evolución individual que ya está ahí (`evolucion.ts`).

**Files:**
- Modify: `src/features/organigrama/Organigrama.tsx`

**Interfaces:**
- Consumes: `estabilidad(valores: number[]): { cv: number; nivel: NivelEstabilidad; texto: string }`
  de `src/lib/estabilidad.ts`; la serie mensual que ya calcula `curvaPersona` de `evolucion.ts`.

- [ ] **Step 1: Montar el texto de estabilidad en la ficha de la persona**

Donde hoy se muestra la curva de evolución, agregar debajo el `texto` que devuelve
`estabilidad()` sobre la misma serie de porcentajes mensuales. Con menos de 3 meses la lib ya
devuelve `"Faltan meses para poder compararlo"`, así que no hay caso vacío que manejar aparte.

**Encuadre:** el texto describe la SERIE, no a la persona. Va acompañado de la misma bajada
de acompañamiento que ya tiene la curva.

- [ ] **Step 2: Verificar y commit**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run`

```bash
git add src/features/organigrama/Organigrama.tsx
git commit -m "feat: mostrar el indice de estabilidad en la ficha de la persona"
```

---

# BLOQUE C — Adopción (bajar la fricción de decir la verdad)

## Task C1: P1 — Confirmación de tarea estancada

**La propuesta #1 recomendada** de `docs/PROPUESTAS-ADOPCION.md:48`. Es la única que **corrige
datos viejos de forma retroactiva**; todas las demás sólo previenen hacia adelante.

**La calibración no es refinamiento: es la diferencia entre que funcione y que sea
contraproterente.** Mal calibrada, pregunta todos los días y la gente aprende a apretar
"sigo con esto" sin leer — el sistema se siente al día y el dato es igual de falso, con la
molestia agregada.

**Files:**
- Create: `src/lib/estancadas.ts`
- Test: `src/lib/estancadas.test.ts`
- Create: `src/features/board/EstancadaPrompt.tsx`
- Modify: `src/features/hoy/MiDia.tsx` (mostrarlo, porque es la vista personal)

**Interfaces:**
- Consumes: `Card` de `src/lib/types.ts`; `esCobertura` de `src/lib/vacaciones.ts`.
- Produces:
  - `export const DIAS_PARA_PREGUNTAR = 5`
  - `export interface Estancada { card: Card; diasSinMover: number }`
  - `export function tareaParaPreguntar(cards: Card[], hoyISO: string, pospuestas: string[]): Estancada | null`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { tareaParaPreguntar, DIAS_PARA_PREGUNTAR } from "./estancadas";
import type { Card } from "./types";

const HOY = "2026-07-20T12:00:00Z";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "T", status: "proc", description: "",
    checklist: [], comments: [], history: [{ who: "u1", at: "2026-07-01T10:00:00Z", txt: "Movió la tarea" }],
    done_at: null, due_date: null, recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-07-01T10:00:00Z", ...over,
  };
}

describe("tareaParaPreguntar", () => {
  it("devuelve la tarea que lleva muchos días sin moverse", () => {
    const r = tareaParaPreguntar([card()], HOY, []);
    expect(r?.card.id).toBe("c1");
    expect(r?.diasSinMover).toBeGreaterThanOrEqual(DIAS_PARA_PREGUNTAR);
  });
  it("NO pregunta por algo movido hace poco", () => {
    const reciente = card({ history: [{ who: "u1", at: "2026-07-19T10:00:00Z", txt: "x" }] });
    expect(tareaParaPreguntar([reciente], HOY, [])).toBeNull();
  });
  it("NO pregunta por tareas terminadas", () => {
    expect(tareaParaPreguntar([card({ status: "term", done_at: "x" })], HOY, [])).toBeNull();
  });
  it("NO pregunta por operativas (son a demanda por diseño)", () => {
    expect(tareaParaPreguntar([card({ card_type: "operativa" })], HOY, [])).toBeNull();
  });
  it("NO vuelve a preguntar por algo que la persona pospuso", () => {
    expect(tareaParaPreguntar([card({ id: "c1" })], HOY, ["c1"])).toBeNull();
  });
  it("pregunta por UNA sola cosa a la vez (no abruma)", () => {
    const r = tareaParaPreguntar([card({ id: "a" }), card({ id: "b" })], HOY, []);
    expect(r).not.toBeNull();
    expect(typeof r!.card.id).toBe("string");
  });
  it("prioriza la más estancada", () => {
    const vieja = card({ id: "vieja", history: [{ who: "u1", at: "2026-06-01T10:00:00Z", txt: "x" }] });
    const menos = card({ id: "menos", history: [{ who: "u1", at: "2026-07-10T10:00:00Z", txt: "x" }] });
    expect(tareaParaPreguntar([menos, vieja], HOY, [])!.card.id).toBe("vieja");
  });
  it("una tarea cubierta por vacaciones no se cuenta como abandonada", () => {
    const cubierta = card({ description: "[cobertura hasta 2026-07-25]" });
    expect(tareaParaPreguntar([cubierta], HOY, [])).toBeNull();
  });
  it("sin historial usa created_at como referencia", () => {
    const sinHist = card({ history: [], created_at: "2026-07-01T10:00:00Z" });
    expect(tareaParaPreguntar([sinHist], HOY, [])?.card.id).toBe("c1");
  });
  it("es defensiva ante entradas no-array", () => {
    expect(tareaParaPreguntar(null as unknown as Card[], HOY, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node node_modules/vitest/vitest.mjs run src/lib/estancadas.test.ts`
Expected: FAIL — "Failed to resolve import ./estancadas"

- [ ] **Step 3: Implementar `src/lib/estancadas.ts`**

Reglas de calibración, todas obligatorias:
- `DIAS_PARA_PREGUNTAR = 5` días corridos desde la última señal (última entrada de `history`
  por `at`, o `created_at` si no hay).
- Sólo tareas **abiertas** (`status !== "term"`) y **no operativas**.
- Excluir las que están **cubiertas por vacaciones** (`esCobertura(card).activa`).
- Excluir las que la persona ya **pospuso** (lista `pospuestas` de ids).
- **Devolver UNA sola** (la más estancada), nunca una lista: preguntar por cinco cosas a la vez
  garantiza que se ignoren todas.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node node_modules/vitest/vitest.mjs run src/lib/estancadas.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Crear el aviso con SALIDAS REALES**

`EstancadaPrompt.tsx`: una tarjeta discreta en "Mi día" (**nunca un modal que bloquee**) con el
título de la tarea, hace cuántos días no se mueve, y **cuatro salidas**:
- **Sigo con esto** → escribe una entrada en `history` (actualiza la señal, que es el objetivo).
- **Ya está terminada** → la cierra.
- **Ahora no** → la agrega a `pospuestas` en `localStorage` (namespaced por owner, con `PREF`),
  para no volver a preguntar en la sesión.
- **Abrir la tarea** → abre el modal para hacer otra cosa.

**Sin salidas reales, la alerta se aprende a ignorar** — es lo que dice el documento sobre el
mecanismo 7. Y va **sólo en la vista personal**: si aparece en la vista del jefe, deja de ser
una ayuda y pasa a ser control.

- [ ] **Step 6: Verificar y commit**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run && node node_modules/vite/bin/vite.js build`

```bash
git add src/lib/estancadas.ts src/lib/estancadas.test.ts src/features/board/EstancadaPrompt.tsx src/features/hoy/MiDia.tsx src/lib/prefs.ts
git commit -m "feat: P1 confirmacion de tarea estancada, con salidas reales"
```

---

# BLOQUE D — Períodos (cerrar lo que quedó abierto)

## Task D1: Fase 3 — cerrar un mes con candado

Hoy "cerrar el mes" es una **marca declarativa**: dice que cerraste pero no congela nada. Con
`card_periodos` en su lugar, cerrar puede volver el mes de sólo lectura de verdad.

**Files:**
- Create: `src/lib/periodo-cierre.ts`
- Test: `src/lib/periodo-cierre.test.ts`
- Modify: `src/App.tsx` (candado en el selector de período)
- Modify: `src/features/board/Board.tsx` (no permitir mover en un mes cerrado)

**Interfaces:**
- Consumes: `CierrePeriodo` de `src/lib/types.ts` (`{ owner, mes, cerrado_at, nota }`).
- Produces:
  - `export function periodoCerrado(cierres: CierrePeriodo[], owner: string, periodo: string): boolean`
  - `export function periodosCerradosDe(cierres: CierrePeriodo[], owner: string): string[]`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { periodoCerrado, periodosCerradosDe } from "./periodo-cierre";
import type { CierrePeriodo } from "./types";

const cierre = (owner: string, mes: string): CierrePeriodo =>
  ({ id: `${owner}-${mes}`, owner, mes, cerrado_at: "2026-08-01T10:00:00Z", nota: null });

describe("periodoCerrado", () => {
  it("true si esa persona cerró ese mes", () => {
    expect(periodoCerrado([cierre("u1", "2026-07")], "u1", "2026-07")).toBe(true);
  });
  it("el cierre es POR PERSONA: el de otro no cierra el mío", () => {
    expect(periodoCerrado([cierre("u2", "2026-07")], "u1", "2026-07")).toBe(false);
  });
  it("el cierre es POR MES: cerrar julio no cierra agosto", () => {
    expect(periodoCerrado([cierre("u1", "2026-07")], "u1", "2026-08")).toBe(false);
  });
  it("sin cierres, nada está cerrado", () => {
    expect(periodoCerrado([], "u1", "2026-07")).toBe(false);
  });
  it("es defensiva ante entradas no-array", () => {
    expect(periodoCerrado(null as unknown as CierrePeriodo[], "u1", "2026-07")).toBe(false);
  });
});

describe("periodosCerradosDe", () => {
  it("lista los meses cerrados de una persona, ordenados desc", () => {
    const cs = [cierre("u1", "2026-06"), cierre("u1", "2026-08"), cierre("u2", "2026-07")];
    expect(periodosCerradosDe(cs, "u1")).toEqual(["2026-08", "2026-06"]);
  });
  it("sin cierres devuelve lista vacía", () => {
    expect(periodosCerradosDe([], "u1")).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node node_modules/vitest/vitest.mjs run src/lib/periodo-cierre.test.ts`
Expected: FAIL — "Failed to resolve import ./periodo-cierre"

- [ ] **Step 3: Implementar**

Funciones puras y defensivas sobre el array de cierres. Sin fetch.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node node_modules/vitest/vitest.mjs run src/lib/periodo-cierre.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Candado en la UI**

- En `App.tsx`: los períodos cerrados llevan un ícono `Lock` (Lucide) en el selector.
- Pasar `cerrado: boolean` al `Board`; cuando es `true`, no se puede arrastrar ni editar, y
  se muestra una banda: `Este mes está cerrado. Para modificarlo, reabrilo desde Cierre.`
- **Reabrir ya existe** (`useReabrirMes` en `hooks/usePeriodos.ts`): no se toca.

- [ ] **Step 6: Verificar y commit**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run && node node_modules/vite/bin/vite.js build`

```bash
git add src/lib/periodo-cierre.ts src/lib/periodo-cierre.test.ts src/App.tsx src/features/board/Board.tsx
git commit -m "feat: periodos fase 3 — mes cerrado es de solo lectura, con candado"
```

---

## Task D2: Fase 4 — el checklist diario que no se borra

**Es la queja original #2 del propietario**, la única del spec 28-correcciones que sigue
abierta. Hoy una tarea recurrente diaria tiene **un solo checklist compartido por todos los
días**: cuando se reinicia, se pierde lo de ayer.

`task_occurrences` **ya es inmutable por fecha** — el modelo está bien, sólo falta guardar el
detalle ahí.

**Files:**
- Create: `migracion-34-checklist-diario.sql`
- Modify: `src/lib/types.ts` (`TaskOccurrence` suma `checklist` y `obs`)
- Modify: `src/lib/esquema.ts` (`MIGRACION_CHECKLIST_DIARIO = 34` + gate)
- Modify: `src/features/board/card/ChecklistSection.tsx` (checklist del día al abrir una fecha)

- [ ] **Step 1: Escribir la migración**

```sql
-- Migración 34 — checklist y observaciones POR DÍA en task_occurrences.
-- Spec 28-correcciones, item 2. Idempotente.
--
-- QUÉ RESUELVE: una tarea recurrente diaria tenía UN solo checklist, compartido por todas las
-- fechas. Al reiniciarse se perdía el detalle de los días anteriores. `task_occurrences` ya
-- guarda una fila por (card_id, fecha) y ya es inmutable, así que el detalle del día va acá.
--
-- NO TOCA NADA EXISTENTE: sólo agrega dos columnas con default. El `done`/`resultado` del
-- arqueo sigue igual, y sin esta migración la app funciona como hoy (gate en esquema.ts).
alter table public.task_occurrences add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.task_occurrences add column if not exists obs text;

insert into public.schema_migrations (id, nombre)
  select 34, 'migracion-34-checklist-diario.sql'
  where not exists (select 1 from public.schema_migrations where id = 34);
```

- [ ] **Step 2: Tipos y gate**

En `src/lib/types.ts`, `TaskOccurrence` suma `checklist?: ChecklistItem[]` y `obs?: string | null`.
En `src/lib/esquema.ts`, agregar `MIGRACION_CHECKLIST_DIARIO = 34` y
`tieneChecklistDiario(aplicadas)`, más el gate en el payload de `task_occurrences` (mismo
patrón que `payloadCards`): sin la migración, esas columnas no viajan.

- [ ] **Step 3: UI del checklist por día**

En `ChecklistSection.tsx`, cuando la tarea es recurrente y hay una fecha seleccionada en la
grilla de cumplimiento, el checklist que se edita es el **de esa ocurrencia**, no el de la
card. Gateado por `tieneChecklistDiario`: sin la migración, se comporta como hoy.

- [ ] **Step 4: Documentar el paso manual**

Agregar a `docs/PASOS-MANUALES.md` una sección de la migración 34, con el mismo formato que la
33: qué resuelve, cómo correrla, cómo verificar.

- [ ] **Step 5: Verificar y commit**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run && node node_modules/vite/bin/vite.js build`

```bash
git add migracion-34-checklist-diario.sql src/lib/types.ts src/lib/esquema.ts src/features/board/card/ChecklistSection.tsx docs/PASOS-MANUALES.md
git commit -m "feat: periodos fase 4 — checklist y observaciones por dia (queja #2)"
```

---

## Cierre de la tanda

- [ ] Entrada nueva en `src/lib/version.ts` (changelog en lenguaje de usuario).
- [ ] `tsc -b` exit 0 · suite completa verde · build OK.
- [ ] Publicar todo junto (un solo pedido de permiso para GitHub Desktop).

## Lo que este plan NO hace, y por qué

- **`mv_resumen_mensual` / `useResumenMensual`**: la vista existe pero le faltan campos
  (`sucursal`, `categoria`) y filtros para que las métricas den bien. Arreglarla es una
  migración nueva y un rediseño de la vista; no entra acá para no mezclar.
- **`card_pausas`**: depende del cronómetro, **explícitamente desaconsejado** en
  `PROPUESTA-ICR.md` sección 6. La tabla queda sin uso a propósito.
- **P7 (costo colectivo) y P8 (reconocimiento con ranking)**: el propio documento de adopción
  los marca como los de mayor riesgo de generar rechazo en el equipo.
- **Migrar los 23 archivos a `<Panel>` de una**: se hace en tandas, verificando a ojo.
