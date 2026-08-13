# Reportes del equipo — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development o
> superpowers:executing-plans. Los pasos usan casillas `- [ ]`.

**Objetivo:** Cerrar los diez problemas que reportaron Yani, Mathi, Enzo, Patricia y Valentino.

**Arquitectura:** Tres frentes. (A) El motor de recurrencias, que existe y nunca estuvo
conectado. (B) Lo que ya está arreglado y hay que confirmar con quien lo reportó. (C) Lo nuevo:
arqueos unificados, transferencias, feriados, columnas plegables, adjuntar captura.

**Stack:** React 19 · TypeScript 6 · Vite 8 · Supabase (Postgres + RLS + pg_cron) · vitest.

---

## Antes de empezar: tres de los seis reportes no son lo que parecen

Esto se verificó contra el código antes de escribir el plan, y cambia qué hay que hacer.

### El motor de recurrencias EXISTE. Nunca estuvo enchufado.

El reporte concluye que falta implementar el scheduler. No falta: sobra.

| Cuándo | Qué pasó |
|---|---|
| v1 | Se programó `cron.schedule('reset-recurrentes', …, 'select reset_recurring()')` |
| Migración 24 | Se escribió `reset_recurrentes_seguro()`, que sí mira `recur_rule`. **Nadie movió el cron** |
| Migración 29 | Se mejoró otra vez. El cron siguió igual |
| Migración 37 | Se escribió la línea correcta del cron… **dentro de un comentario** |
| Migración 43 | Se borró `reset_recurring()` por destructiva. **El cron quedó apuntando a la nada** |

`reset_recurring()` sólo mira `where recurring` —el tilde de "mensual"— y **no sabe nada de
`recur_rule`**, que es donde viven las recurrencias diaria y semanal. Por eso la tarea de los
jueves de Yani nunca volvió: ningún proceso la miraba. Nunca.

**Y desde la migración 43 el reinicio mensual falla entero**, porque llama a una función borrada.
Eso es responsabilidad de quien escribió la 43 y se arregla primero.

### El error de RLS (punto 2.1) probablemente ya está arreglado

Las migraciones 36 y 42 —**ya aplicadas**— agregaron exactamente lo que falta:

- `task_occurrences`: policy `occ del equipo`, con `es_encargado_de(owner)` (migración 36)
- `cards` INSERT: policy `encargado crea cards de su equipo` (migración 42, §1)

La migración 42 es del 07/08. Si Mathi y Enzo reportaron antes de esa fecha, **el error ya no
debería aparecer**. Confirmarlo antes de tocar nada: arreglar dos veces lo mismo es peor que no
arreglar, porque deja policies duplicadas que después nadie entiende.

### El desfasaje de fechas (punto 3.1) probablemente NO es de zona horaria

El reporte dice que una tarea del 14/08 aparece en el tablero del 13/08, y lo atribuye al offset
GMT-3. Pero `src/lib/midia.ts:18-28` tiene tres reglas, no dos:

```ts
if (card.due_date && card.due_date < hoyISO) motivo = "vencida";
else if (card.due_date && card.due_date === hoyISO) motivo = "vence-hoy";
else if (card.priority === "alta") motivo = "alta";   // <- ésta
```

**Una tarea con prioridad alta aparece en Mi día todos los días, sin importar su vencimiento.**
Es una decisión de diseño —Mi día = vencidas + vencen hoy + urgentes— y explica el síntoma
exacto que describe Mathi.

Y el manejo de zona horaria está bien: `MiDia.tsx:114` hace
`toARTDate(new Date().toISOString())`, que es lo correcto.

O sea: **no hay bug de fecha, hay un bug de explicación.** La tarea aparece por un motivo válido
que la pantalla no dice. Se arregla mostrando el porqué, no tocando fechas.

**Antes de dar esto por cerrado**: pedirle a Mathi el título exacto de esa tarea y confirmar que
tiene prioridad alta. Si no la tiene, entonces sí hay un bug de fecha y hay que buscarlo en
serio.

### El checklist obligatorio (punto 5.3) está a medio construir

Lo que ya está: la lib `src/lib/checklist-gate.ts` con 11 tests, la columna
`cards.exige_checklist` (migración 41, aplicada), y el bloqueo del cierre rápido de Mi día.

Lo que falta: **el botón "Terminar" del modal no lo mira** (0 usos de `checklistIncompleto` en
`CardModal.tsx`) y **no hay casilla para activarlo** al crear o editar una tarea. O sea: la
regla existe y nadie puede encenderla ni la siente donde más se usa.

---

## Restricciones globales

- **Cero emojis** en texto de usuario. Iconos sólo de `lucide-react`.
- **Encuadre no punitivo.** Las métricas describen situaciones, nunca juzgan personas.
- **Español de Argentina**, sin jerga técnica. Un error nunca muestra el mensaje crudo de la base.
- **Comentarios en español que explican el POR QUÉ.**
- Comandos: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`, después `npx tsc -b`,
  `npx oxlint`, `npx vitest run`, `npx vite build`, `node scripts/peso.mjs`.
- Códigos de salida: `cmd > /tmp/log 2>&1; echo "EXIT: $?"; tail -30 /tmp/log`. Nunca `cmd | tail`.
- `git commit` con `timeout: 420000` — el hook corre tsc + toda la suite.
- **TDD**: test primero, verificar que falla **por la razón esperada**, después implementar.
- **Estado de migraciones**: `npm run migraciones` lo dice. No preguntar.

---

## Orden, y por qué

1. **El cron roto** va primero porque hoy está fallando en producción.
2. **La recurrencia semanal** es el reporte de tres personas y el que más duele.
3. **Confirmar lo ya arreglado** antes de tocarlo.
4. Después lo nuevo, por daño: checklist, arqueos, transferencias, y al final la interfaz.

---

# FASE A — Lo que está roto ahora

## Task A1: Correr la migración 45 y confirmar que el cron dejó de fallar

Ya está escrita: `db/migraciones/migracion-45-cron-recurrencias.sql`.

- [ ] **Paso 1: Correrla en Supabase → SQL Editor**

- [ ] **Paso 2: Verificar que los dos jobs apuntan a donde deben**

```sql
select jobname, schedule, active, command from cron.job order by jobname;
```

Esperado: `reset-recurrentes` → `5 3 1 * *` → `reset_recurrentes_seguro()`.
Si sigue diciendo `reset_recurring()`, la migración no corrió.

- [ ] **Paso 3: Mirar si venía fallando, que es el dato que faltaba hace meses**

```sql
select j.jobname, r.status, r.start_time, r.return_message
  from cron.job_run_details r join cron.job j on j.jobid = r.jobid
 order by r.start_time desc limit 20;
```

Si aparece `failed` con *"function public.reset_recurring() does not exist"*, ése es el error que
la 45 cierra. **Guardá esa salida**: es la evidencia de cuánto tiempo estuvo roto, y va al informe
del equipo.

- [ ] **Paso 4: Probar el reinicio sin esperar al día 1**

```sql
select public.reset_recurrentes_seguro();
```

Devuelve un texto con lo que hizo. Es idempotente.

---

## Task A2: Que una tarea semanal vuelva cada semana, no una vez por mes

**Éste es el reporte de Yani, y es el punto 1.2 del pedido.**

El reinicio mensual devuelve las recurrentes a Pendiente el día 1. Eso sirve para las mensuales.
Una tarea de los jueves tiene que volver **cada jueves**, y hoy no hay ninguna función que lo
haga.

**El comportamiento pedido, textual:** *"la tarea que había sido marcada como Finalizada en su
ciclo anterior debe volver a aparecer automáticamente en estado Pendiente"*, sin duplicar la
tarjeta, y dejando registro de que el ciclo anterior se completó.

**Archivos:**
- Crear: `src/lib/recurrencia-ciclo.ts`, `src/lib/recurrencia-ciclo.test.ts`
- Crear: `db/migraciones/migracion-46-ciclo-recurrente.sql`

**Interfaces:**
- Produce: `function tocaHoy(regla: RecurRule, fechaISO: string): boolean`
- Produce: `function proximoVencimiento(regla: RecurRule, desdeISO: string): string | null`

- [ ] **Paso 1: Leer la forma real de `recur_rule` antes de escribir nada**

```bash
grep -rn "recur_rule" src/lib/types.ts src/lib/recurrencia-alta.ts
```

No inventes la forma de la regla: usá la que ya guarda la app. Si tiene `tipo: "semanal"` y
`dias: number[]`, ésa es la que hay que interpretar.

- [ ] **Paso 2: Escribir el test que falla**

Crear `src/lib/recurrencia-ciclo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tocaHoy, proximoVencimiento } from "./recurrencia-ciclo";

describe("cuándo vuelve una tarea recurrente", () => {
  it("una semanal de los jueves toca un jueves", () => {
    // 2026-08-13 es jueves. `dias` usa la convención de getDay(): 0=domingo, 4=jueves.
    expect(tocaHoy({ tipo: "semanal", dias: [4] }, "2026-08-13")).toBe(true);
  });

  it("y no toca un miércoles", () => {
    expect(tocaHoy({ tipo: "semanal", dias: [4] }, "2026-08-12")).toBe(false);
  });

  it("una diaria toca todos los días", () => {
    expect(tocaHoy({ tipo: "diaria" }, "2026-08-12")).toBe(true);
    expect(tocaHoy({ tipo: "diaria" }, "2026-08-13")).toBe(true);
  });

  it("una mensual toca sólo su día del mes", () => {
    expect(tocaHoy({ tipo: "mensual", diaMes: 10 }, "2026-08-10")).toBe(true);
    expect(tocaHoy({ tipo: "mensual", diaMes: 10 }, "2026-08-11")).toBe(false);
  });

  it("el próximo vencimiento de una semanal salta al siguiente día marcado", () => {
    // Desde el jueves 13, la próxima es el jueves 20.
    expect(proximoVencimiento({ tipo: "semanal", dias: [4] }, "2026-08-13")).toBe("2026-08-20");
  });

  it("con varios días por semana toma el más cercano", () => {
    // Lunes y jueves. Desde el jueves 13, la próxima es el lunes 17.
    expect(proximoVencimiento({ tipo: "semanal", dias: [1, 4] }, "2026-08-13")).toBe("2026-08-17");
  });

  it("una regla rota no rompe nada: devuelve false y null", () => {
    // `recur_rule` es jsonb: puede llegar cualquier cosa. Ante la duda, no reactivar —
    // reactivar una tarea que no correspondía es peor que dejarla quieta un ciclo.
    expect(tocaHoy(null as never, "2026-08-13")).toBe(false);
    expect(tocaHoy({ tipo: "loquesea" } as never, "2026-08-13")).toBe(false);
    expect(proximoVencimiento(null as never, "2026-08-13")).toBeNull();
  });
});
```

- [ ] **Paso 3: Correr y verificar que falla por la razón esperada**

```bash
npx vitest run src/lib/recurrencia-ciclo.test.ts > /tmp/r.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/r.log
```

Esperado: EXIT 1, con `Failed to resolve import "./recurrencia-ciclo"`.

- [ ] **Paso 4: Implementar la lib**

Puro: sin `new Date()` adentro, la fecha entra por parámetro. Usar `toARTDate` si hace falta
convertir. Ante una regla mal formada, devolver `false` / `null` sin lanzar.

- [ ] **Paso 5: Correr el test**

```bash
npx vitest run src/lib/recurrencia-ciclo.test.ts > /tmp/r.log 2>&1; echo "EXIT: $?"; tail -6 /tmp/r.log
```

Esperado: EXIT 0, 7 tests.

- [ ] **Paso 6: La migración 46 con la función y su cron diario**

La función `public.ciclo_recurrente_diario()` tiene que, para cada card con `recur_rule` cuya
regla toque hoy y esté en `status = 'term'`:

1. **Escribir primero en `task_occurrences`** el registro de que el ciclo anterior se completó.
   Primero eso, después el update: si el update falla, no se pierde el registro; si se hiciera al
   revés, un fallo dejaría el ciclo cerrado sin evidencia.
2. **Actualizar la tarjeta**: `status = 'pend'`, `done_at = null`, checklist destildado,
   `due_date = proximoVencimiento`.
3. **Dejar una marca en `history`** que diga *"Nuevo ciclo"*, distinta del texto de reapertura
   manual. El pedido lo dice explícitamente y `src/lib/retrabajo.ts` cuenta las reaperturas: si
   el nuevo ciclo usara el mismo texto, **el índice de retrabajo se llenaría de reaperturas que
   nadie hizo**, y ese número se le muestra al jefe.

Programarla `10 3 * * *` (00:10 hora argentina, todos los días).

- [ ] **Paso 7: Verificar que el retrabajo no se ensucia**

```bash
npx vitest run src/lib/retrabajo.test.ts > /tmp/rt.log 2>&1; echo "EXIT: $?"; tail -4 /tmp/rt.log
```

Y agregar un test nuevo: una tarjeta cuyo historial tenga la marca de nuevo ciclo **no** cuenta
como reapertura.

- [ ] **Paso 8: Verificar todo y commitear**

```bash
npx tsc -b > /tmp/t.log 2>&1; echo "TSC: $?"
npx vitest run > /tmp/a.log 2>&1; echo "TESTS: $?"; tail -4 /tmp/a.log
git add src/lib/recurrencia-ciclo.ts src/lib/recurrencia-ciclo.test.ts db/migraciones/ src/lib/migraciones.ts
git commit -m "feat: una tarea semanal vuelve cada semana, no una vez por mes"
```

---

# FASE B — Confirmar antes de tocar

## Task B1: Preguntarle a Mathi y a Enzo si el error de RLS sigue pasando

**No escribas SQL para esto todavía.** Las migraciones 36 y 42 ya agregaron las policies que
faltaban, y la 42 se aplicó el 07/08.

- [ ] **Paso 1: Verificar que las policies están puestas en la base**

```sql
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('cards','task_occurrences')
   and (qual like '%es_encargado_de%' or with_check like '%es_encargado_de%')
 order by tablename, cmd;
```

Esperado: al menos `cards` INSERT/UPDATE/DELETE/SELECT y `task_occurrences` ALL.

- [ ] **Paso 2: Pedirles que lo reintenten, con la pregunta exacta**

> *"Volvé a probar crear la tarea operativa para Enzo. Si vuelve a fallar, decime el título exacto
> de la tarea, quién la estaba creando, y si el cartel dice `cards` o `task_occurrences`."*

- [ ] **Paso 3: Sólo si sigue fallando, buscar la causa**

El sospechoso siguiente es la jerarquía: `es_encargado_de()` mira **sólo reportes directos**
(`manager_id = auth.uid()`), mientras el front define equipo de forma recursiva. Si Enzo no le
reporta directo a quien crea la tarea, la base lo rechaza aunque la pantalla lo ofrezca. Está
documentado como hallazgo H7 de la revisión por roles.

Verificar con:

```sql
select p.name, p.role, m.name as le_reporta_a
  from public.profiles p left join public.profiles m on m.id = p.manager_id
 where p.name ilike '%enzo%';
```

---

## Task B2: Mi día tiene que decir por qué está ahí cada tarea

**Éste es el reporte de Mathi, y el arreglo no es de fechas.**

Una tarea con prioridad alta aparece en Mi día todos los días. Es correcto, y la pantalla no lo
explica — así que se lee como un error de fecha.

**Archivos:**
- Modificar: `src/features/hoy/MiDia.tsx`

- [ ] **Paso 1: Confirmar la hipótesis con el dato real**

Pedirle a Mathi el título de la tarea del 14/08 y verificar:

```sql
select title, due_date, priority, status from public.cards where title ilike '%<parte del titulo>%';
```

**Si `priority` no es `'alta'`, la hipótesis es falsa y hay que parar acá y buscar de verdad un
problema de fechas.** No sigas con el resto de la tarea en ese caso.

- [ ] **Paso 2: Mostrar el motivo en cada fila**

`itemsDelDia` ya devuelve `motivo` por cada tarjeta. La pantalla lo tiene y no lo dibuja. Agregar
un chip corto al lado del título:

- `vencida` → "Venció el 11/08"
- `vence-hoy` → "Vence hoy"
- `alta` → "Prioridad alta — vence el 14/08"

El tercero es el que resuelve el reporte: dice a la vez por qué está y cuándo vence de verdad.

- [ ] **Paso 3: Verificar en pantalla**

Levantá la app, entrá a Mi día, y confirmá que cada tarea dice por qué está ahí. Ésa es la
prueba: los tests no pueden verificar que alguien entienda.

- [ ] **Paso 4: Commit**

```bash
git add src/features/hoy/MiDia.tsx
git commit -m "fix: Mi dia explica por que cada tarea esta ahi"
```

---

# FASE C — Terminar lo empezado

## Task C1: El checklist obligatorio, completo

La lib y la columna están. Falta el botón del modal y la casilla para activarlo.

**Archivos:**
- Modificar: `src/features/board/CardModal.tsx`, `src/features/board/NuevaTareaModal.tsx`
- Modificar: `src/features/board/card/MetaSection.tsx`

- [ ] **Paso 1: Bloquear el botón "Terminar" del modal**

En `CardModal.tsx`, donde hoy está el botón que hace
`patch.mutate({ status: "term", … })`, usar `checklistIncompleto(c)` para deshabilitarlo y
`motivoChecklist(c)` para el texto de al lado.

**El mensaje dice cuántos pasos faltan, no "no se puede cerrar".** Un aviso que no dice qué hacer
obliga a buscar el motivo.

- [ ] **Paso 2: La casilla al crear la tarea**

En `NuevaTareaModal.tsx`, una casilla: *"No se puede cerrar con pasos del checklist sin tildar"*.
Sólo mostrarla si la migración 41 está aplicada — usar `tieneChecklistGate(aplicadas)` de
`src/lib/esquema.ts`, que ya existe para eso.

- [ ] **Paso 3: Y al editar, en la ficha de la tarea**

Lo mismo en `MetaSection.tsx`, para poder activarlo en tareas que ya existen.

- [ ] **Paso 4: Verificar los tres caminos de cierre**

Con una tarea que exige checklist y tiene pasos sin tildar, probar: el botón del modal, el cierre
rápido de Mi día, y arrastrarla a Terminado en el tablero. **Los tres tienen que bloquear.** Si
el arrastre no bloquea, falta conectar `checklistIncompleto` en `Board.tsx`.

- [ ] **Paso 5: Commit**

```bash
git add src/features/board/
git commit -m "feat: el checklist obligatorio bloquea los tres caminos de cierre"
```

---

## Task C2: Un solo arqueo mensual con los días adentro

**Reporte de Patricia:** hoy se genera una tarea por cada día hábil y la lista es interminable.

**La buena noticia: la mitad ya existe.** `task_occurrences` guarda una fila por (tarea, día) y
la migración 34 le dio checklist propio por día. Lo que falta es que el tablero muestre **una**
tarjeta madre con el avance, en vez de una tarjeta por día.

**Archivos:**
- Crear: `src/lib/arqueo-mensual.ts`, `src/lib/arqueo-mensual.test.ts`
- Modificar: `src/features/board/Board.tsx`

**Interfaces:**
- Produce: `function avanceDelMes(occs: TaskOccurrence[], habiles: string[]): { hechos: number; total: number; pct: number }`

- [ ] **Paso 1: Escribir el test**

```ts
import { describe, it, expect } from "vitest";
import { avanceDelMes } from "./arqueo-mensual";

describe("avance del arqueo mensual", () => {
  it("cuenta sobre los días hábiles del mes, no sobre los días corridos", () => {
    // 24 hábiles, 6 hechos -> 25%. El denominador es lo que pidió Patricia: X/24.
    const habiles = Array.from({ length: 24 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`);
    const occs = habiles.slice(0, 6).map((fecha) => ({ fecha, done: true })) as never;
    expect(avanceDelMes(occs, habiles)).toEqual({ hechos: 6, total: 24, pct: 25 });
  });

  it("no cuenta los días que no son hábiles aunque tengan ocurrencia", () => {
    // Si alguien cargó un arqueo un domingo, no infla el avance.
    const habiles = ["2026-08-03", "2026-08-04"];
    const occs = [
      { fecha: "2026-08-02", done: true },  // domingo
      { fecha: "2026-08-03", done: true },
    ] as never;
    expect(avanceDelMes(occs, habiles)).toEqual({ hechos: 1, total: 2, pct: 50 });
  });

  it("sin días hábiles no divide por cero", () => {
    expect(avanceDelMes([] as never, [])).toEqual({ hechos: 0, total: 0, pct: 0 });
  });
});
```

- [ ] **Paso 2: Correr y verificar que falla**

```bash
npx vitest run src/lib/arqueo-mensual.test.ts > /tmp/am.log 2>&1; echo "EXIT: $?"; tail -12 /tmp/am.log
```

- [ ] **Paso 3: Implementar, con `pct` redondeado y guardado contra división por cero**

- [ ] **Paso 4: En el tablero, una tarjeta con la barra de avance**

Mostrar "Arqueo de caja — 6 de 24" con una barra. Al abrirla, la grilla de días que ya existe.

**Depende de Task C3**: sin la lista de días hábiles, el denominador es inventado. Si C3 todavía
no está, usar los días del mes que no son sábado ni domingo y **decirlo en el texto**.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/arqueo-mensual.ts src/lib/arqueo-mensual.test.ts src/features/board/Board.tsx
git commit -m "feat: un solo arqueo mensual con el avance sobre los dias habiles"
```

---

## Task C3: Feriados y días no laborables

**Reporte de Valentino:** los fines de semana y feriados inflan los tiempos de ciclo como si
fueran demoras.

**Archivos:**
- Crear: `db/migraciones/migracion-47-dias-no-laborables.sql`
- Crear: `src/lib/dias-habiles.ts`, `src/lib/dias-habiles.test.ts`
- Modificar: `src/features/admin/Admin.tsx`

**Interfaces:**
- Produce: `function esHabil(fechaISO: string, noLaborables: Set<string>): boolean`
- Produce: `function habilesDelMes(mes: string, noLaborables: Set<string>): string[]`
- Produce: `function diasHabilesEntre(desdeISO: string, hastaISO: string, noLaborables: Set<string>): number`

- [ ] **Paso 1: La migración, con una tabla mínima**

`dias_no_laborables (fecha date primary key, motivo text, creado_por uuid)`. RLS: lectura para
todos los autenticados, escritura sólo para el jefe.

Los domingos **no** se cargan uno por uno: se calculan. La tabla es para feriados y días
puntuales que decida la empresa.

- [ ] **Paso 2: El test de la lib**

```ts
import { describe, it, expect } from "vitest";
import { esHabil, diasHabilesEntre } from "./dias-habiles";

describe("días hábiles", () => {
  it("sábado y domingo no son hábiles", () => {
    expect(esHabil("2026-08-08", new Set())).toBe(false); // sábado
    expect(esHabil("2026-08-09", new Set())).toBe(false); // domingo
    expect(esHabil("2026-08-10", new Set())).toBe(true);  // lunes
  });

  it("un feriado cargado no es hábil aunque sea día de semana", () => {
    expect(esHabil("2026-08-17", new Set(["2026-08-17"]))).toBe(false);
  });

  it("cuenta hábiles entre dos fechas sin contar el fin de semana", () => {
    // Del lunes 10 al viernes 14: 5 hábiles.
    expect(diasHabilesEntre("2026-08-10", "2026-08-14", new Set())).toBe(5);
  });

  it("del viernes al lunes son 2 hábiles, no 4", () => {
    // Es el caso que reportó Valentino: el fin de semana no es demora operativa.
    expect(diasHabilesEntre("2026-08-14", "2026-08-17", new Set())).toBe(2);
  });

  it("si las fechas vienen al revés devuelve 0, no un negativo", () => {
    expect(diasHabilesEntre("2026-08-17", "2026-08-14", new Set())).toBe(0);
  });
});
```

- [ ] **Paso 3: Correr, verificar que falla, implementar, correr**

- [ ] **Paso 4: La pantalla en Administración**

Un calendario del mes donde el jefe tilda los feriados. Sin emojis, iconos de `lucide-react`.

- [ ] **Paso 5: Conectarlo a las métricas de tiempo**

Buscar dónde se calculan las duraciones:

```bash
grep -rln "proc_at\|tiempo_max_horas\|dias\b" src/lib/*.ts | grep -v test
```

**Este paso es el que da valor y el que más cuidado necesita**: cambiar un denominador cambia
todos los números históricos. Anotá en el commit qué métricas cambian, para que nadie se asuste
al ver el Reporte distinto.

- [ ] **Paso 6: Commit**

```bash
git add db/migraciones/ src/lib/dias-habiles.ts src/lib/dias-habiles.test.ts src/features/admin/Admin.tsx src/lib/migraciones.ts
git commit -m "feat: feriados y fines de semana dejan de contar como demora"
```

---

## Task C4: Registro de transferencias de clientes

**Reporte de Patricia:** hoy se controlan por PDFs sueltos en un grupo de mensajería y no se
pueden detectar duplicados.

**Archivos:**
- Crear: `db/migraciones/migracion-48-transferencias.sql`
- Crear: `src/lib/transferencias.ts`, `src/lib/transferencias.test.ts`
- Crear: `src/features/board/TransferenciasSection.tsx`

**Interfaces:**
- Produce: `function posibleDuplicado(nueva: Transferencia, existentes: Transferencia[]): Transferencia | null`

- [ ] **Paso 1: La migración**

Tabla `transferencias`: `id`, `card_id`, `owner`, `fecha date`, `cliente text`, `cuit text`,
`monto numeric`, `nro_comprobante text`, `adjunto_path text`, `created_at`.

**`monto` es `numeric`, nunca `float`.** Es plata: con `float` los centavos se pierden y las
conciliaciones dejan de cerrar. El proyecto ya usa `numeric` en `task_occurrences.dif_importe`,
seguir ese criterio.

Índice `unique (nro_comprobante)` **parcial**, sólo donde `nro_comprobante is not null` — porque
no toda transferencia trae número y no se puede bloquear la carga por eso.

- [ ] **Paso 2: El test de detección de duplicados**

```ts
import { describe, it, expect } from "vitest";
import { posibleDuplicado } from "./transferencias";

const base = { fecha: "2026-08-10", cliente: "Torres SA", cuit: "30712345678", monto: 150000 };

describe("detectar transferencias repetidas", () => {
  it("mismo número de comprobante es duplicado seguro", () => {
    const previas = [{ ...base, nro_comprobante: "ABC-123" }] as never;
    const nueva = { ...base, fecha: "2026-08-11", nro_comprobante: "ABC-123" } as never;
    expect(posibleDuplicado(nueva, previas)).not.toBeNull();
  });

  it("mismo cliente y mismo monto en el mismo mes: avisa", () => {
    // No lo bloquea: puede ser legítimo. Pero Patricia tiene que poder mirarlo.
    const previas = [{ ...base, nro_comprobante: null }] as never;
    const nueva = { ...base, fecha: "2026-08-20", nro_comprobante: null } as never;
    expect(posibleDuplicado(nueva, previas)).not.toBeNull();
  });

  it("mismo cliente y monto en OTRO mes no es duplicado", () => {
    // Un abono mensual del mismo importe es lo normal, no un error.
    const previas = [{ ...base, nro_comprobante: null }] as never;
    const nueva = { ...base, fecha: "2026-09-10", nro_comprobante: null } as never;
    expect(posibleDuplicado(nueva, previas)).toBeNull();
  });

  it("mismo monto de clientes distintos no es duplicado", () => {
    const previas = [{ ...base, nro_comprobante: null }] as never;
    const nueva = { ...base, cliente: "Gómez SRL", nro_comprobante: null } as never;
    expect(posibleDuplicado(nueva, previas)).toBeNull();
  });

  it("sin previas nunca hay duplicado", () => {
    expect(posibleDuplicado({ ...base, nro_comprobante: "X" } as never, [])).toBeNull();
  });
});
```

- [ ] **Paso 3: Correr, verificar que falla, implementar, correr**

- [ ] **Paso 4: El formulario dentro de la tarea**

Una sección en `CardModal` que aparece **sólo** en tareas de categoría transferencias. Campos:
fecha, cliente, CUIT, monto, número de comprobante, adjunto.

**El aviso de duplicado no bloquea la carga**: muestra la transferencia parecida y pregunta si es
la misma. Bloquear haría que se carguen mal a propósito para poder seguir.

- [ ] **Paso 5: Commit**

```bash
git add db/migraciones/ src/lib/transferencias.ts src/lib/transferencias.test.ts src/features/board/ src/lib/migraciones.ts
git commit -m "feat: registro de transferencias con aviso de duplicado"
```

---

# FASE D — Interfaz

## Task D1: Columnas plegables en el tablero

**Reporte de Valentino:** el scroll vertical es interminable.

**Archivos:**
- Modificar: `src/features/board/Board.tsx`
- Modificar: `src/lib/prefs.ts`

- [ ] **Paso 1: Guardar el estado plegado como preferencia**

`prefs.ts` ya guarda preferencias de vista. Agregar `columnasPlegadas: string[]`. Que sobreviva a
recargar la página: una columna que se despliega sola en cada carga es peor que no tener la
función.

- [ ] **Paso 2: El botón de plegar en el encabezado de cada columna**

Icono de `lucide-react` (`ChevronDown` / `ChevronRight`). Plegada muestra el título y el contador.

- [ ] **Paso 3: Que se pueda soltar una tarjeta en una columna plegada**

Es el caso que rompe esta función si no se piensa: si arrastrás algo a una columna plegada y no
pasa nada, la gente deja de plegar. Al pasar por encima arrastrando, se despliega sola.

- [ ] **Paso 4: Verificar en pantalla, plegando, recargando y arrastrando**

- [ ] **Paso 5: Commit**

```bash
git add src/features/board/Board.tsx src/lib/prefs.ts
git commit -m "feat: columnas plegables en el tablero"
```

---

## Task D2: Adjuntar una captura al reportar un problema

**Reporte de Mathi:** no se puede mandar evidencia visual y eso hace que un error tarde tres
mensajes en entenderse.

**Archivos:**
- Modificar: `src/features/consultas/ConsultasModal.tsx`
- Modificar: `db/migraciones/migracion-49-consultas-adjunto.sql` (crear)

- [ ] **Paso 1: La columna y el permiso de Storage**

`consultas.adjunto_path text`. En el bucket, que cada uno pueda subir a su carpeta y que **sólo
la cuenta de administración pueda leer** — es el canal donde alguien reporta un problema
contando con que su jefe no lo ve, y una captura puede mostrar más de lo que el texto dice.

- [ ] **Paso 2: El campo en el formulario**

Pegar desde el portapapeles (Ctrl+V) además de elegir archivo. **Al reportar un error, la captura
está en el portapapeles**: obligar a guardarla como archivo primero es la fricción que hace que
no se adjunte.

- [ ] **Paso 3: Que se vea en la bandeja**

En `BandejaConsultas`, mostrar la miniatura.

- [ ] **Paso 4: Commit**

```bash
git add db/migraciones/ src/features/consultas/ src/lib/migraciones.ts
git commit -m "feat: adjuntar una captura al reportar un problema"
```

---

# Lo que este plan NO hace

- **No toca el manejo de zona horaria**, porque la revisión no encontró un bug ahí. Si el paso 1
  de la Task B2 muestra que la tarea de Mathi **no** tiene prioridad alta, entonces sí hay uno y
  hay que buscarlo — pero escribir el arreglo antes de tener esa respuesta es arreglar a ciegas.
- **No duplica las policies de RLS.** Ya están puestas. Si el error persiste, la causa es otra
  (probablemente la jerarquía de un solo nivel) y se ataca con datos, no con más SQL.
- **No unifica los seis caminos de creación de tareas.** Es un problema real y grande, y meterlo
  acá haría que estos diez reportes tarden el triple.

---

# Qué decirle al equipo

Cuando esto esté hecho, tres de los seis reportes tienen una respuesta que conviene dar
completa, porque cambia la confianza en el sistema:

- **A Yani, Mathi y Enzo:** la tarea de los jueves nunca volvió porque **ningún proceso la
  miraba**. El motor estaba escrito y el cron apuntaba a una versión vieja que sólo entendía las
  mensuales. Ya está conectado, y ahora hay una consulta que dice si corrió.
- **A Mathi, por la fecha:** la tarea del 14 aparecía el 13 porque tiene prioridad alta, y Mi día
  muestra las urgentes todos los días. No estaba mal la fecha: faltaba que la pantalla lo dijera.
- **A Patricia:** los arqueos ya se guardaban por día; lo que faltaba era mostrarlos juntos.
