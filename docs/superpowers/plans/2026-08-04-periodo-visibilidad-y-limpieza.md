# Historial por período, visibilidad de equipo y limpieza Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada mes muestre lo que pasó ESE mes, que una tarea de una sola vez no vuelva para siempre, y que un jefe o encargado pueda ver en qué anda su equipo sin que nadie se sienta vigilado.

**Architecture:** El historial por período **no necesita tabla nueva**: `card_periodos` ya tiene columna `history` desde la migración 32 y nadie la usa. La visibilidad de equipo es una lib pura sobre datos que ya existen, más una vista nueva. La recurrencia pasa a ser una decisión explícita al crear la tarea, con default seguro.

**Tech Stack:** React 19, TypeScript, Tailwind, TanStack Query 5, Supabase, vitest.

---

## Decisiones tomadas antes de escribir esto

Se consultaron y quedaron cerradas el 04/08/2026:

1. **Sin cronómetro.** No hay timer en vivo ni bloqueos que obliguen a "activar" antes de "terminar". El motivo está abajo, en "Lo que no se hace y por qué".
2. **Alcance por equipo.** El jefe ve a todos; un encargado ve a quienes le reportan; un empleado se ve a sí mismo. Es el mismo modelo que ya usa el resto del sistema.
3. **Una sola tanda**, que incluye la limpieza de legado y la revisión de arquitectura.

---

## El bug que originó todo

Captura del 04/08/2026: una tarea con **8 entradas de historial** mezclando julio y agosto. Y adentro, esto:

```
Marcó terminada  — Valentino Magni, 04/08/2026, 04:02 p. m.
Reabrió la tarea — Valentino Magni, 04/08/2026, 04:02 p. m.
```

Dos entradas contradictorias **en el mismo minuto**. No es un error de tipeo: es el reinicio mensual fallido dejando rastro, mezclado con el trabajo real. El historial acumulado hace imposible responder la pregunta que importa — *"¿qué se hizo con esta tarea en julio?"*.

**La causa raíz:** `cards.history` acumula desde que la tarea existe. `card_periodos.history` existe desde la migración 32 y **nunca se escribió ni se leyó**. La Fase 2 de períodos dejó ese cabo suelto.

---

## Global Constraints

- **NO hay npm, pnpm, yarn ni corepack.** Cero dependencias nuevas. Ver `CLAUDE.md` §1.
- `node` en `C:\Users\Vmagni\AppData\Local\OpenAI\Codex\bin\node.exe`. Bash:
  `export PATH="/c/Users/Vmagni/AppData/Local/OpenAI/Codex/bin:$PATH"`
- Tests `node node_modules/vitest/vitest.mjs run` · Tipos `node node_modules/typescript/bin/tsc -b`
  · Lint `node node_modules/oxlint/bin/oxlint` · Build `node node_modules/vite/bin/vite.js build`
- Exit codes explícitos: `comando > /tmp/log 2>&1; echo "EXIT: $?"`. Nunca `comando | tail`.
- **El pre-commit tarda 90-180 s.** Timeout de **420000 ms** en `git commit`. Heredoc de Bash.
- **Cero emojis.** Iconos sólo de `lucide-react`.
- **Nada de `text-[Npx]`**: escala `text-2xs` … `text-4xl`. Hay guardián.
- Tarjetas con `<Panel>`. Hay guardián angosto con escape `panel-guard-ok`.
- **Encuadre no punitivo**: las métricas describen situaciones y procesos, nunca juzgan personas.
  Hay guardián (`src/lib/encuadre.guard.test.ts`).
- Ningún error muestra el mensaje crudo de la base: todo por `mensajeUsuario()` de `src/lib/fallas.ts`.
- **Nunca editar JSX con expresiones regulares ni `sed`.**
- Comentarios en español explicando el **por qué**.
- Base al empezar: **1122 tests / 99 archivos**.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/historial-periodo.ts` | **Puro.** Separa el historial acumulado por período y decide cuál mostrar. |
| `src/lib/historial-periodo.test.ts` | Tests. |
| `src/features/board/card/HistorialSection.tsx` | Muestra el historial del período que se está mirando. |
| `src/lib/recurrencia-alta.ts` | **Puro.** Qué recurrencia recibe una tarea nueva según lo que elija quien la crea. |
| `src/lib/recurrencia-alta.test.ts` | Tests. |
| `src/features/board/NuevaTareaModal.tsx` | Pregunta si la tarea se repite. |
| `src/lib/en-que-anda.ts` | **Puro.** De cards + equipo a "quién tiene qué abierto y desde cuándo". |
| `src/lib/en-que-anda.test.ts` | Tests. |
| `src/features/equipo/EnQueAnda.tsx` | La vista para jefe y encargado. |
| `src/lib/prioridad-calculada.ts` | **Puro.** Orden sugerido a partir de parámetros configurables. |
| `src/lib/prioridad-calculada.test.ts` | Tests. |
| `.claude/agents/*.md` | Agentes especializados para revisiones futuras. |
| `docs/LIMPIEZA-2026-08.md` | Qué se sacó, por qué, y qué se dejó a propósito. |

---

### Task 1: Historial por período (el bug de la captura)

**Files:**
- Create: `src/lib/historial-periodo.ts`
- Test: `src/lib/historial-periodo.test.ts`

**Interfaces:**
- Consumes: `HistoryEntry` de `src/lib/types.ts` (`{ who: string; at: string; txt: string }`).
- Produces:
  - `export function historialDePeriodo(historial: HistoryEntry[], periodo: string): HistoryEntry[]`
  - `export function periodosConHistorial(historial: HistoryEntry[]): string[]`
  - `export function esRuidoDeReinicio(entrada: HistoryEntry): boolean`

- [ ] **Step 1: Write the failing test**

Crear `src/lib/historial-periodo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { historialDePeriodo, periodosConHistorial, esRuidoDeReinicio } from "./historial-periodo";
import type { HistoryEntry } from "./types";

function h(at: string, txt = "Marcó terminada", who = "Ana"): HistoryEntry {
  return { who, at, txt };
}

describe("historialDePeriodo", () => {
  it("devuelve sólo lo que pasó en ese mes", () => {
    const todo = [h("2026-07-16T14:13:00Z"), h("2026-08-04T16:02:00Z")];
    expect(historialDePeriodo(todo, "2026-07")).toHaveLength(1);
    expect(historialDePeriodo(todo, "2026-08")).toHaveLength(1);
  });

  it("un mes sin movimientos devuelve lista vacía, no todo", () => {
    expect(historialDePeriodo([h("2026-07-16T14:13:00Z")], "2026-09")).toEqual([]);
  });

  it("ordena del más reciente al más viejo, como se lee", () => {
    const todo = [h("2026-07-01T10:00:00Z", "Creó la tarea"), h("2026-07-20T10:00:00Z", "Marcó terminada")];
    expect(historialDePeriodo(todo, "2026-07")[0].txt).toBe("Marcó terminada");
  });

  // El mes se decide en hora ARGENTINA: una entrada del 31/07 a las 22 hora local es de
  // julio, aunque en UTC ya sea el 1 de agosto.
  it("asigna el mes en hora argentina, no en UTC", () => {
    const nocturna = h("2026-08-01T01:30:00Z"); // 31/07 22:30 en Argentina
    expect(historialDePeriodo([nocturna], "2026-07")).toHaveLength(1);
    expect(historialDePeriodo([nocturna], "2026-08")).toHaveLength(0);
  });

  it("es defensiva ante entradas raras", () => {
    expect(historialDePeriodo(null as unknown as HistoryEntry[], "2026-07")).toEqual([]);
    expect(historialDePeriodo([null as unknown as HistoryEntry], "2026-07")).toEqual([]);
    expect(historialDePeriodo([h("no es fecha")], "2026-07")).toEqual([]);
  });
});

describe("periodosConHistorial", () => {
  it("lista los meses que tienen movimientos, del más nuevo al más viejo", () => {
    const todo = [h("2026-06-10T10:00:00Z"), h("2026-08-04T10:00:00Z"), h("2026-07-16T10:00:00Z")];
    expect(periodosConHistorial(todo)).toEqual(["2026-08", "2026-07", "2026-06"]);
  });

  it("no repite un mes con varios movimientos", () => {
    const todo = [h("2026-07-01T10:00:00Z"), h("2026-07-20T10:00:00Z")];
    expect(periodosConHistorial(todo)).toEqual(["2026-07"]);
  });

  it("sin historial devuelve lista vacía", () => {
    expect(periodosConHistorial([])).toEqual([]);
  });
});

// Lo que motivó todo: la captura mostraba "Marcó terminada" y "Reabrió la tarea" en el
// MISMO minuto. No es trabajo de nadie: es el reinicio mensual dejando rastro.
describe("esRuidoDeReinicio", () => {
  it("reconoce el reinicio automático", () => {
    expect(esRuidoDeReinicio({ who: "Sistema", at: "2026-08-01T03:05:00Z", txt: "Reinicio mensual automático (2026-07 archivado)" })).toBe(true);
  });

  it("reconoce el reinicio manual", () => {
    expect(esRuidoDeReinicio({ who: "Sistema", at: "2026-08-04T19:00:00Z", txt: "Reinicio mensual manual (2026-07 archivado)" })).toBe(true);
  });

  it("NO marca como ruido el trabajo de una persona", () => {
    expect(esRuidoDeReinicio(h("2026-08-04T16:02:00Z", "Marcó terminada", "Valentino Magni"))).toBe(false);
    expect(esRuidoDeReinicio(h("2026-08-04T16:02:00Z", "Reabrió la tarea", "Valentino Magni"))).toBe(false);
  });

  it("es defensiva", () => {
    expect(esRuidoDeReinicio(null as unknown as HistoryEntry)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node node_modules/vitest/vitest.mjs run src/lib/historial-periodo.test.ts > /tmp/h.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/h.log
```
Expected: EXIT distinto de 0, `Failed to resolve import "./historial-periodo"`.

- [ ] **Step 3: Write the implementation**

Crear `src/lib/historial-periodo.ts`:

```ts
import type { HistoryEntry } from "./types";
import { toARTDate } from "./metrics";

// Historial POR PERÍODO.
//
// EL PROBLEMA QUE ATACA. `cards.history` acumula desde que la tarea existe. Al abrir una
// tarea recurrente en agosto se veían ocho entradas mezclando julio y agosto, y no había
// forma de responder la pregunta que importa: "¿qué se hizo con esto en julio?".
//
// La migración 32 creó `card_periodos.history` justamente para esto y quedó sin usar. Pero
// no hace falta migrar los datos viejos: cada entrada YA trae su fecha, así que el período
// se puede derivar. Esta lib hace eso — es un cambio de lectura, no de escritura, y por lo
// tanto no puede perder nada.
//
// PURA: sin red, sin `new Date()` de "ahora" adentro.

/** El mes 'YYYY-MM' al que pertenece una marca de tiempo, en hora argentina. */
function periodoDe(at: string): string | null {
  if (typeof at !== "string" || !at) return null;
  const d = new Date(at);
  if (!isFinite(d.getTime())) return null;
  // `toARTDate` y no `slice(0,7)` del ISO: una entrada del 31/07 a las 22 hora argentina es
  // de julio, aunque en UTC ya sea el 1 de agosto. Un movimiento de fin de mes contado en el
  // mes siguiente ensucia justo el período que se está revisando.
  return toARTDate(at).slice(0, 7);
}

/**
 * ¿Esta entrada la escribió el reinicio mensual y no una persona?
 *
 * Importa porque en la captura que originó este trabajo aparecían "Marcó terminada" y
 * "Reabrió la tarea" en el MISMO minuto. Eso no es trabajo de nadie: es el reinicio dejando
 * rastro. Mezclado con el historial real hace que parezca que alguien hizo algo raro.
 *
 * No se BORRA —el rastro del reinicio es información legítima— pero se puede distinguir para
 * mostrarlo aparte y que no se confunda con lo que hizo una persona.
 */
export function esRuidoDeReinicio(entrada: HistoryEntry): boolean {
  if (!entrada || typeof entrada.txt !== "string") return false;
  return entrada.who === "Sistema" && /reinicio mensual/i.test(entrada.txt);
}

/** Las entradas de ese mes, de la más reciente a la más vieja. */
export function historialDePeriodo(historial: HistoryEntry[], periodo: string): HistoryEntry[] {
  if (!Array.isArray(historial)) return [];
  return historial
    .filter((e) => e && periodoDe(e.at) === periodo)
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}

/** Los meses que tienen algún movimiento, del más nuevo al más viejo. */
export function periodosConHistorial(historial: HistoryEntry[]): string[] {
  if (!Array.isArray(historial)) return [];
  const meses = new Set<string>();
  for (const e of historial) {
    const p = e && periodoDe(e.at);
    if (p) meses.add(p);
  }
  return [...meses].sort((a, b) => b.localeCompare(a));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node node_modules/vitest/vitest.mjs run src/lib/historial-periodo.test.ts > /tmp/h.log 2>&1; echo "EXIT: $?"; tail -8 /tmp/h.log
```
Expected: `EXIT: 0`, 13 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/historial-periodo.ts src/lib/historial-periodo.test.ts
git commit -m "feat: lib para leer el historial de una tarea por periodo"
```

---

### Task 2: Mostrar el historial del período que se está mirando

**Files:**
- Modify: el componente que hoy dibuja el bloque "HISTORIAL (8)" dentro de la tarea.

**Interfaces:**
- Consumes: `historialDePeriodo()`, `periodosConHistorial()`, `esRuidoDeReinicio()` de la Task 1.

- [ ] **Step 1: Find where the history block lives**

```bash
grep -rn "HISTORIAL\|Historial" src/features/board --include=*.tsx | head
grep -rn "c.history" src/features/board --include=*.tsx | head
```

Anotá el archivo y la línea exactos antes de editar.

- [ ] **Step 2: Show only the current period, with the rest available**

El bloque tiene que:

1. Mostrar **por defecto el historial del período que se está mirando** (el `periodo` que ya
   recibe el `Board`; si el componente de la tarea no lo tiene, pasáselo desde donde se
   monta el modal).
2. Encabezado con el mes: `Historial de agosto 2026 (3)` en vez de `HISTORIAL (8)`.
   Para el nombre del mes usá `periodoLabel` de `src/lib/periodo-instancias.ts`, que ya existe.
3. Si hay movimientos en **otros** meses, una línea al pie que los liste y permita cambiar:
   `También hay movimientos en julio 2026 y junio 2026.` — cada mes clickeable.
4. Las entradas que devuelva `esRuidoDeReinicio` van con un tono más apagado
   (`text-ink2 opacity-70`) y el texto `· automático` al lado. **No se ocultan**: el rastro
   del reinicio es información legítima, sólo no tiene que confundirse con trabajo de una
   persona.
5. Si el período mirado no tiene movimientos: `Sin movimientos en agosto 2026.` y la línea
   de los otros meses.

**Regla dura:** esto es un cambio de **lectura**. No se toca cómo se escribe el historial ni
se borra ninguna entrada. Si algo te obliga a modificar `cards.history`, pará y reportalo.

- [ ] **Step 3: Full verification**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
```
Expected: los cuatro en `EXIT: 0`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: el historial de la tarea muestra el mes que se esta mirando"
```

---

### Task 3: Una tarea de una sola vez no vuelve el mes que viene

**Files:**
- Create: `src/lib/recurrencia-alta.ts`
- Test: `src/lib/recurrencia-alta.test.ts`
- Modify: `src/features/board/NuevaTareaModal.tsx`

**Interfaces:**
- Produces:
  - `export type TipoAlta = "una-vez" | "cada-mes"`
  - `export function camposDeAlta(tipo: TipoAlta): { recurring: boolean; reset_policy: "mensual" | "manual" }`
  - `export const TIPO_ALTA_POR_DEFECTO: TipoAlta`

**El problema.** Hoy `NuevaTareaModal` no pregunta nada sobre recurrencia, y la base usa
`coalesce(reset_policy, 'mensual')`. Resultado: una tarea cargada para resolver algo puntual
queda en el tablero para siempre, y nadie sabe si está ahí porque falta hacerla o porque
nadie la borró. Es basura acumulándose — lo contrario de Seiri.

- [ ] **Step 1: Write the failing test**

Crear `src/lib/recurrencia-alta.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { camposDeAlta, TIPO_ALTA_POR_DEFECTO } from "./recurrencia-alta";

describe("camposDeAlta", () => {
  it("una tarea de una sola vez no se reinicia nunca", () => {
    const c = camposDeAlta("una-vez");
    expect(c.recurring).toBe(false);
    expect(c.reset_policy).toBe("manual");
  });

  it("una tarea de todos los meses se reinicia con el mes", () => {
    const c = camposDeAlta("cada-mes");
    expect(c.recurring).toBe(true);
    expect(c.reset_policy).toBe("mensual");
  });

  // El default seguro es "una vez": lo reversible va primero. Marcar después que algo se
  // repite cuesta un click; darse cuenta seis meses después de que veinte tareas puntuales
  // vienen reapareciendo cuesta una limpieza entera.
  it("el default es una sola vez", () => {
    expect(TIPO_ALTA_POR_DEFECTO).toBe("una-vez");
  });

  it("ante un valor inesperado cae al default seguro", () => {
    const c = camposDeAlta("cualquier cosa" as never);
    expect(c.recurring).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node node_modules/vitest/vitest.mjs run src/lib/recurrencia-alta.test.ts > /tmp/r.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/r.log
```
Expected: EXIT distinto de 0, import no resuelto.

- [ ] **Step 3: Write the implementation**

Crear `src/lib/recurrencia-alta.ts`:

```ts
// Qué recurrencia recibe una tarea al crearla.
//
// EL PROBLEMA. `NuevaTareaModal` no preguntaba nada, y la base asume `reset_policy = 'mensual'`
// cuando el campo viene vacío. Así, una tarea cargada para resolver algo puntual quedaba en el
// tablero para siempre, y nadie podía distinguir "falta hacerla" de "nadie la borró". Basura
// acumulándose, que es exactamente lo contrario de Seiri.
//
// EL DEFAULT ES "UNA VEZ", y es la decisión importante de este archivo. Lo reversible va
// primero: marcar después que una tarea se repite cuesta un click; darse cuenta seis meses
// más tarde de que veinte tareas puntuales vienen reapareciendo cuesta una limpieza entera.

export type TipoAlta = "una-vez" | "cada-mes";

/** El default seguro. Ver el comentario de arriba: no es una preferencia, es reversibilidad. */
export const TIPO_ALTA_POR_DEFECTO: TipoAlta = "una-vez";

/**
 * Los campos que van al insert. `manual` y no `mensual` para la tarea de una sola vez: es lo
 * que hace que el reinicio mensual la ignore (ver `reset_recurrentes_seguro`, migración 24).
 */
export function camposDeAlta(tipo: TipoAlta): { recurring: boolean; reset_policy: "mensual" | "manual" } {
  return tipo === "cada-mes"
    ? { recurring: true, reset_policy: "mensual" }
    : { recurring: false, reset_policy: "manual" };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node node_modules/vitest/vitest.mjs run src/lib/recurrencia-alta.test.ts > /tmp/r.log 2>&1; echo "EXIT: $?"; tail -8 /tmp/r.log
```
Expected: `EXIT: 0`, 4 tests passing.

- [ ] **Step 5: Ask the question when creating a task**

En `src/features/board/NuevaTareaModal.tsx`, agregar una elección de dos opciones —
**"Una sola vez"** (seleccionada por defecto) y **"Todos los meses"** — y sumar
`camposDeAlta(tipo)` al objeto que se inserta.

El texto de ayuda debajo, en una línea: *"Las de todos los meses vuelven a Pendiente cuando
arranca el mes nuevo."*

Los campos tienen que pasar por `payloadCards(...)` si el archivo ya lo usa, para que no
rompa en una base sin la migración correspondiente. Verificalo con
`grep -n "payloadCards" src/features/board/NuevaTareaModal.tsx` antes de editar.

- [ ] **Step 6: Full verification and commit**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
git add -A
git commit -m "feat: al crear una tarea se elige si se repite, y el default es que no"
```

---

### Task 4: En qué anda el equipo — la lib

**Files:**
- Create: `src/lib/en-que-anda.ts`
- Test: `src/lib/en-que-anda.test.ts`

**Interfaces:**
- Consumes: `Card`, `Profile` de `src/lib/types.ts`.
- Produces:
  - `export interface TareaAbierta { id: string; title: string; desde: string | null; dias: number | null; enProceso: boolean }`
  - `export interface AndarDePersona { persona: Profile; abiertas: TareaAbierta[]; enProceso: number; sinMover: TareaAbierta | null }`
  - `export function enQueAnda(cards: Card[], equipo: Profile[], hoyISO: string): AndarDePersona[]`

**Qué es y qué NO es.** Responde *"¿en qué anda cada uno?"* con lo que el sistema ya sabe: qué
tiene abierto y desde cuándo. **No hay cronómetro** — se decidió el 04/08/2026 y el motivo está
al final de este plan.

- [ ] **Step 1: Write the failing test**

Crear `src/lib/en-que-anda.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { enQueAnda } from "./en-que-anda";
import type { Card, Profile } from "./types";

const HOY = "2026-08-04T15:00:00Z";

function persona(over: Partial<Profile> = {}): Profile {
  return { id: "u1", name: "Ana Pérez", role: "empleado", manager_id: null, ...over } as Profile;
}

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "DDJJ IIBB", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, proc_at: null,
    due_date: null, recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-08-01T09:00:00Z", ...over,
  };
}

describe("enQueAnda", () => {
  it("lista lo que cada persona tiene abierto", () => {
    const r = enQueAnda([card()], [persona()], HOY);
    expect(r).toHaveLength(1);
    expect(r[0].abiertas[0].title).toBe("DDJJ IIBB");
  });

  it("no cuenta lo terminado", () => {
    const r = enQueAnda([card({ status: "term", done_at: "2026-08-02T10:00:00Z" })], [persona()], HOY);
    expect(r[0].abiertas).toHaveLength(0);
  });

  // Las operativas son a demanda y de volumen alto: mezclarlas taparía el resto.
  it("no cuenta las operativas", () => {
    const r = enQueAnda([card({ card_type: "operativa" })], [persona()], HOY);
    expect(r[0].abiertas).toHaveLength(0);
  });

  it("marca cuáles están en proceso y cuenta cuántas", () => {
    const cards = [card({ id: "a", status: "proc", proc_at: "2026-08-03T10:00:00Z" }), card({ id: "b" })];
    const r = enQueAnda(cards, [persona()], HOY);
    expect(r[0].enProceso).toBe(1);
    expect(r[0].abiertas.find((t) => t.id === "a")!.enProceso).toBe(true);
  });

  it("dice desde cuándo está en proceso, en días", () => {
    const r = enQueAnda([card({ status: "proc", proc_at: "2026-08-01T15:00:00Z" })], [persona()], HOY);
    expect(r[0].abiertas[0].dias).toBe(3);
  });

  it("sin fecha de inicio no inventa un número", () => {
    const r = enQueAnda([card({ status: "pend", proc_at: null })], [persona()], HOY);
    expect(r[0].abiertas[0].dias).toBeNull();
    expect(r[0].abiertas[0].desde).toBeNull();
  });

  it("señala la que lleva más tiempo sin moverse", () => {
    const cards = [
      card({ id: "a", status: "proc", proc_at: "2026-08-03T10:00:00Z" }),
      card({ id: "b", status: "proc", proc_at: "2026-07-20T10:00:00Z" }),
    ];
    expect(enQueAnda(cards, [persona()], HOY)[0].sinMover!.id).toBe("b");
  });

  it("si nada lleva tiempo, no señala nada", () => {
    const r = enQueAnda([card({ status: "proc", proc_at: "2026-08-04T09:00:00Z" })], [persona()], HOY);
    expect(r[0].sinMover).toBeNull();
  });

  it("incluye a quien no tiene nada abierto, sin destacarlo", () => {
    const r = enQueAnda([], [persona()], HOY);
    expect(r).toHaveLength(1);
    expect(r[0].abiertas).toEqual([]);
  });

  it("ordena las personas por nombre, no por cantidad", () => {
    // Ordenar por cantidad arma un ranking. El orden es alfabético a propósito.
    const equipo = [persona({ id: "u2", name: "Zoe" }), persona({ id: "u1", name: "Ana Pérez" })];
    const cards = [card({ id: "a", owner: "u2" }), card({ id: "b", owner: "u2" })];
    expect(enQueAnda(cards, equipo, HOY).map((r) => r.persona.name)).toEqual(["Ana Pérez", "Zoe"]);
  });

  it("es defensiva ante entradas raras", () => {
    expect(enQueAnda(null as unknown as Card[], [persona()], HOY)[0].abiertas).toEqual([]);
    expect(enQueAnda([card()], null as unknown as Profile[], HOY)).toEqual([]);
    expect(enQueAnda([card()], [persona()], "no es fecha")[0].abiertas[0].dias).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node node_modules/vitest/vitest.mjs run src/lib/en-que-anda.test.ts > /tmp/e.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/e.log
```
Expected: EXIT distinto de 0, import no resuelto.

- [ ] **Step 3: Write the implementation**

Crear `src/lib/en-que-anda.ts`:

```ts
import type { Card, Profile } from "./types";

// "En qué anda el equipo" — qué tiene abierto cada persona y desde cuándo.
//
// QUÉ ES. La pregunta que un jefe o un encargado necesita responder de un vistazo: si alguien
// pide ayuda, si algo lleva demasiado sin moverse, si la carga está repartida.
//
// QUÉ NO ES, Y ES DELIBERADO:
//
//   · NO hay cronómetro. Se evaluó y se descartó el 04/08/2026, con el mismo fundamento del
//     análisis del ICR: un timer a la vista del jefe se falsea dejando la tarea abierta, así
//     que no mide trabajo — mide cuánto se acuerda cada uno de apretar el botón. Y el costo
//     es alto: el equipo que se siente medido trabaja para la foto, y ahí TODO el dato del
//     sistema pasa a ser mentira.
//
//   · NO hay ranking. El orden es ALFABÉTICO, nunca por cantidad. Ordenar por volumen arma un
//     podio aunque no haya números de puesto, y el podio contradice la regla dura del
//     proyecto: las métricas describen situaciones, nunca juzgan personas.
//
//   · NO se destaca a quien no tiene nada abierto. Aparece igual que los demás, sin marca.
//     Un tablero vacío puede ser alguien de licencia, alguien que cerró todo, o alguien que
//     no está cargando su trabajo. Sacar conclusiones de eso es exactamente lo que no hay
//     que hacer con un dato ambiguo.
//
// PURA: `hoyISO` entra por parámetro.

/** Desde cuántos días sin moverse vale la pena señalar una tarea. */
const DIAS_SIN_MOVER = 5;
const DIA_MS = 86400000;

export interface TareaAbierta {
  id: string;
  title: string;
  /** Cuándo se puso en proceso. `null` si nunca se inició. */
  desde: string | null;
  /** Días desde que se puso en proceso. `null` si no se puede saber. */
  dias: number | null;
  enProceso: boolean;
}

export interface AndarDePersona {
  persona: Profile;
  abiertas: TareaAbierta[];
  enProceso: number;
  /** La que lleva más tiempo sin moverse, si alguna pasa el umbral. */
  sinMover: TareaAbierta | null;
}

export function enQueAnda(cards: Card[], equipo: Profile[], hoyISO: string): AndarDePersona[] {
  if (!Array.isArray(equipo)) return [];
  const lista = Array.isArray(cards) ? cards : [];
  const ahora = new Date(hoyISO).getTime();
  const ahoraOk = isFinite(ahora);

  return equipo
    .filter(Boolean)
    .slice()
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "es"))
    .map((persona) => {
      const suyas = lista.filter(
        (c) => c && c.owner === persona.id && c.status !== "term" && c.card_type !== "operativa",
      );

      const abiertas: TareaAbierta[] = suyas.map((c) => {
        const desde = c.status === "proc" ? c.proc_at ?? null : null;
        const t = desde ? new Date(desde).getTime() : NaN;
        const dias = desde && ahoraOk && isFinite(t) ? Math.floor((ahora - t) / DIA_MS) : null;
        return { id: c.id, title: c.title, desde, dias, enProceso: c.status === "proc" };
      });

      const candidatas = abiertas.filter((t) => t.dias !== null && t.dias >= DIAS_SIN_MOVER);
      const sinMover = candidatas.length
        ? candidatas.reduce((peor, t) => ((t.dias ?? 0) > (peor.dias ?? 0) ? t : peor))
        : null;

      return {
        persona,
        abiertas,
        enProceso: abiertas.filter((t) => t.enProceso).length,
        sinMover,
      };
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node node_modules/vitest/vitest.mjs run src/lib/en-que-anda.test.ts > /tmp/e.log 2>&1; echo "EXIT: $?"; tail -8 /tmp/e.log
```
Expected: `EXIT: 0`, 11 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/en-que-anda.ts src/lib/en-que-anda.test.ts
git commit -m "feat: lib de en que anda el equipo, sin cronometro y sin ranking"
```

---

### Task 5: En qué anda el equipo — la vista

**Files:**
- Create: `src/features/equipo/EnQueAnda.tsx`
- Modify: `src/App.tsx` (una entrada de navegación para gestores)

**Interfaces:**
- Consumes: `enQueAnda()`, `AndarDePersona` de la Task 4; `equipoDe` de `src/lib/jerarquia.ts`;
  `personasVisibles` de `src/lib/visibilidad.ts`.

**Alcance, decidido el 04/08/2026:** jefe ve a todos, encargado ve a quienes le reportan,
empleado no tiene esta vista. Es el mismo modelo que el resto del sistema — `equipoDe(me.id, team)`
ya lo resuelve y se usa en `Admin.tsx`. **No inventes un criterio nuevo.**

- [ ] **Step 1: Build the view**

Cada persona es un `<Panel>` con:

- El nombre y, al lado, `3 abiertas · 1 en proceso` en `text-sm text-ink2`.
- La lista de tareas abiertas. Las que están en proceso llevan un punto `var(--done)`; las
  que no arrancaron, uno `var(--ink2)`.
- Al lado de cada una, cuando hay dato: `desde hace 3 días`. **Si `dias` es `null` no se
  escribe nada** — no se inventa "sin iniciar" ni se marca en rojo. Que una tarea no tenga
  fecha de inicio no dice nada sobre quien la tiene.
- Si `sinMover` no es nulo, una línea al pie de esa persona:
  `Conciliación CTA H lleva 8 días sin moverse.` — **sobre la tarea, nunca sobre la persona.**
- Quien no tiene nada abierto: `Sin tareas abiertas.` en `text-ink2`, sin destaque ni color.

Arriba de todo, una línea de encuadre visible (no en tooltip), igual que hace el ICR:

> Muestra en qué está trabajando cada persona para poder repartir la carga y dar una mano.
> No mide desempeño: una tarea puede llevar días por su naturaleza y no por quien la hace.

- [ ] **Step 2: Add it to the navigation for gestores**

En `src/App.tsx`, sumar la vista al menú **sólo cuando `esGestor` es verdadero** (esa variable
ya existe). Seguí el patrón de cómo se agrega `__director`, que también es sólo para gestores.

- [ ] **Step 3: Full verification**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
node node_modules/vitest/vitest.mjs run src/lib/encuadre.guard.test.ts > /tmp/g.log 2>&1; echo "GUARDIAN EXIT: $?"
```
Expected: los cinco en `EXIT: 0`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: vista de en que anda el equipo para jefe y encargado"
```

---

### Task 6: Parámetros para estandarizar qué se hace primero

**Files:**
- Create: `src/lib/prioridad-calculada.ts`
- Test: `src/lib/prioridad-calculada.test.ts`

**Interfaces:**
- Consumes: `Card` de `src/lib/types.ts`; `guardarPermissions` de `src/lib/settings-guardar.ts`.
- Produces:
  - `export interface PesosPrioridad { vencimiento: number; prioridad: number; esfuerzo: number; bloquea: number }`
  - `export const PESOS_POR_DEFECTO: PesosPrioridad`
  - `export function puntajeDeOrden(c: Card, todas: Card[], pesos: PesosPrioridad, hoyISO: string): number`
  - `export function porQueVaPrimero(c: Card, todas: Card[], pesos: PesosPrioridad, hoyISO: string): string[]`

**Lo que pediste:** *"si abrimos una tarea y asignamos esfuerzo y prioridad, me gustaría que
exista algo más para poder medirlo, así podríamos estandarizar qué se debe hacer primero y que
debería ser así siempre."*

**Cómo se resuelve.** Un puntaje con **pesos configurables** por el jefe. El criterio deja de
vivir en la cabeza de cada uno y pasa a estar escrito en un lugar. `porQueVaPrimero` devuelve
los motivos en texto: un orden que no se puede explicar se ignora la segunda vez que se
equivoca, y con razón.

- [ ] **Step 1: Write the failing test**

Crear `src/lib/prioridad-calculada.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { puntajeDeOrden, porQueVaPrimero, PESOS_POR_DEFECTO } from "./prioridad-calculada";
import type { Card } from "./types";

const HOY = "2026-08-04T12:00:00Z";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "T", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, proc_at: null,
    due_date: null, recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-08-01T09:00:00Z", ...over,
  };
}

describe("puntajeDeOrden", () => {
  it("lo vencido pesa más que lo que vence lejos", () => {
    const vencida = card({ id: "a", due_date: "2026-08-01" });
    const lejana = card({ id: "b", due_date: "2026-09-30" });
    expect(puntajeDeOrden(vencida, [], PESOS_POR_DEFECTO, HOY))
      .toBeGreaterThan(puntajeDeOrden(lejana, [], PESOS_POR_DEFECTO, HOY));
  });

  it("la prioridad alta pesa más que la baja", () => {
    const alta = card({ id: "a", priority: "alta" });
    const baja = card({ id: "b", priority: "baja" });
    expect(puntajeDeOrden(alta, [], PESOS_POR_DEFECTO, HOY))
      .toBeGreaterThan(puntajeDeOrden(baja, [], PESOS_POR_DEFECTO, HOY));
  });

  // Que otros dependan de una tarea la vuelve urgente aunque no lo parezca: mientras no se
  // haga, hay gente parada.
  it("una tarea que bloquea a otras pesa más", () => {
    const bloqueante = card({ id: "a" });
    const dependiente = card({ id: "b", deps: ["a"] });
    expect(puntajeDeOrden(bloqueante, [bloqueante, dependiente], PESOS_POR_DEFECTO, HOY))
      .toBeGreaterThan(puntajeDeOrden(bloqueante, [bloqueante], PESOS_POR_DEFECTO, HOY));
  });

  it("a igualdad de todo, la más rápida va primero", () => {
    const rapida = card({ id: "a", effort: 1 });
    const larga = card({ id: "b", effort: 5 });
    expect(puntajeDeOrden(rapida, [], PESOS_POR_DEFECTO, HOY))
      .toBeGreaterThan(puntajeDeOrden(larga, [], PESOS_POR_DEFECTO, HOY));
  });

  it("los pesos cambian el resultado, que es el punto de que sean configurables", () => {
    const alta = card({ priority: "alta" });
    const sinPeso = { ...PESOS_POR_DEFECTO, prioridad: 0 };
    expect(puntajeDeOrden(alta, [], sinPeso, HOY))
      .toBeLessThan(puntajeDeOrden(alta, [], PESOS_POR_DEFECTO, HOY));
  });

  it("nunca devuelve NaN, ni con datos incompletos", () => {
    const rota = card({ due_date: "no es fecha", effort: undefined as unknown as number });
    expect(Number.isFinite(puntajeDeOrden(rota, [], PESOS_POR_DEFECTO, HOY))).toBe(true);
    expect(Number.isFinite(puntajeDeOrden(null as unknown as Card, [], PESOS_POR_DEFECTO, HOY))).toBe(true);
  });
});

describe("porQueVaPrimero", () => {
  it("explica en texto, no con un número suelto", () => {
    const c = card({ due_date: "2026-08-01", priority: "alta" });
    const motivos = porQueVaPrimero(c, [], PESOS_POR_DEFECTO, HOY);
    expect(motivos.join(" ")).toMatch(/vencid/i);
    expect(motivos.join(" ")).toMatch(/prioridad/i);
  });

  it("si no hay nada que destacar, no inventa un motivo", () => {
    expect(porQueVaPrimero(card(), [], PESOS_POR_DEFECTO, HOY)).toEqual([]);
  });

  it("los motivos hablan de la tarea, nunca de quien la tiene", () => {
    const c = card({ due_date: "2026-08-01", priority: "alta", owner: "u1" });
    expect(porQueVaPrimero(c, [], PESOS_POR_DEFECTO, HOY).join(" ")).not.toMatch(/u1|responsable|persona/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node node_modules/vitest/vitest.mjs run src/lib/prioridad-calculada.test.ts > /tmp/p.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/p.log
```
Expected: EXIT distinto de 0, import no resuelto.

- [ ] **Step 3: Write the implementation**

Crear `src/lib/prioridad-calculada.ts`:

```ts
import type { Card } from "./types";
import { toARTDate } from "./metrics";

// Qué conviene hacer primero, con criterio ESCRITO y configurable.
//
// EL PROBLEMA. Hoy cada tarea tiene prioridad y esfuerzo, pero el criterio de qué va primero
// vive en la cabeza de cada uno. Dos personas con el mismo tablero lo ordenan distinto, y
// cuando alguien cubre a otro no sabe por dónde empezar.
//
// LA DECISIÓN DE DISEÑO. El puntaje se acompaña SIEMPRE de sus motivos en texto
// (`porQueVaPrimero`). Un número que ordena sin explicar por qué se ignora la segunda vez que
// se equivoca — y con razón. El motor de recomendaciones del Director sigue el mismo criterio.
//
// PURO: `hoyISO` entra por parámetro.

export interface PesosPrioridad {
  /** Cuánto pesa que esté vencida o por vencer. */
  vencimiento: number;
  /** Cuánto pesa la prioridad declarada. */
  prioridad: number;
  /** Cuánto pesa que sea rápida de sacar. */
  esfuerzo: number;
  /** Cuánto pesa que otras tareas la estén esperando. */
  bloquea: number;
}

/**
 * Los pesos por defecto. El vencimiento manda porque es lo único con consecuencia externa: una
 * DDJJ fuera de término tiene multa; una tarea "importante" que se hace mañana, no.
 */
export const PESOS_POR_DEFECTO: PesosPrioridad = {
  vencimiento: 40,
  prioridad: 25,
  bloquea: 25,
  esfuerzo: 10,
};

const PESO_PRIORIDAD: Record<string, number> = { alta: 1, media: 0.5, baja: 0 };

/** Días hasta el vencimiento. `null` si no tiene o no se puede leer. */
function diasParaVencer(c: Card, hoyISO: string): number | null {
  if (!c?.due_date || typeof c.due_date !== "string") return null;
  const hoy = Date.parse(toARTDate(hoyISO) + "T00:00:00Z");
  const vence = Date.parse(c.due_date + "T00:00:00Z");
  if (!isFinite(hoy) || !isFinite(vence)) return null;
  return Math.round((vence - hoy) / 86400000);
}

/** Cuántas tareas sin terminar dependen de ésta. */
function cuantasEsperan(c: Card, todas: Card[]): number {
  if (!Array.isArray(todas) || !c?.id) return 0;
  return todas.filter((x) => x && x.status !== "term" && (x.deps ?? []).includes(c.id)).length;
}

/** Más alto = va antes. Nunca NaN. */
export function puntajeDeOrden(c: Card, todas: Card[], pesos: PesosPrioridad, hoyISO: string): number {
  if (!c) return 0;
  const p = pesos ?? PESOS_POR_DEFECTO;

  // Vencimiento: 1 si está vencida, y baja suavemente hasta 0 a los 30 días.
  const d = diasParaVencer(c, hoyISO);
  const fVenc = d === null ? 0 : d < 0 ? 1 : Math.max(0, 1 - d / 30);

  const fPrio = PESO_PRIORIDAD[c.priority] ?? 0.5;

  // Esfuerzo invertido: lo rápido suma. Sacar lo corto libera la lista y da aire.
  const esf = Number(c.effort);
  const fEsf = Number.isFinite(esf) && esf > 0 ? 1 / esf : 1;

  // Bloqueo: satura a las 3 tareas esperando. Más allá de eso ya es "urgente" igual.
  const fBloq = Math.min(1, cuantasEsperan(c, todas) / 3);

  const total = fVenc * (p.vencimiento ?? 0) + fPrio * (p.prioridad ?? 0)
    + fEsf * (p.esfuerzo ?? 0) + fBloq * (p.bloquea ?? 0);
  return Number.isFinite(total) ? Math.round(total * 100) / 100 : 0;
}

/** Los motivos, en lenguaje de usuario. Vacío si no hay nada para destacar. */
export function porQueVaPrimero(c: Card, todas: Card[], pesos: PesosPrioridad, hoyISO: string): string[] {
  if (!c) return [];
  const out: string[] = [];
  const d = diasParaVencer(c, hoyISO);
  if (d !== null && d < 0) out.push("Está vencida");
  else if (d !== null && d <= 3) out.push(d === 0 ? "Vence hoy" : `Vence en ${d} día${d === 1 ? "" : "s"}`);

  if (c.priority === "alta") out.push("Prioridad alta");

  const esperan = cuantasEsperan(c, todas);
  if (esperan > 0) out.push(`${esperan} tarea${esperan === 1 ? "" : "s"} espera${esperan === 1 ? "" : "n"} por ésta`);

  const esf = Number(c.effort);
  if (Number.isFinite(esf) && esf === 1 && (pesos ?? PESOS_POR_DEFECTO).esfuerzo > 0) out.push("Es rápida de sacar");

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node node_modules/vitest/vitest.mjs run src/lib/prioridad-calculada.test.ts > /tmp/p.log 2>&1; echo "EXIT: $?"; tail -8 /tmp/p.log
```
Expected: `EXIT: 0`, 9 tests passing.

- [ ] **Step 5: Let the jefe configure the weights**

En `src/features/admin/Admin.tsx`, junto a los otros parámetros, cuatro campos numéricos (0 a
100) para los pesos, guardados con `guardarPermissions({ pesos_prioridad: { ... } })` — que ya
existe y hace el merge contra el valor fresco.

Agregar `pesos_prioridad?: PesosPrioridad` al tipo `AppSettings` en `src/lib/types.ts`.

Debajo de los campos, la lista de las 5 tareas del propio tablero que quedarían primeras con
esos pesos, en vivo. Sin eso, los números son abstractos y nadie sabe qué está tocando.

- [ ] **Step 6: Full verification and commit**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
git add -A
git commit -m "feat: orden sugerido con pesos configurables y motivos explicados"
```

---

### Task 7: Agentes especializados para las revisiones

**Files:**
- Create: `.claude/agents/revisor-seguridad.md`
- Create: `.claude/agents/revisor-contable.md`
- Create: `.claude/agents/revisor-producto.md`

**Por qué.** Las auditorías de esta semana encontraron cosas muy distintas según el ángulo:
una escalada de privilegios, un podio que contradecía los valores, una sombra inválida. Cada
hallazgo vino de mirar con un lente distinto. Dejar esos lentes escritos hace que la próxima
revisión no dependa de acordarse.

- [ ] **Step 1: Create the security reviewer**

Crear `.claude/agents/revisor-seguridad.md`:

```markdown
---
name: revisor-seguridad
description: Revisa permisos, RLS, Edge Functions y todo lo que pueda dejar datos expuestos. Usalo antes de publicar cambios que toquen la base o la autenticación.
tools: Read, Grep, Glob, Bash
---

Sos un revisor de seguridad escéptico. Tu trabajo NO es aprobar: es encontrar por dónde se
filtran datos. Sos de SÓLO LECTURA: nunca modifiques archivos ni commitees.

## Qué mirar, en orden

1. **Columnas nuevas en `profiles`.** Toda columna que otorgue permisos o cambie visibilidad
   tiene que estar en la lista del trigger `profiles_bloquear_campos_sensibles`. Es una lista
   explícita, así que lo que no está queda desprotegido en silencio. **Esto ya falló una vez**
   con `admin_sistema` (migración 33 la creó, nadie tocó el trigger, y cualquier empleado
   podía hacerse administrador y leer las consultas de todo el equipo).

2. **Lectura y escritura que no coinciden.** En cada policy, comparar `using` con
   `with check`. **Esto ya falló** en `task_occurrences`: un encargado podía ver el trabajo de
   su equipo pero no guardarlo, y el error que veía era el texto crudo de Postgres.

3. **Recursión en policies de `profiles`.** Nunca una subconsulta a `profiles` dentro de una
   policy de `profiles` (error 42P17). Se usan los helpers `SECURITY DEFINER` `es_jefe()`,
   `es_encargado_de(uuid)`, `es_admin_sistema()`.

4. **Edge Functions.** Que validen el rol leyéndolo **de la base**, nunca del cuerpo del
   pedido. Que la `service_role` no aparezca en nada que llegue al navegador.

5. **Escrituras que pueden perder datos.** `update` sin `.eq()`, `upsert` con `onConflict`
   equivocado, o un `upsert` que manda una columna que pisa lo que había.

6. **Mensajes crudos de la base en pantalla.** Todo error tiene que pasar por
   `mensajeUsuario()` de `src/lib/fallas.ts`.

## Cómo reportar

Cada hallazgo con severidad (crítico/importante/menor), archivo:línea, el caso concreto que lo
dispara, y qué podría hacer alguien con eso. Decí también qué probaste y no falló. Si el área
está sana, decilo — es un resultado válido.
```

- [ ] **Step 2: Create the accounting reviewer**

Crear `.claude/agents/revisor-contable.md`:

```markdown
---
name: revisor-contable
description: Revisa que los números, fechas y vencimientos del sistema sean correctos desde la lógica contable. Usalo cuando se toquen métricas, cierres, períodos o vencimientos.
tools: Read, Grep, Glob, Bash
---

Sos contador y revisás este sistema con ojo de quien lo va a usar para cumplir vencimientos
fiscales reales. Sos de SÓLO LECTURA.

## El contexto que importa

El equipo trabaja **a mes vencido**: lo de julio se hace en agosto. Los vencimientos son de
ARCA (IVA, F931, IIBB, SICORE) y llegar tarde tiene multa. Un día de diferencia no es un
detalle de presentación: es un incumplimiento.

## Qué mirar

1. **Zona horaria.** Todo lo que sea "hoy" o un día calendario tiene que pasar por
   `toARTDate()` de `src/lib/metrics.ts`. **Esto ya falló tres veces**: el Tablón archivaba
   vencimientos tres horas antes, y el chip "Venció" de cada tarjeta usaba la zona del
   navegador. Buscá `new Date()` con `getMonth`, `getDate`, `toISOString().slice(0,10)` o
   `toDateString()`.

2. **Períodos.** Que lo de un mes no se mezcle con otro. El mes se define por hora argentina.
   `cards` es la definición estable, `card_periodos` el estado por mes, `task_occurrences` el
   día a día.

3. **Números que pueden mentir.** Divisiones sin guardia (un `NaN` en un total contamina todo
   sin dejar rastro), promedios sobre muestras chicas presentados como si fueran sólidos,
   consultas que se truncan en silencio y hacen que un porcentaje baje sin motivo real.

4. **Que el sistema no afirme lo que no sabe.** Si la muestra es chica, tiene que decirlo. Si
   un dato no está, "sin datos" es mejor que un cero.

## Cómo reportar

Cada hallazgo con el caso concreto y **qué número equivocado vería un contador**. Priorizá lo
que puede provocar un incumplimiento real por sobre lo cosmético.
```

- [ ] **Step 3: Create the product reviewer**

Crear `.claude/agents/revisor-producto.md`:

```markdown
---
name: revisor-producto
description: Revisa que lo que se construye sirva a quien lo usa y no contradiga los valores del proyecto. Usalo cuando se agregue una función visible o se cambie un texto.
tools: Read, Grep, Glob, Bash
---

Revisás este sistema pensando en las dos personas que lo usan: quien carga su trabajo todos los
días, y quien conduce el área. Sos de SÓLO LECTURA.

## La regla que manda sobre todas

**Las métricas describen situaciones y procesos, NUNCA juzgan personas.** No hay rankings, ni
conteos por persona, ni comparaciones entre gente.

No es una preferencia estética: el modo de falla más probable de este proyecto no es técnico.
Si el equipo percibe el sistema como control, va a trabajar para la foto y **todos los datos
van a ser mentira**. Un sistema con datos falsos es peor que ninguno, porque las decisiones se
toman igual.

**Esto ya falló:** el Reporte tenía un "Ranking de productividad" que ordenaba a las personas y
les ponía el número de puesto, y se exportaba al PDF — mientras el panel de al lado aclaraba
"no mide productividad individual".

## Qué mirar

1. **Podios encubiertos.** Listas de personas ordenadas por volumen, aunque no digan "ranking"
   ni muestren el puesto. Una barra medida contra el máximo arma un primer puesto visual.
2. **Textos que suenan a reproche**, sobre todo los que aparecen al abrir la app. El peor
   momento para una mala noticia es apenas alguien entra.
3. **Funciones construidas y nunca conectadas.** Peor todavía si el changelog las anuncia:
   ahí el sistema le miente a quien lo usa. **Ya pasó** con el sello de confianza.
4. **Que el camino correcto sea el más cómodo.** Si hacer lo correcto cuesta cuatro toques y
   saltearlo cuesta uno, la gente lo saltea — y no es culpa de la gente.
5. **Que se pueda deshacer.** Toda acción destructiva necesita confirmación o vuelta atrás.

## Cómo reportar

Cada hallazgo con qué vería o sentiría la persona que lo usa. Si algo cumple la letra de la
regla pero la rompe en espíritu, decilo igual: eso es justamente lo que un test no puede ver.
```

- [ ] **Step 4: Verify and commit**

```bash
ls -1 .claude/agents/
git add .claude/agents
git commit -m "chore: agentes de revision para seguridad, contabilidad y producto"
```

---

### Task 8: Limpieza y cierre

**Files:**
- Create: `docs/LIMPIEZA-2026-08.md`
- Modify: `src/lib/version.ts`, `docs/ESTADO-DEL-PROYECTO.md`

- [ ] **Step 1: Find what is actually dead**

```bash
node node_modules/knip/bin/knip.js > /tmp/k.log 2>&1; echo "EXIT: $?"; cat /tmp/k.log
ls -1 docs/
git ls-files | grep -cE "^(dist|test-results|node_modules)/"
```

**Cuidado con los docs.** Varios que parecen viejos (`PROPUESTA-ICR.md`,
`PROPUESTAS-ADOPCION.md`) son el registro de **decisiones que siguen vigentes** — el ICR es lo
que sostiene por qué no hay cronómetro. **No borres un documento porque tenga fecha vieja.**
Sólo lo que quedó fácticamente superado, y anotando en el nuevo dónde estaba lo anterior.

- [ ] **Step 2: Write down what was removed and what was kept**

Crear `docs/LIMPIEZA-2026-08.md` listando, con una línea de motivo cada uno: qué se sacó, qué
se dejó **a propósito** aunque parezca legado, y qué sigue bloqueado. Las 6 dependencias sin
usar siguen bloqueadas por la falta de npm — que quede escrito para no volver a evaluarlo.

- [ ] **Step 3: Changelog**

En `src/lib/version.ts`, arriba de todo:

```ts
  {
    version: "2.12.0",
    fecha: "2026-08-04",
    cambios: [
      "El historial de una tarea ahora muestra lo que pasó en el mes que estás mirando, en vez de todo mezclado desde que se creó. Los otros meses siguen a un click.",
      "Al crear una tarea ahora elegís si es de una sola vez o si se repite todos los meses. Por defecto es de una sola vez, así lo puntual no vuelve para siempre.",
      "Nuevo para jefes y encargados: \"En qué anda el equipo\", con lo que cada persona tiene abierto y desde cuándo. Sirve para repartir la carga y dar una mano, no para medir a nadie.",
      "El jefe puede configurar qué pesa más al sugerir por dónde empezar: vencimiento, prioridad, tareas que esperan por ésta, o lo rápido de sacar. La app explica siempre por qué una tarea va primero.",
    ],
  },
```

- [ ] **Step 4: Final verification**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
echo "--- higiene ---"
echo "tamanos a mano (0):"; grep -ro "text-\[[0-9.]*px\]" src --include=*.tsx | wc -l
echo "console.log (0):"; grep -r "console\.log" src --include=*.ts --include=*.tsx | grep -v test | wc -l
```
Expected: los cuatro `EXIT: 0` y los dos contadores en `0`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: limpieza documentada y changelog 2.12.0"
```

---

## Lo que NO se hace, y por qué

Esta sección importa tanto como las tareas. Todo lo de acá se pidió y se descartó **con
motivo**, no por olvido.

### El cronómetro en vivo

Pedido: ver el tiempo que lleva cada persona en cada tarea abierta.

**Por qué no.** Un timer a la vista del jefe no mide trabajo: mide cuánto se acuerda cada uno
de apretar el botón. Se falsea sin esfuerzo —se deja la tarea abierta mientras se toma un
café— y el dato que queda es peor que el de hoy, porque parece preciso. Ya estaba analizado y
desaconsejado en `docs/PROPUESTA-ICR.md`, y la tabla `card_pausas` está creada y **vacía a
propósito** esperando esta decisión.

Y hay un costo que no se ve en el código: quien pide el sistema queda en el lugar del que
vigila a sus compañeros. Eso no es lo mismo que ser quien resolvió el problema del área.

**Lo que se hace en su lugar:** la Task 5 muestra qué tiene abierto cada uno y desde cuándo.
Misma información útil para conducir, sin el cronómetro.

### Bloquear el paso a "terminada" si no se pasó por "en proceso"

Pedido: que el sistema obligue a activar una tarea antes de poder terminarla.

**Por qué no.** El bloqueo se saltea apretando los dos botones seguidos, y entonces se pierden
las dos cosas: no se gana el dato y se gana la molestia. Peor: enseña que el sistema pone
trabas, que es justo lo contrario de lo que hace falta para que la gente lo cargue bien.

**Lo que sí resuelve el problema real** —que hay tareas cerradas sin registrar el arranque— ya
está hecho: `patchCierreRapido` sella `proc_at` cuando falta, así que ninguna tarea queda sin
fecha de inicio y las métricas de tiempo no se degradan. El camino correcto es hacer que
arrancar una tarea sea **más cómodo** que saltearlo, no castigar el atajo.

### Avisos al jefe cuando alguien no cumple

**Por qué no así.** Un aviso que dice "esta persona no hizo X" es una delación automatizada, y
la primera vez que llega uno el equipo entiende para qué sirve el sistema.

**Lo que se hace:** los avisos son **sobre el trabajo**. "Esta tarea lleva 8 días sin moverse"
le sirve igual a quien conduce, y no le dice a nadie que alguien falló. La Task 5 lo incluye,
en la línea de `sinMover`.
