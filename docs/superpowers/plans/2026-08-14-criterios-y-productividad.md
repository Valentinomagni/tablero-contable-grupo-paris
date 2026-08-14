# Unificación de criterios y productividad del empleado — Plan de implementación

> **Para quien lo ejecute:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development
> (recomendada) o superpowers:executing-plans, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** que una misma tarea se llame, se describa y se controle igual sin importar quién la
haga ni para qué marca, y que el empleado tenga una ruta del mes en vez de una lista.

**Arquitectura:** tres capas que se agregan sin romper lo que hay. (1) Las reglas de estado se
mueven a **una función y un trigger de base**, porque hoy están repartidas en seis lugares que ya
divergieron. (2) Un **catálogo de tareas estándar** del que se instancian las tareas concretas,
para que "Conciliación Chevrolet" y "Conciliación Peugeot" salgan de la misma definición. (3) Un
campo de **bloqueo por área externa**, que registra que algo espera a Ventas o RRHH sin que esas
áreas usen la app.

**Stack:** React 19 + TypeScript + Vite + Tailwind + TanStack Query + Supabase (Postgres, RLS,
triggers). Tests con vitest.

---

## Antes de empezar: qué está verificado y qué no

**Verificado hoy, 14/08/2026, con el comando al lado:**

| Qué | Comando | Resultado |
|---|---|---|
| Tipos, lint, tests, build | los cuatro | 0, 0, **1381 tests / 117 archivos**, 0 |
| Todo publicado | `git rev-list --count origin/main..HEAD` | 0 |
| Producción sirve la 2.15.0 | bundle `index-CE_AiV1t.js` leído desde el navegador | sí |
| Sin errores de consola en producción | `read_console_messages` | ninguno |

**NO verificado, y hay que decirlo:** nada de esto se probó **con sesión iniciada y datos
reales**. No tengo credenciales y no voy a usar las tuyas. Que los tests pasen dice que la lógica
está bien; no dice que la pantalla se vea bien ni que el flujo se sienta bien.

**Dos cosas que yo di por cerradas y no lo estaban.** Vale dejarlo escrito porque explica por qué
la Fase A va primera:

- **El gate de checklist existe pero está inerte.** Es opt-in por tarea (`exige_checklist`,
  `default false`) y sólo se puede prender al crear una tarea nueva. Ninguna tarea existente lo
  tiene. Se construyó *una opción*; lo que se pidió era *una regla*.
- **El gate de transición no existe.** Nunca se escribió. Hoy se arrastra de Pendiente a
  Terminado sin pasar por En proceso.

---

## Global Constraints

Todas las tareas heredan esto. Está en `CLAUDE.md`; se copia acá porque quien ejecute una tarea
suelta no lo va a leer entero.

- **Cero emojis** en texto de usuario. Iconos sólo de `lucide-react`.
- **Encuadre no punitivo.** Las métricas describen situaciones y procesos, **nunca juzgan
  personas**. Sin rankings ni comparaciones entre gente. Hay tests que lo verifican.
- **Español de Argentina**, sin jerga técnica. Un error **nunca** muestra el mensaje crudo de la
  base: todo pasa por `mensajeUsuario` de `src/lib/fallas.ts`.
- **Comentarios en español que explican el POR QUÉ**, no el qué.
- Tamaños de texto: sólo la escala `text-2xs`…`text-4xl`. Nunca `text-[Npx]` (hay guardián).
- Tarjetas con `<Panel>`. Colores sólo de las variables de `src/index.css`.
- **Nunca editar JSX con `sed` ni regex.** Ya rompió archivos en este proyecto.
- **TDD**: test primero, verificar que falla **por la razón esperada**, después implementar.
- Migraciones **idempotentes** (`if not exists`, `drop policy if exists`), con su
  `insert into public.schema_migrations` al final y su número en `MIGRACIONES_ESPERADAS`.
- RLS: `using` y `with check` dicen **lo mismo**. Nunca subconsulta a `profiles` dentro de una
  policy de `profiles`.
- Entorno: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`. `git commit` con
  **timeout 420000**. Códigos de salida: `cmd > /tmp/log 2>&1; echo "EXIT: $?"`.
- Publicar: **`git push origin main` funciona**. Antes, los cuatro comandos en 0 y la entrada del
  `CHANGELOG` en `src/lib/version.ts`.

---

# FASE A — Las dos reglas que faltan

Va primero porque es deuda, no mejora. `CLAUDE.md` §2: no se construye encima de algo inestable.

## El hallazgo que cambia el diseño

**Hay SEIS lugares que ponen una tarea en "Terminado":**

| # | Dónde | Cómo |
|---|---|---|
| 1 | `src/features/board/Board.tsx:196` | arrastrar la tarjeta |
| 2 | `src/features/board/card/ChecklistSection.tsx:58` | completar el último ítem la cierra sola |
| 3 | `src/features/board/card/MetaSection.tsx:88` | el selector de estado |
| 4 | `src/features/board/CardModal.tsx:257` | el botón "Marcar terminada" |
| 5 | `src/features/board/EstancadaPrompt.tsx:48` | el aviso de tarea estancada |
| 6 | `src/lib/cierre-rapido.ts:65` | el cierre rápido de Mi día |

Sólo el 1 y el 4 miran el checklist hoy. **Un gate en un lugar es un gate en ninguno**: alcanza
con usar otro camino para saltearlo, y nadie lo va a hacer a propósito — simplemente van a cerrar
la tarea desde donde les quede más cómodo.

Por eso la regla vive en **dos lugares y no en seis**: una función que usan los seis, y un
**trigger de base** que es el que de verdad manda. El front existe para que la persona no choque
contra la pared; el trigger, para que la pared exista.

---

## Task A1: La regla de transición, como función pura

**Archivos:**
- Crear: `src/lib/transicion.ts`, `src/lib/transicion.test.ts`

**Interfaces:**
- Produce: `function bloqueoDeTransicion(c: Card, hasta: Status): string | null` — `null` si se
  puede; si no, el motivo en lenguaje de usuario.
- Produce: `function puedeCerrar(c: Card): boolean`

- [ ] **Paso 1: Escribir el test**

```ts
import { describe, it, expect } from "vitest";
import { bloqueoDeTransicion, puedeCerrar } from "./transicion";
import type { Card } from "./types";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "Conciliación", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2026-08-01T00:00:00Z", ...over,
  };
}

describe("de dónde a dónde se puede mover una tarea", () => {
  it("de Pendiente a En proceso, sí", () => {
    expect(bloqueoDeTransicion(card({ status: "pend" }), "proc")).toBeNull();
  });

  // LA REGLA QUE PIDIÓ EL DUEÑO. Saltar de Pendiente a Terminado significa que la tarea nunca
  // estuvo "en proceso", y entonces el tiempo de ciclo de TODO el equipo se calcula sobre una
  // ficción: `proc_at` queda en null y la tarea figura resuelta en cero horas.
  it("de Pendiente a Terminado, NO", () => {
    const m = bloqueoDeTransicion(card({ status: "pend" }), "term");
    expect(m).toContain("En proceso");
  });

  it("de En proceso a Terminado, sí", () => {
    expect(bloqueoDeTransicion(card({ status: "proc" }), "term")).toBeNull();
  });

  it("volver atrás siempre se puede", () => {
    // Reabrir es legítimo y ya se registra como reapertura en el historial. Bloquearlo
    // empujaría a crear una tarea nueva, y ahí se pierde el rastro de que fue la misma.
    expect(bloqueoDeTransicion(card({ status: "term" }), "proc")).toBeNull();
    expect(bloqueoDeTransicion(card({ status: "term" }), "pend")).toBeNull();
    expect(bloqueoDeTransicion(card({ status: "proc" }), "pend")).toBeNull();
  });

  it("quedarse donde está no es una transición", () => {
    expect(bloqueoDeTransicion(card({ status: "pend" }), "pend")).toBeNull();
  });
});

describe("el checklist tiene que estar completo para cerrar", () => {
  const conChecklist = (hechos: number, total: number, status: Card["status"] = "proc") =>
    card({
      status,
      checklist: Array.from({ length: total }, (_, i) => ({
        txt: `paso ${i}`, done: i < hechos, done_at: i < hechos ? "2026-08-10T12:00:00Z" : null,
      })),
    });

  // SIN FLAG. Antes esto dependía de `exige_checklist`, que arranca en false y sólo se podía
  // prender al crear la tarea: ninguna tarea existente lo tenía, así que la regla no existía
  // en la práctica. Si alguien escribió un checklist, es porque esos pasos hay que hacerlos.
  it("con pasos sin marcar, NO se puede cerrar", () => {
    const m = bloqueoDeTransicion(conChecklist(2, 5), "term");
    expect(m).toContain("3");
  });

  it("con todos los pasos marcados, sí", () => {
    expect(bloqueoDeTransicion(conChecklist(5, 5), "term")).toBeNull();
  });

  it("sin checklist no hay nada que completar", () => {
    // Bloquear acá sería un callejón sin salida: la persona no puede completar una lista vacía.
    expect(bloqueoDeTransicion(card({ status: "proc", checklist: [] }), "term")).toBeNull();
  });

  it("el checklist no estorba para volver atrás", () => {
    expect(bloqueoDeTransicion(conChecklist(2, 5, "term"), "proc")).toBeNull();
  });

  it("dice CUÁNTOS faltan, no sólo que no se puede", () => {
    // Un "no se puede cerrar" genérico obliga a abrir la tarea para averiguar por qué.
    expect(bloqueoDeTransicion(conChecklist(4, 5), "term")).toContain("1");
  });
});

describe("puedeCerrar", () => {
  it("es el atajo para el botón: false si algo bloquea", () => {
    expect(puedeCerrar(card({ status: "pend" }))).toBe(false);
    expect(puedeCerrar(card({ status: "proc" }))).toBe(true);
  });
});

describe("ante datos rotos no bloquea", () => {
  // Una tarea que no se puede cerrar por un dato corrupto es peor que una que se cierra de más:
  // la segunda se arregla, la primera deja a alguien trabado sin entender por qué.
  it("sin card, sin bloqueo", () => {
    expect(bloqueoDeTransicion(null as unknown as Card, "term")).toBeNull();
  });

  it("checklist que no es lista, sin bloqueo", () => {
    expect(bloqueoDeTransicion(card({ status: "proc", checklist: "x" as never }), "term")).toBeNull();
  });
});
```

- [ ] **Paso 2: Correr y verificar que falla por la razón esperada**

```bash
npx vitest run src/lib/transicion.test.ts > /tmp/tr.log 2>&1; echo "EXIT: $?"; tail -12 /tmp/tr.log
```

Esperado: FAIL con `bloqueoDeTransicion is not a function`.

- [ ] **Paso 3: Implementar**

```ts
import type { Card, Status } from "./types";

// Las dos reglas de estado del tablero, en UN solo lugar.
//
// POR QUÉ ACÁ Y NO EN CADA PANTALLA. Hay SEIS caminos que ponen una tarea en "Terminado":
// arrastrarla, el selector del modal, el botón "Marcar terminada", completar el último ítem del
// checklist, el aviso de tarea estancada y el cierre rápido de Mi día. Antes sólo dos miraban el
// checklist. Un gate en un lugar es un gate en ninguno: alcanza con usar otro camino para
// saltearlo, y nadie lo hace a propósito — simplemente cierran desde donde les queda más cómodo.

/** Orden del tablero. `pend` -> `proc` -> `term`. */
const ORDEN: Record<Status, number> = { pend: 0, proc: 1, term: 2 };

function items(c: Card): { done?: boolean }[] {
  return Array.isArray(c?.checklist) ? c.checklist : [];
}

/**
 * ¿Cuántos pasos del checklist faltan? `0` si no hay checklist o está completo.
 */
export function pasosQueFaltan(c: Card): number {
  const lista = items(c);
  if (lista.length === 0) return 0;
  return lista.filter((i) => i?.done !== true).length;
}

/**
 * `null` si la tarea puede pasar a `hasta`; si no, el motivo en lenguaje de usuario.
 *
 * REGLA 1 — NO SE SALTA "EN PROCESO". Pasar de Pendiente a Terminado significa que la tarea
 * nunca estuvo en proceso, y ahí `proc_at` queda en null: el tiempo de ciclo del equipo se
 * calcula sobre una ficción y la tarea figura resuelta en cero horas. Además borra la única
 * señal de que alguien la estaba haciendo, que es lo que mira el resumen del jefe.
 *
 * REGLA 2 — EL CHECKLIST VA COMPLETO. Sin flag y sin excepciones: si alguien se tomó el trabajo
 * de escribir los pasos, es porque esos pasos hay que hacerlos. Antes esto dependía de
 * `exige_checklist`, que arranca en `false` y sólo se podía prender al crear la tarea — ninguna
 * tarea existente lo tenía, así que la regla no existía en la práctica.
 *
 * VOLVER ATRÁS NUNCA SE BLOQUEA. Reabrir es legítimo, ya queda registrado como reapertura y se
 * mide en el índice de retrabajo. Bloquearlo empujaría a crear una tarea nueva, y ahí se pierde
 * el rastro de que era la misma.
 */
export function bloqueoDeTransicion(c: Card, hasta: Status): string | null {
  if (!c || !hasta) return null;
  const desde = c.status;
  if (desde === hasta) return null;
  // Sólo se controla ir hacia adelante. Todo lo que retrocede pasa.
  if (ORDEN[hasta] < ORDEN[desde]) return null;

  if (hasta === "term" && desde === "pend") {
    return "Antes de terminarla, pasala a En proceso.";
  }

  if (hasta === "term") {
    const faltan = pasosQueFaltan(c);
    if (faltan === 1) return "Falta 1 paso del checklist.";
    if (faltan > 1) return `Faltan ${faltan} pasos del checklist.`;
  }

  return null;
}

/** Atajo para deshabilitar un botón de cerrar. */
export function puedeCerrar(c: Card): boolean {
  return bloqueoDeTransicion(c, "term") === null;
}
```

- [ ] **Paso 4: Correr y verificar que pasa**

```bash
npx vitest run src/lib/transicion.test.ts > /tmp/tr.log 2>&1; echo "EXIT: $?"; grep -E "Tests " /tmp/tr.log
```

Esperado: EXIT 0, 15 tests.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/transicion.ts src/lib/transicion.test.ts
git commit -m "feat: las dos reglas de estado del tablero, en una sola funcion"
```

---

## Task A2: Conectar la regla a los seis caminos

**Archivos:**
- Modificar: `src/features/board/Board.tsx:191-196`
- Modificar: `src/features/board/card/ChecklistSection.tsx:58`
- Modificar: `src/features/board/card/MetaSection.tsx:79-95`
- Modificar: `src/features/board/CardModal.tsx:255-266`
- Modificar: `src/features/board/EstancadaPrompt.tsx:48`
- Modificar: `src/lib/cierre-rapido.ts`
- Crear: `src/lib/transicion.guard.test.ts`

**Interfaces:**
- Consume: `bloqueoDeTransicion`, `puedeCerrar` de `src/lib/transicion.ts`

- [ ] **Paso 1: El guardián, ANTES de tocar los seis**

Es lo que impide que el séptimo camino nazca sin gate, que es exactamente cómo llegamos acá.

```ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Guardián: todo archivo que ponga una tarea en "Terminado" tiene que consultar la regla.
//
// POR QUÉ EXISTE. Cuando esto se escribió había SEIS caminos que cerraban una tarea y sólo DOS
// miraban el checklist. No fue negligencia: cada camino se agregó en un momento distinto, y el
// que lo agregaba no sabía que existían los otros cinco.
//
// Este test no verifica que la regla se aplique bien —para eso está `transicion.test.ts`—, sino
// que nadie escriba un camino nuevo sin enterarse de que la regla existe.

const RAIZ = "src";
/** Archivos que escriben `status: "term"` a propósito y NO son un camino de usuario. */
const EXENTOS = [
  "src/lib/transicion.ts",          // es la regla misma
];

function fuentes(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) fuentes(ruta, acc);
    else if (/\.(ts|tsx)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) acc.push(ruta);
  }
  return acc;
}

describe("ningún camino cierra una tarea sin consultar la regla", () => {
  it("todo archivo que escribe status term importa transicion", () => {
    const culpables: string[] = [];
    for (const ruta of fuentes(RAIZ)) {
      const rel = ruta.replace(/\\/g, "/");
      if (EXENTOS.includes(rel)) continue;
      const src = readFileSync(ruta, "utf8");
      const cierra = /status:\s*["']term["']/.test(src);
      if (!cierra) continue;
      const consulta = /from\s+["'][^"']*\/transicion["']/.test(src)
        || /from\s+["']\.\/transicion["']/.test(src);
      if (!consulta) culpables.push(rel);
    }

    expect(culpables, [
      "Estos archivos ponen una tarea en Terminado sin consultar `bloqueoDeTransicion`.",
      "Importalo de src/lib/transicion.ts y avisá antes de cerrar. Si de verdad este archivo",
      "no es un camino de usuario, agregalo a EXENTOS acá arriba con el motivo al lado.",
    ].join(" ")).toEqual([]);
  });
});
```

- [ ] **Paso 2: Correr el guardián y ver los seis**

```bash
npx vitest run src/lib/transicion.guard.test.ts > /tmp/g.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/g.log
```

Esperado: FAIL, listando `Board.tsx`, `ChecklistSection.tsx`, `MetaSection.tsx`, `CardModal.tsx`,
`EstancadaPrompt.tsx`, `cierre-rapido.ts`. **Anotá la lista**: es la que hay que dejar vacía.

- [ ] **Paso 3: Board.tsx — el arrastre**

Ya usa `motivoChecklist`. Reemplazarlo por la regla completa, alrededor de `Board.tsx:191`:

```tsx
        // La regla vive en `transicion.ts` y la consultan los seis caminos que cierran una
        // tarea. Antes acá se miraba sólo el checklist, así que arrastrar de Pendiente a
        // Terminado saltaba "En proceso" sin que nada avisara.
        const falta = bloqueoDeTransicion(cardPrev, status);
        if (falta) { toast.error(falta); return; }
```

Y el import: `import { bloqueoDeTransicion } from "../../lib/transicion";`

- [ ] **Paso 4: ChecklistSection.tsx — el caso que hay que pensar**

Hoy, completar el último ítem **cierra la tarea sola** (`ChecklistSection.tsx:58`). Con la regla
1 eso es un problema: si la tarea está en Pendiente, la cerraría saltando En proceso.

La solución **no** es bloquear: es que al completar el checklist de una tarea Pendiente, pase a
**En proceso** en vez de a Terminado. Cerrarla queda a un click.

```tsx
      // Completar el checklist ya no cierra una tarea que nunca estuvo En proceso: la ADELANTA.
      // Cerrarla queda a un click, y así el tiempo de ciclo deja de calcularse sobre una tarea
      // que figura resuelta sin haber estado nunca en curso.
      ? c.status === "pend"
        ? { checklist: list, status: "proc", proc_at: new Date().toISOString(), history: hist("Completó checklist") }
        : { checklist: list, status: "term", done_at: new Date().toISOString(), history: hist("Completó checklist") }
```

- [ ] **Paso 5: MetaSection.tsx — el selector**

Alrededor de `MetaSection.tsx:81`, antes de cualquier `patch.mutate`:

```tsx
                const s = e.target.value as Card["status"];
                const falta = bloqueoDeTransicion(c, s);
                if (falta) {
                  toast.error(falta);
                  // Devolver el selector a donde estaba: si se queda mostrando el valor que no
                  // se guardó, la persona cree que sí se guardó.
                  e.target.value = c.status;
                  return;
                }
```

- [ ] **Paso 6: CardModal.tsx, EstancadaPrompt.tsx y cierre-rapido.ts**

En `CardModal.tsx:257` ya hay un `disabled={checklistIncompleto(c)}`: cambiarlo por
`disabled={!puedeCerrar(c)}` y el texto de al lado por `bloqueoDeTransicion(c, "term")`.

En `EstancadaPrompt.tsx:48` y en `cierre-rapido.ts`, consultar antes de escribir y devolver el
motivo en vez de cerrar. `cierre-rapido.ts` es una lib pura: que devuelva `string | null` como
las demás y que la pantalla muestre el mensaje.

- [ ] **Paso 7: El guardián en verde y la suite entera**

```bash
npx vitest run > /tmp/v.log 2>&1; echo "EXIT: $?"; grep -E "Tests |FAIL" /tmp/v.log | head -6
npx tsc -b > /tmp/t.log 2>&1; echo "TSC: $?"
npx oxlint > /tmp/l.log 2>&1; echo "LINT: $?"
```

**Si algún test existente se da vuelta, NO lo ajustes para que pase.** Analizá si el aserto viejo
era correcto: es probable que alguno cierre una tarea desde Pendiente en su fixture, y eso ahora
es un caso inválido. Reescribí el fixture documentando por qué cambió.

- [ ] **Paso 8: Commit**

```bash
git add src/lib/transicion.guard.test.ts src/features/board/ src/lib/cierre-rapido.ts
git commit -m "fix: los seis caminos que cierran una tarea ahora consultan la misma regla"
```

---

## Task A3: El trigger, que es la regla de verdad

**Archivos:**
- Crear: `db/migraciones/migracion-53-reglas-de-estado.sql`
- Modificar: `src/lib/migraciones.ts`
- Modificar: `src/lib/fallas.ts`
- Modificar: `src/lib/fallas.test.ts`

**Por qué también en la base:** el front se puede saltear. Hay siete caminos de creación de
tareas y seis de cierre; el próximo se va a escribir sin mirar. Además la app tiene mutaciones
optimistas: si el front deja pasar algo que la base rechaza, la tarjeta se mueve y vuelve sola, y
eso se ve como un bug. Con el trigger, la regla es una sola y el front es cortesía.

- [ ] **Paso 1: La migración**

```sql
-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 53
--  Las dos reglas de estado, del lado de la base.
-- ============================================================================
--
--  POR QUÉ UN TRIGGER Y NO ALCANZA CON EL FRONT
--
--  Hay SEIS caminos en la app que ponen una tarea en "Terminado", y hasta hoy sólo dos miraban
--  el checklist. No fue negligencia: cada uno se agregó en un momento distinto y quien lo
--  agregaba no sabía de los otros cinco. El séptimo va a nacer igual.
--
--  El front sigue existiendo para avisar ANTES, que es lo que hace que la regla no se sienta
--  como una pared. Esto es lo que hace que la pared exista.
-- ============================================================================

create or replace function public.cards_validar_estado() returns trigger
language plpgsql as $$
declare
  sin_marcar int;
begin
  -- Sólo interesa lo que AVANZA hacia terminado. Reabrir siempre se puede: ya queda registrado
  -- como reapertura y se mide en el índice de retrabajo.
  if new.status <> 'term' or old.status = 'term' then
    return new;
  end if;

  -- REGLA 1: no se salta "En proceso".
  if old.status = 'pend' then
    raise exception 'regla_estado: Antes de terminarla, pasala a En proceso.';
  end if;

  -- REGLA 2: el checklist va completo. Sin checklist no hay nada que completar.
  select count(*) into sin_marcar
    from jsonb_array_elements(coalesce(new.checklist, '[]'::jsonb)) item
   where coalesce((item->>'done')::boolean, false) = false;

  if sin_marcar > 0 then
    raise exception 'regla_estado: Faltan % pasos del checklist.', sin_marcar;
  end if;

  return new;
end;
$$;

drop trigger if exists cards_validar_estado on public.cards;
create trigger cards_validar_estado
  before update of status on public.cards
  for each row execute function public.cards_validar_estado();

insert into public.schema_migrations (id, nombre)
  values (53, 'migracion-53-reglas-de-estado.sql')
  on conflict (id) do nothing;
```

- [ ] **Paso 2: Que el mensaje llegue en castellano y no como error de Postgres**

El prefijo `regla_estado:` es un **código**, no un mensaje. Agregar a `clasificarFalla` en
`src/lib/fallas.ts` una rama que lo reconozca y devuelva el texto que sigue al prefijo, con su
test en `fallas.test.ts`:

```ts
  it("una regla de estado de la base llega en castellano, sin el prefijo", () => {
    const e = new Error('regla_estado: Antes de terminarla, pasala a En proceso.');
    const m = mensajeUsuario(e, "mover la tarea");
    expect(m).toBe("Antes de terminarla, pasala a En proceso.");
    expect(m).not.toContain("regla_estado");
  });
```

- [ ] **Paso 3: `53` en `MIGRACIONES_ESPERADAS`, y el guardián en verde**

```bash
npx vitest run src/lib/migraciones.guard.test.ts > /tmp/mg.log 2>&1; echo "EXIT: $?"
```

- [ ] **Paso 4: Los cuatro comandos y commit**

```bash
git add db/migraciones/migracion-53-reglas-de-estado.sql src/lib/migraciones.ts src/lib/fallas.ts src/lib/fallas.test.ts
git commit -m "feat: las reglas de estado tambien en la base, porque el front se puede saltear"
```

**LO QUE TIENE QUE CORRER EL DUEÑO:** `db/migraciones/migracion-53-reglas-de-estado.sql`.

**AVISO IMPORTANTE PARA EL DUEÑO, y va en el commit:** desde que se corra, las tareas que hoy
tienen checklist a medias **no se van a poder cerrar** hasta completarlo. Es el efecto buscado,
pero conviene decírselo al equipo antes y no que lo descubran un día 30.

---

# FASE B — Unificación de criterios

**El problema, con las palabras del dueño:** *"Juan hace las conciliaciones de Chevrolet, pero su
descripción no es como la de Valentino. Si son las mismas tareas, diferente empresa o marca,
deberíamos tenerlo igual para que mi jefe pueda comparar y además para que nos sirva de dato
general."*

**Por qué hoy no pasa.** Hay **siete** caminos que crean tareas (`Admin.tsx`, `Board.tsx`,
`CardModal.tsx`, `DelegarModal.tsx`, `NuevaTareaModal.tsx`, `Cierre.tsx`, `Notas.tsx`) y en seis
de ellos el título y la descripción son texto libre. Lo único parecido a un estándar es
`plantilla.ts`, que es una lista plana en `settings` para el cierre mensual: sirve para generar
las tareas del mes, no para definir **qué es** una tarea.

**La idea:** un catálogo de **tareas estándar**. Una definición canónica —título, descripción,
checklist, categoría, esfuerzo sugerido, tiempo máximo— que se instancia para una marca, una
empresa y una persona. La tarea concreta guarda de qué definición salió.

Eso da tres cosas que hoy no existen: el jefe compara peras con peras, el dato general tiene
sentido, y **quien crea una tarea no tiene que inventar la descripción**.

## Task B1: La tabla del catálogo

**Archivos:**
- Crear: `db/migraciones/migracion-54-catalogo-tareas.sql`
- Modificar: `src/lib/migraciones.ts`, `src/lib/types.ts`, `src/lib/esquema.ts`

Tabla `tareas_estandar`: `id`, `nombre` (único), `descripcion`, `checklist jsonb`, `categoria`,
`effort`, `tiempo_max_horas`, `activa boolean default true`, `created_at`.

Y en `cards`: `estandar_id uuid references tareas_estandar(id) on delete set null`.

**`on delete set null` y no `cascade`:** borrar una definición del catálogo no puede borrar las
tareas que salieron de ella. Pierden el vínculo, no la existencia.

RLS: lee cualquiera con sesión (todos crean tareas); escribe sólo el jefe (cambiar una definición
cambia cómo se llama el trabajo de todos).

`estandar_id` tiene que entrar en `COLUMNAS_CARDS` de `src/lib/esquema.ts`, o PostgREST falla el
update entero con 42703.

## Task B2: La pantalla del catálogo en Administración

**Archivos:**
- Crear: `src/features/admin/CatalogoTareas.tsx`
- Crear: `src/lib/catalogo.ts`, `src/lib/catalogo.test.ts`
- Modificar: `src/features/admin/Admin.tsx`, `src/hooks/useData.ts`

Alta, edición y baja lógica (`activa = false`, nunca borrado físico: las tareas viejas siguen
apuntando ahí). Sólo el jefe, mismo gate que las demás secciones de Admin.

La lib decide qué se copia al instanciar:

```ts
export function desdeEstandar(
  e: TareaEstandar, owner: string, marca: string | null, sucursal: string | null,
): Partial<Card>
```

**El checklist se copia, no se referencia.** Si se referenciara, cambiar la definición cambiaría
las tareas ya cerradas del mes pasado y el histórico dejaría de reflejar lo que se hizo.

## Task B3: Crear desde el catálogo

**Archivos:**
- Modificar: `src/features/board/NuevaTareaModal.tsx`

Un selector arriba de todo: **"¿Es una tarea estándar?"**. Al elegir una, se completan título,
descripción, checklist, categoría y esfuerzo, **editables** — si no se pudieran editar, el primer
caso que no encaje va a crearse por afuera y el catálogo muere en dos semanas.

La tarea guarda `estandar_id`. Ese campo es lo que después permite comparar.

## Task B4: Ver qué NO está estandarizado

**Archivos:**
- Crear: `src/lib/cobertura-estandar.ts` + test
- Modificar: `src/features/reporte/AnalisisMensual.tsx`

Una línea en el análisis: *"38 de 52 tareas del mes salen del catálogo."* Y la lista de títulos
repetidos que **no** tienen `estandar_id` — que son las candidatas obvias a estandarizar.

**Encuadre no punitivo, y acá hay que tener cuidado:** el dato es **por título repetido**, nunca
por persona. "Juan tiene 8 tareas sin estandarizar" es un ranking encubierto; "hay 6 tareas
llamadas 'Conciliación' que no salen del catálogo" describe el proceso.

---

# FASE C — Bloqueo por área externa

**El pedido:** *"añadir dependencia de otras áreas, pero sin implicarlas, porque no van a usar la
aplicación por el momento; pero estaría bueno marcar que si algo está trabado sea por otra área.
Ej: ventas, administración, recursos humanos."*

Hoy `deps` es tarea-a-tarea (`src/lib/deps.ts`) y sólo funciona entre tareas que existen en la
app. Para un área que no la usa hace falta otra cosa: no una dependencia, sino **una espera
registrada**.

## Task C1: El campo y la lib

**Archivos:**
- Crear: `db/migraciones/migracion-55-bloqueo-area.sql`
- Crear: `src/lib/bloqueo-area.ts` + test
- Modificar: `src/lib/types.ts`, `src/lib/esquema.ts`, `src/lib/migraciones.ts`

En `cards`: `bloqueo_area text` (null = no bloqueada) y `bloqueo_desde timestamptz`.

Las áreas salen de una lista configurable en `settings` (como marcas y sucursales, que ya son
dinámicas): Ventas, Administración, Recursos Humanos, Sistemas, Fábrica. **Que no sea una lista
fija en el código** — la primera vez que aparezca "Posventa" nadie va a poder agregarla.

`bloqueo_desde` es lo que da valor al dato: sin fecha, "bloqueada por Ventas" es una etiqueta;
con fecha, es *"hace 6 días hábiles que espera a Ventas"*, y eso es accionable.

Usar `diasHabilesTranscurridos` de `src/lib/dias-habiles.ts`, no días corridos — misma razón que
en `estancadas.ts`.

## Task C2: En la tarjeta, en el tablero y en el resumen

**Archivos:**
- Modificar: `src/features/board/card/MetaSection.tsx`, `src/features/board/CardItem.tsx`
- Modificar: `src/features/resumen/Resumen.tsx`
- Modificar: `src/lib/alertas.ts` + test

Un chip en la tarjeta: **"Espera a Ventas · 6 días"**. Y en el resumen del jefe, agrupado por
área: *"4 tareas esperan a Ventas, la más vieja hace 11 días."*

**Ése es el valor real de toda la fase**, y conviene decirlo: hoy cuando el trabajo se traba por
otra área, esa demora aparece como demora del equipo contable. El jefe ve tareas quietas y no
tiene cómo saber que la pelota está afuera. Esto lo separa.

**Lo que NO hace:** no notifica a esas áreas, no les crea usuarios, no les manda nada. Es un
registro interno. Meterlas ahora sería construir para usuarios que no existen.

---

# FASE D — Productividad del empleado: investigación, no implementación

**El pedido:** *"ayudarle a organizarse aún más, más allá de poder asignar puntos, peso y un
objetivo para las tareas, quiero que investigues qué se puede mejorar"* y *"marcar una ruta en el
mes"*.

**Esta fase NO trae código, y es a propósito.** Es la única parte del pedido donde no hay una
respuesta correcta deducible: depende de cómo trabaja el equipo, y eso lo sabés vos. Escribir
código acá sin decidir antes es cómo se construyen funciones que nadie usa — el proyecto ya tiene
una vista materializada que nadie mira y un cronómetro que el análisis desaconsejó.

**Entregable:** `docs/PROPUESTAS-PRODUCTIVIDAD.md`, con cada propuesta trayendo **qué mide, a
quién ayuda y cuándo se descarta si no sirvió** — el criterio del paso 3 de `CLAUDE.md` §2. Sin
fecha de descarte no entra: una propuesta sin revisión es un compromiso permanente disfrazado de
experimento.

Las líneas a investigar, con lo que ya sé de cada una:

1. **La ruta del mes.** Hoy el tablero muestra lo que hay; no muestra *por dónde va el mes*. Con
   `dias-habiles.ts` y los vencimientos ya se puede decir "vas por el día 8 de 21 y tenés el 60%
   del cierre pendiente". Es lo más cerca de lo que pediste y lo más barato: los dos insumos
   existen.
2. **El orden del día ya existe a medias.** `Mi día` prioriza, y el jefe puede configurar qué
   pesa más. Lo que falta es que la persona vea **por qué** ese orden y pueda discutirlo.
3. **Bloques de trabajo.** Agrupar tareas parecidas para hacerlas juntas (todas las
   conciliaciones un martes) en vez de saltar de tipo en tipo. El catálogo de la Fase B es
   justamente lo que lo hace posible.
4. **Lo que NO recomiendo, y conviene que quede escrito:** cronómetros y medición de tiempo por
   persona. Está desaconsejado en `docs/PROPUESTA-ICR.md` y choca de frente con el encuadre no
   punitivo. Si el equipo lo percibe como control, van a trabajar para la foto.

---

# FASE E — Lo técnico: qué mejorar y qué reversionar

Medido hoy, no estimado.

| Qué | Medida | Propuesta |
|---|---|---|
| `Admin.tsx` | **701 líneas** | Partir por sección, como se hizo con `CardModal`. Es el archivo más grande y el que más crece. |
| `Board.tsx` | 585 líneas | Igual, después de la Fase A (que ya lo toca). |
| Código sin usar | **14 exports + 16 tipos** (`npx knip`) | Borrar. Incluye `useResumenMensual`, que apunta a la vista materializada que nadie usa. |
| `mv_resumen_mensual` | existe, **cero consumidores** | Decidir: arreglarla (le faltan `sucursal`, `categoria` y el filtro de operativas) o borrarla. Mantener algo que nadie usa cuesta cada vez que alguien lo lee y se pregunta si importa. |
| Bundle inicial | `index` 566 kB (163 kB gz) | El `xlsx` (424 kB) ya está partido. El resto es el precio de la app. No lo tocaría todavía. |
| Migraciones | 39 archivos hasta la 52 | Están ordenadas y con guardián. Bien. |

**Lo que NO reversionaría**, y vale decirlo para que no se gaste tiempo: el sistema visual
(`Panel` + escala de tipografía, con sus dos guardianes), la capa de gateado defensivo
(`esquema.ts`) y el encuadre no punitivo con sus tests. Los tres se ganaron rompiendo algo.

---

# Lo que este plan NO hace

- **No unifica los siete caminos de creación de tareas.** Es un problema real y grande. La Fase B
  le pone un estándar encima sin tocar los caminos; unificarlos es otro plan.
- **No toca la jerarquía de un solo nivel.** Sigue anotada como causa probable de los errores de
  permisos que reportaron Mathi y Enzo.
- **No agrega usuarios de otras áreas.** La Fase C registra la espera; no involucra a Ventas.

---

# Orden, y por qué

1. **Fase A primero, entera.** Es deuda, y las dos reglas cambian cómo se cierra una tarea: todo
   lo que se construya encima tiene que asumir el flujo nuevo.
2. **Fase C después**, que es chica y no depende de nada.
3. **Fase B**, que es la más grande y la que más cambia la costumbre del equipo.
4. **Fase D** en paralelo con B — es investigación, no bloquea.
5. **Fase E** al final, salvo el borrado de código muerto, que se puede hacer cuando sea.

---

# Qué decirle al equipo cuando esto salga

Dos cosas van a cambiar de un día para el otro y conviene avisarlas antes:

- **Una tarea ya no se puede marcar terminada directo desde Pendiente.** Hay que pasarla a En
  proceso. No es burocracia: es lo que hace que el tiempo que lleva una tarea sea un dato real y
  no un cero.
- **Si una tarea tiene checklist, va completo para cerrarla.** Si alguien escribió esos pasos,
  es porque hay que hacerlos. Y si un paso ya no corresponde, se saca de la lista — eso siempre
  se puede.
