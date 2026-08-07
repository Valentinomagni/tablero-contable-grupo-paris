# Salto de calidad — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar tarea por tarea. Los pasos usan casillas `- [ ]`.

**Objetivo:** Llevar el Tablero Contable de "herramienta interna muy bien pensada" a producto que
resiste la mirada de un equipo senior: sistema visual real, backend que no pierde datos, y las
piezas compartidas que hoy no existen.

**Arquitectura:** Tres frentes que no se pisan. (A) Continuidad: nada se puede perder. (B) Piezas
compartidas del front: `Button`, `Vista`, tokens — cambios chicos que tocan 215 lugares. (C) Datos
y rendimiento: cortar lo que se trae de más y cerrar las fallas mudas. Cada tarea entrega algo
verificable sola y se commitea sola.

**Stack:** React 19.2 · TypeScript 6 · Vite 8 · Tailwind 3.4.19 · TanStack Query 5 · Supabase
(Postgres + RLS + pg_cron + Edge Functions) · vitest 4 · oxlint · Playwright.

---

## De dónde sale este plan

Tres auditorías independientes del 05 y 06/08/2026 —diseño de producto, arquitectura de datos y
corrección— más mediciones propias. **Cada afirmación de acá se verificó contra el código antes de
entrar al plan.** Lo que no sobrevivió a esa verificación no está.

Este plan **no** repite la auditoría de defectos: eso vive en `docs/AUDITORIA-2026-08-05.md` y se
ejecuta aparte. Acá está lo que sube el nivel del producto.

---

## Restricciones globales

Aplican a **todas** las tareas, sin excepción.

- **Cero emojis** en cualquier texto que vea un usuario. Iconos sólo de `lucide-react`.
- **Encuadre no punitivo.** Las métricas describen situaciones y procesos, nunca juzgan personas.
  Sin rankings, sin podios, sin ordenar gente por una métrica. Hay guardianes que lo verifican.
- **Español de Argentina**, tono directo, sin jerga técnica en la UI. Un error nunca muestra el
  mensaje crudo de la base: todo pasa por `mensajeUsuario` (`src/lib/fallas.ts`).
- **Marca monocroma.** El color aparece sólo en estados (`--done`, `--warn`, `--danger`).
- **Comentarios en español que explican el POR QUÉ.** La densidad alta es deliberada: este código
  lo mantiene una sola persona que no es programadora.
- **NO hay npm en la máquina.** Para instalar o sacar dependencias existe el workflow
  `Dependencias` de GitHub Actions (`docs/COMO-INSTALAR-DEPENDENCIAS.md`). Tocar `package.json` a
  mano rompe el `npm ci` del CI.
- **Comandos** (con `export PATH="/c/Users/Vmagni/AppData/Local/OpenAI/Codex/bin:$PATH"`):
  - Tests: `node node_modules/vitest/vitest.mjs run`
  - Tipos: `node node_modules/typescript/bin/tsc -b`
  - Lint: `node node_modules/oxlint/bin/oxlint`
  - Build: `node node_modules/vite/bin/vite.js build`
  - Peso: `node scripts/peso.mjs` (presupuesto 240 kB; hoy 222,4)
- **Códigos de salida:** `cmd > /tmp/log 2>&1; echo "EXIT: $?"; tail -30 /tmp/log`. Nunca `cmd | tail`.
- **El pre-commit corre tsc + toda la suite: 90 a 180 s.** Pasar `timeout: 420000` al commitear.
- **TDD.** Test primero, verificar que falla **por la razón esperada**, después implementar.
- **Si un aserto del plan resulta incorrecto, no lo ajustes para que pase.** Pará y reportá.

---

## Mapa de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `src/components/Button.tsx` | La única definición del aspecto y los estados de un botón |
| `src/components/Button.test.tsx` | Variantes, tamaños, estado de carga, deshabilitado |
| `src/components/Button.guard.test.ts` | Falla si alguien vuelve a dibujar un botón a mano |
| `src/components/Vista.tsx` | Contenedor de pantalla: ancho, centrado y padding, una sola vez |
| `src/components/Vista.test.tsx` | Los tres anchos, el centrado, el padding responsive |
| `src/components/Vista.guard.test.ts` | Falla si una pantalla vuelve a inventar su ancho |
| `src/lib/excel-min.ts` | Escritor de .xlsx mínimo, para sacar la dependencia de 416 kB |
| `src/lib/excel-min.test.ts` | El archivo generado abre en Excel y tiene las celdas correctas |
| `migracion-40-integridad-y-permisos.sql` | CHECK de valores, índices que faltan, `card_periodos` |
| `migracion-41-bitacora-de-crons.sql` | Que un cron que falla deje rastro |
| `edge-function-crear-usuario.ts` | Traer al repo el código que hoy sólo existe en producción |
| `docs/CONTINUIDAD.md` | Qué se pierde, cuánto se tarda en volver, y cómo se ensayó |

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `tailwind.config.js` | Escala de espaciado, `2xl` explícito, escala tipográfica abierta |
| `src/index.css` | Rampa de grises derivada, tokens de elevación y de movimiento |
| `src/hooks/useData.ts:320-341` | Filtro por período y debounce del realtime |
| `src/features/admin/Admin.tsx:253-262` | Respaldo completo, paginado, que aborta si falla |
| `src/lib/excel.ts:55` | Usar `excel-min` en vez de `xlsx` |
| `src/lib/ui.tsx:3` | `cn` pasa a `twMerge(clsx(...))` |
| 15 pantallas de `src/features/**` | Adoptar `Vista` y `Button` |

---

## Orden y por qué

1. **Fase A — Continuidad** va primero porque es el único frente donde el riesgo es *pérdida total*.
   Todo lo demás es optimizar algo que todavía se puede perder entero.
2. **Fase B — Piezas compartidas** va segunda porque es la mayor cantidad de calidad percibida por
   hora invertida, y porque cada día que pasa se escriben más botones a mano.
3. **Fase C — Datos y rendimiento** va tercera: son cambios chicos e independientes, cada uno con
   beneficio inmediato y ninguno con riesgo de romper algo.
4. **Fase D — El proyecto grande** (unificar el estado de una tarea en una sola tabla) queda
   documentada como decisión, no como tarea. Requiere una conversación antes que código.

---

# FASE A — Continuidad

## Task A1: Traer al repo la Edge Function que sólo existe en producción

**Por qué primero:** hay una función con permisos de `service_role` creando usuarios en producción
cuyo código fuente **no está en este repositorio**. No se puede revisar, ni auditar, ni volver a
desplegar si el proyecto viejo se pierde. Y `docs/FIX-EDGE-FUNCTION.md` documenta que esa misma
función ya estuvo una vez desplegada con el código de ejemplo en lugar del real.

**Archivos:**
- Crear: `edge-function-crear-usuario.ts` (raíz)
- Modificar: `README.md`

**Verificado:** `src/features/admin/Admin.tsx:237` hace
`fetch(SUPABASE_URL + "/functions/v1/crear-usuario")`, y `ls edge-function-*.ts` devuelve sólo
`blanquear-clave` y `eliminar-usuario`.

- [ ] **Paso 1: Confirmar que el archivo sigue faltando**

```bash
ls edge-function-*.ts
grep -rn "functions/v1/" src/ --include="*.tsx" | grep -v "\.test\."
```

Esperado: la lista de archivos tiene dos entradas y los `fetch` nombran tres funciones.
Si ya aparecen las tres, esta tarea está hecha: marcala y seguí.

- [ ] **Paso 2: Recuperar el código real**

El fuente está en el proyecto v1: `C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable/edge-function-crear-usuario.ts`
(referenciado en `docs/FIX-EDGE-FUNCTION.md:19`). Copialo a la raíz de este repo.

Si ese archivo no existe, **no inventes la función**: pará y reportá. El código desplegado es la
verdad y hay que bajarlo del dashboard de Supabase (Edge Functions → crear-usuario → el editor
muestra el fuente). Escribir una versión "equivalente" y desplegarla es cómo se rompió la vez pasada.

- [ ] **Paso 3: Verificar que lo que trajiste es lo que está desplegado**

Compará el archivo contra lo que muestra el dashboard, línea por línea. Anotá al principio del
archivo, en un comentario, la fecha en que se verificó y contra qué.

- [ ] **Paso 4: Documentar la regla que evita que vuelva a pasar**

En `README.md`, en la sección de despliegue, agregar:

```markdown
### Edge Functions

Las funciones desplegadas en Supabase son **exactamente** las que devuelve `ls edge-function-*.ts`.
Si el front llama a una que no está en esa lista, es un error: significa que hay código con
permisos de `service_role` corriendo en producción que nadie puede revisar.

Verificación rápida — las dos listas tienen que coincidir:

    ls edge-function-*.ts
    grep -rho 'functions/v1/[a-z-]*' src/ | sort -u
```

- [ ] **Paso 5: Commit**

```bash
git add edge-function-crear-usuario.ts README.md
git commit -m "fix: la edge function de crear usuarios vuelve al repositorio"
```

---

## Task A2: El respaldo trae 7 tablas de 20 y trunca en silencio

**Por qué importa:** el botón "Descargar respaldo" de Administración da la sensación de que hay una
copia. No la hay. Faltan `task_occurrences` —la evidencia diaria de los arqueos de caja— y
`cards_archive` —todo el histórico—, que son las dos más irreemplazables. Y `select("*")` sin
paginar corta a las 1.000 filas devolviendo `error: null`, así que el JSON sale incompleto y no lo
dice. Este repo ya documenta ese mismo corte tres veces en otros archivos: la lección está
aprendida y no se aplicó acá.

**Archivos:**
- Modificar: `src/features/admin/Admin.tsx:253-262`
- Crear: `src/lib/respaldo.ts`
- Test: `src/lib/respaldo.test.ts`

**Interfaces:**
- Produce: `TABLAS_RESPALDO: readonly string[]` y
  `async function traerTodo(from: (t: string) => Consulta, tabla: string): Promise<Fila[]>`

**Verificado:** `Admin.tsx:255` dice exactamente
`const tablas = ["profiles", "cards", "objectives", "announcements", "activity_log", "daily_snapshots", "settings"];`

- [ ] **Paso 1: Escribir el test que falla**

Crear `src/lib/respaldo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TABLAS_RESPALDO, traerTodo } from "./respaldo";

// Un respaldo incompleto es peor que no tener respaldo: da la tranquilidad sin dar la copia.
describe("respaldo", () => {
  it("incluye las tablas irreemplazables", () => {
    // task_occurrences es la evidencia diaria de arqueo de caja; cards_archive es todo el
    // histórico. Si falta alguna de las dos, lo que se descarga no sirve para recuperar nada.
    expect(TABLAS_RESPALDO).toContain("task_occurrences");
    expect(TABLAS_RESPALDO).toContain("cards_archive");
    expect(TABLAS_RESPALDO).toContain("card_periodos");
    expect(TABLAS_RESPALDO).toContain("consultas");
    expect(TABLAS_RESPALDO).toContain("cierre_periodos");
    expect(TABLAS_RESPALDO).toContain("notes");
    expect(TABLAS_RESPALDO).toContain("empresas");
    expect(TABLAS_RESPALDO).toContain("vacaciones");
  });

  it("pagina hasta el final en vez de cortar en 1000", async () => {
    // PostgREST corta a las 1000 filas y devuelve error: null. Sin paginar, un respaldo de
    // 2500 cards guarda 1000 y parece exitoso.
    const filas = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
    const from = () => ({
      select: () => ({
        range: (desde: number, hasta: number) =>
          Promise.resolve({ data: filas.slice(desde, hasta + 1), error: null }),
      }),
    });
    const out = await traerTodo(from as never, "cards");
    expect(out).toHaveLength(2500);
  });

  it("propaga el error en vez de guardarlo como si fuera un dato", async () => {
    // El código viejo escribía {error} adentro del JSON y lo llamaba respaldo.
    const from = () => ({
      select: () => ({ range: () => Promise.resolve({ data: null, error: { message: "sin permiso" } }) }),
    });
    await expect(traerTodo(from as never, "cards")).rejects.toThrow(/sin permiso/);
  });
});
```

- [ ] **Paso 2: Correr y verificar que falla por la razón esperada**

```bash
node node_modules/vitest/vitest.mjs run src/lib/respaldo.test.ts > /tmp/r.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/r.log
```

Esperado: EXIT 1, con "Failed to resolve import ./respaldo" — el módulo todavía no existe.

- [ ] **Paso 3: Implementar `src/lib/respaldo.ts`**

```ts
// Qué entra en un respaldo, y cómo se trae completo.
//
// El botón de Administración traía 7 tablas de las 20 que existen, y sin paginar. Faltaban
// `task_occurrences` (la evidencia diaria de los arqueos) y `cards_archive` (todo el histórico):
// las dos que no se pueden reconstruir de ninguna otra forma.
//
// Un respaldo incompleto es peor que no tener respaldo, porque da la tranquilidad sin dar la
// copia. Por eso esta lista vive acá, con un test que exige las irreemplazables, y no como un
// array suelto adentro de una pantalla de 624 líneas.

/**
 * Todas las tablas del esquema `public` que contienen datos del negocio.
 *
 * NO incluye `schema_migrations` (se reconstruye corriendo las migraciones) ni `card_pausas`
 * (creada a propósito vacía). Sí incluye tablas chicas como `settings`: pesan nada y su ausencia
 * en una restauración se nota enseguida.
 */
export const TABLAS_RESPALDO = [
  "profiles", "cards", "card_periodos", "cards_archive", "task_occurrences",
  "activity_log", "daily_snapshots", "objectives", "announcements", "notifications",
  "consultas", "cierre_periodos", "vacaciones", "notes", "empresas",
  "reinicios_mensuales", "settings",
] as const;

/** Tamaño de página. PostgREST corta por su cuenta a las 1000; pedimos exactamente eso. */
const PAGINA = 1000;

type Fila = Record<string, unknown>;
type Consulta = { select: (cols: string) => { range: (a: number, b: number) => Promise<{ data: Fila[] | null; error: { message: string } | null }> } };

/**
 * Trae una tabla ENTERA, de a 1000 filas.
 *
 * El motivo por el que esto no puede ser un `select("*")` pelado: PostgREST corta a las 1000
 * filas y devuelve `error: null`. O sea que el corte es indistinguible de una tabla chica. Este
 * repo ya lo detectó tres veces (`useArchive.ts`, dos en `useArqueo.ts`) y en el respaldo se
 * pasó por alto — justo donde más caro sale.
 *
 * Y si la base devuelve error, esto TIRA. El código viejo metía `{error}` adentro del JSON y
 * seguía como si nada: un archivo con la palabra "error" adentro se descarga igual, se guarda
 * igual, y se descubre el día que hay que restaurarlo.
 */
export async function traerTodo(from: (t: string) => Consulta, tabla: string): Promise<Fila[]> {
  const out: Fila[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await from(tabla).select("*").range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`No se pudo respaldar ${tabla}: ${error.message}`);
    const pagina = data ?? [];
    out.push(...pagina);
    if (pagina.length < PAGINA) return out;
  }
}
```

- [ ] **Paso 4: Correr el test**

```bash
node node_modules/vitest/vitest.mjs run src/lib/respaldo.test.ts > /tmp/r.log 2>&1; echo "EXIT: $?"; tail -6 /tmp/r.log
```

Esperado: EXIT 0, 3 tests en verde.

- [ ] **Paso 5: Conectar la pantalla**

En `src/features/admin/Admin.tsx`, reemplazar el array local y el bucle por la lib. Leé primero las
líneas 250-268 para ver la forma exacta que tiene hoy. El cambio es: importar
`TABLAS_RESPALDO` y `traerTodo` de `../../lib/respaldo`, recorrer `TABLAS_RESPALDO` llamando
`traerTodo((t) => supabase.from(t), tabla)`, y envolver todo en un `try/catch` que, ante un error,
muestre `mensajeUsuario(e, "descargar el respaldo")` y **no descargue nada**.

Regla que no se puede romper: si una sola tabla falla, no hay descarga. Un archivo parcial que
parece completo es el modo de falla que esta tarea viene a cerrar.

- [ ] **Paso 6: Verificar todo**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC: $?"
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/a.log 2>&1; echo "TESTS: $?"; tail -4 /tmp/a.log
```

Esperado: los tres en EXIT 0.

- [ ] **Paso 7: Commit**

```bash
git add src/lib/respaldo.ts src/lib/respaldo.test.ts src/features/admin/Admin.tsx
git commit -m "fix: el respaldo traia 7 tablas de 20 y cortaba en 1000 filas"
```

---

## Task A3: Escribir qué se pierde y cuánto se tarda en volver

**Por qué:** `docs/BACKUP-RESTORE.md` cierra diciendo *"un backup sin restore probado es una
esperanza"*, y el restore sigue sin probarse. Esta tarea no escribe código: convierte dos números
desconocidos —cuánto se pierde, cuánto se tarda— en dos números medidos.

**Archivos:**
- Crear: `docs/CONTINUIDAD.md`

- [ ] **Paso 1: Verificar el respaldo de plataforma (lo hace el dueño, no el agente)**

Dashboard de Supabase → el proyecto → **Database → Backups**. Confirmar dos cosas: que hay copias
listadas, y que la más reciente tiene menos de 48 horas. Después, **Settings → Billing**, confirmar
el plan.

**En el plan Free no hay respaldos automáticos de ningún tipo.** Si ese es el caso, es el punto
más grave de todo este plan y todo lo demás espera.

- [ ] **Paso 2: Escribir `docs/CONTINUIDAD.md` con los números reales**

El documento tiene que responder tres preguntas y nada más:

1. **¿Qué se pierde si pasa lo peor?** (RPO) — con el plan verificado en el paso 1.
2. **¿Cuánto se tarda en volver?** (RTO) — medido, no estimado.
3. **¿Cuál es el escenario probable?** No es "Supabase pierde datos": es **alguien borró algo**.
   `CardModal.tsx:68` hace `delete` duro sobre `cards`, y `undo.ts` es una pila en memoria del
   navegador que ni siquiera cubre el borrado.

- [ ] **Paso 3: Ensayar el restore una vez, y anotar cuánto tardó**

Crear un proyecto Supabase de prueba, correr las migraciones 13→41 en orden, restaurar el JSON del
respaldo, y entrar. **El tiempo que tardó ese ensayo es el RTO.** Anotarlo en el documento con la
fecha.

Si el ensayo falla, eso también va al documento: un restore que no funciona documentado vale más
que uno que nadie probó.

- [ ] **Paso 4: Commit**

```bash
git add docs/CONTINUIDAD.md
git commit -m "docs: que se pierde y cuanto se tarda en volver, medido"
```

---

# FASE B — Las piezas que no existen

## Task B1: `Button.tsx` — 215 botones, 54 formas, 0 componente

**Medido, no estimado:** 215 elementos `<button>`; 30 combinaciones distintas de padding; 54
combinaciones de (padding · radio · tamaño) para lo que semánticamente son 4 variantes. **102 de
215 (47%)** no declaran ningún `hover:`, `disabled:` ni `active:`. **0** declaran foco propio.

**Y hay 25 botones que en modo oscuro no se pueden leer:** escriben `bg-accent text-white` cuando
el token correcto es `text-[color:var(--accent-ink)]` — que sí usan otros 19. En oscuro `--accent`
es `#e4e4e7`, así que blanco encima da **1,27:1**; el mínimo legible es 4,5:1.

**Archivos:**
- Crear: `src/components/Button.tsx`, `src/components/Button.test.tsx`, `src/components/Button.guard.test.ts`
- Modificar: `src/lib/ui.tsx:3`

**Interfaces:**
- Produce: `<Button variante? tam? cargando? {...props}>` con
  `variante: "primario" | "secundario" | "fantasma" | "peligro"` y
  `tam: "sm" | "md" | "lg" | "icono"`.

**Dependencias:** `class-variance-authority`, `clsx` y `tailwind-merge` **ya están instaladas y con
cero imports**. No hace falta el workflow de dependencias.

- [ ] **Paso 1: Arreglar `cn` primero, que es de dos líneas y arregla colisiones en toda la app**

Hoy `src/lib/ui.tsx:3` es un `filter(Boolean).join(" ")`. Con eso, si dos clases de Tailwind
chocan (`px-3` y `px-4`), gana la última del string y no la más específica — que es exactamente lo
que va a pasar cuando `Button` acepte `className` de afuera.

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// `twMerge` sobre `clsx`: sin esto, pasarle `className="px-6"` a un componente que ya trae `px-3`
// deja las dos clases en el string y gana la que Tailwind haya emitido después en el CSS — o sea,
// el resultado depende del orden del archivo generado, no de lo que escribiste. Con `twMerge`
// gana siempre la última que pasaste, que es lo que cualquiera espera.
export const cn = (...xs: ClassValue[]) => twMerge(clsx(xs));
```

- [ ] **Paso 2: Verificar que `cn` sigue andando**

```bash
node node_modules/vitest/vitest.mjs run > /tmp/a.log 2>&1; echo "EXIT: $?"; tail -4 /tmp/a.log
```

Esperado: EXIT 0, 1202 tests. Si algo se rompe acá, es una colisión de clases que estaba
enmascarada — miralo, no lo revirtás sin entenderlo.

- [ ] **Paso 3: Escribir el test de `Button` (falla: no existe)**

Crear `src/components/Button.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("el primario usa el token de tinta del acento, no blanco fijo", () => {
    // ESTE ES EL TEST QUE IMPORTA. 25 botones escribían `bg-accent text-white`. En modo oscuro
    // `--accent` es #e4e4e7 y blanco encima da 1,27:1 — el botón principal no se lee.
    render(<Button variante="primario">Guardar</Button>);
    const b = screen.getByRole("button", { name: "Guardar" });
    expect(b.className).toContain("var(--accent-ink)");
    expect(b.className).not.toContain("text-white");
  });

  it("por defecto es secundario y de tamaño medio", () => {
    render(<Button>Cancelar</Button>);
    expect(screen.getByRole("button").className).toContain("border-line");
  });

  it("cargando deshabilita y anuncia el estado", () => {
    // Los 50 `isPending` de la app inventan cada uno su copy ("Generando…", "Archivando…").
    // El estado de carga es del botón, no del texto.
    render(<Button cargando>Generar</Button>);
    const b = screen.getByRole("button");
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
  });

  it("deshabilitado no responde al puntero", () => {
    render(<Button disabled>Borrar</Button>);
    expect(screen.getByRole("button").className).toContain("pointer-events-none");
  });

  it("el tamaño táctil llega a 44px en pantalla chica", () => {
    // Mínimo de Apple y Google. Hoy el botón más común de la app mide 35,5px y los de ícono, 25.
    render(<Button>Tocar</Button>);
    expect(screen.getByRole("button").className).toContain("h-11");
  });
});
```

- [ ] **Paso 4: Correr y verificar que falla por la razón esperada**

```bash
node node_modules/vitest/vitest.mjs run src/components/Button.test.tsx > /tmp/b.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/b.log
```

Esperado: EXIT 1, "Failed to resolve import ./Button".

- [ ] **Paso 5: Implementar `src/components/Button.tsx`**

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/ui";

// LA ÚNICA DEFINICIÓN DEL ASPECTO DE UN BOTÓN.
//
// Antes de este archivo había 215 botones escritos a mano con 54 combinaciones distintas de
// padding, radio y tamaño, para lo que en realidad son cuatro variantes. El 47% no declaraba
// ningún estado propio: el botón "Eliminar plantilla" y un chip de filtro respondían igual al
// presionarse.
//
// Y 25 escribían `bg-accent text-white`, que en modo oscuro es blanco sobre casi blanco: 1,27:1
// de contraste, cuando el mínimo legible es 4,5:1. Media pantalla de Administración tenía el
// botón principal ilegible. Que conviviera con otros 19 escritos bien es el síntoma exacto de no
// tener componente: no hay un lugar donde arreglarlo una vez.
const boton = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap " +
  "transition-colors duration-rapido ease-salida " +
  "active:translate-y-px disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variante: {
        // `--accent-ink` y no `text-white`: el acento es negro en claro y casi blanco en oscuro,
        // así que la tinta tiene que seguirlo. Es el token que ya existía y que la mitad usaba.
        primario:   "bg-accent text-[color:var(--accent-ink)] hover:opacity-90",
        secundario: "border border-line bg-surface2 text-ink hover:bg-surface",
        fantasma:   "text-ink2 hover:text-ink hover:bg-surface2",
        peligro:    "bg-danger text-white hover:opacity-90",
      },
      tam: {
        sm:     "h-9  px-3   text-xs",
        // 44px en móvil, 40 en escritorio. 44 es el mínimo de Apple y de Google, y hoy el botón
        // más frecuente de la app mide 35,5. En escritorio, con mouse, 40 alcanza y se ve mejor.
        md:     "h-11 px-3.5 text-sm sm:h-10",
        lg:     "h-12 px-4   text-sm sm:h-11",
        icono:  "h-11 w-11 p-0 sm:h-10 sm:w-10",
      },
    },
    defaultVariants: { variante: "secundario", tam: "md" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof boton> & {
  /** Bloquea el botón y muestra el giro. El texto NO cambia: el estado es del botón. */
  cargando?: boolean;
};

export function Button({ variante, tam, cargando, className, children, disabled, ...rest }: Props) {
  return (
    <button
      className={cn(boton({ variante, tam }), className)}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...rest}
    >
      {cargando && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
```

- [ ] **Paso 6: Correr el test**

```bash
node node_modules/vitest/vitest.mjs run src/components/Button.test.tsx > /tmp/b.log 2>&1; echo "EXIT: $?"; tail -6 /tmp/b.log
```

Esperado: EXIT 0, 5 tests en verde.

Si el de `h-11` falla, es porque `duration-rapido`/`ease-salida` todavía no existen como clases
(Task B3 los conecta). Eso no rompe nada —Tailwind ignora una clase que no conoce— pero anotalo.

- [ ] **Paso 7: Commit**

```bash
git add src/components/Button.tsx src/components/Button.test.tsx src/lib/ui.tsx
git commit -m "feat: un solo boton, con los estados que 102 de 215 no tenian"
```

---

## Task B2: El guardián que impide que vuelvan los 215 botones a mano

**Por qué es una tarea aparte:** `Button` sin guardián dura hasta el próximo botón apurado. Es el
mismo razonamiento de `tipografia.guard.test.ts`, que ya demostró que funciona.

**Archivos:**
- Crear: `src/components/Button.guard.test.ts`

- [ ] **Paso 1: Escribir el guardián**

```ts
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// La primera línea no se puede borrar: `tsconfig.app.json` fija `"types": ["vite/client"]`, así
// que sin ella `tsc` corta con TS2591 en el import de `node:fs`.
//
// GUARDIÁN DEL BOTÓN.
//
// Este chequeo es ANGOSTO A PROPÓSITO y lo declara: persigue UNA cosa, el botón primario mal
// escrito, porque es la que produce un defecto visible (texto ilegible en modo oscuro) y la que
// se puede detectar sin ambigüedad.
//
// Lo que NO persigue, y por lo tanto sigue siendo responsabilidad de quien escribe: un `<button>`
// secundario escrito a mano. Perseguir los 215 de una sería un test con cincuenta excepciones, y
// un guardián con cincuenta excepciones aparenta una cobertura que no tiene.
//
// La migración a `<Button>` se hace por tandas, como se hizo con `Panel`. Cuando termine, este
// guardián se puede ensanchar — y ahí sí, prohibir `<button` fuera de `Button.tsx`.
describe("el botón primario tiene una sola forma", () => {
  it("nadie escribe bg-accent con texto blanco fijo", () => {
    const culpables: string[] = [];
    for (const ruta of archivosFuente("src")) {
      const lineas = readFileSync(ruta, "utf8").split("\n");
      for (let i = 0; i < lineas.length; i++) {
        // Las dos en la misma línea de clases. En modo oscuro `--accent` es #e4e4e7 y el blanco
        // encima da 1,27:1: el botón existe pero no se puede leer lo que dice.
        if (/bg-accent\b/.test(lineas[i]) && /text-white\b/.test(lineas[i])) {
          culpables.push(`${ruta}:${i + 1}: ${lineas[i].trim().slice(0, 90)}`);
        }
      }
    }
    expect(
      culpables,
      "En modo oscuro esto es blanco sobre casi blanco (1,27:1) y no se lee. Usá <Button " +
      "variante=\"primario\">, o si tiene que ser a mano, text-[color:var(--accent-ink)]:\n" +
      culpables.join("\n"),
    ).toEqual([]);
  });
});

function archivosFuente(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) { out.push(...archivosFuente(ruta)); continue; }
    if (!/\.tsx$/.test(nombre) || /\.test\.tsx$/.test(nombre)) continue;
    out.push(ruta);
  }
  return out;
}
```

- [ ] **Paso 2: Correr y verificar que ENCUENTRA los 25**

```bash
node node_modules/vitest/vitest.mjs run src/components/Button.guard.test.ts > /tmp/g.log 2>&1; echo "EXIT: $?"; grep -c "bg-accent" /tmp/g.log
```

Esperado: EXIT 1, y la lista tiene **25 líneas**. Si tiene otra cantidad, contá a mano con
`grep -rn "bg-accent" src/ --include="*.tsx" | grep "text-white" | wc -l` y entendé la diferencia
antes de seguir. Un guardián que cuenta mal no sirve.

- [ ] **Paso 3: Arreglar los 25, uno por uno**

**Nunca con `sed` ni con expresiones regulares.** Ya pasó en este proyecto: dejó un `</div>` donde
iba un `</Panel>` y rompió el archivo. Edición puntual, mirando cada uno.

Para cada uno hay dos caminos, y el correcto depende del caso:
- Si es un botón normal → reemplazarlo por `<Button variante="primario">`.
- Si está dentro de algo que no puede llevar el componente todavía → cambiar sólo `text-white` por
  `text-[color:var(--accent-ink)]` y dejarlo anotado para la tanda siguiente.

- [ ] **Paso 4: Verificar que el guardián queda en verde y no se rompió nada**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC: $?"
node node_modules/vitest/vitest.mjs run > /tmp/a.log 2>&1; echo "TESTS: $?"; tail -4 /tmp/a.log
```

Esperado: los dos en EXIT 0.

- [ ] **Paso 5: Verificar que el guardián SIGUE SIRVIENDO**

Un guardián que pasa no prueba nada. Plantá una violación y confirmá que sale en rojo:

```bash
printf 'export const X = () => <button className="bg-accent text-white">x</button>;\n' > src/_prueba.tsx
node node_modules/vitest/vitest.mjs run src/components/Button.guard.test.ts > /tmp/g.log 2>&1; echo "CON VIOLACION: $? (debe ser 1)"
rm -f src/_prueba.tsx
node node_modules/vitest/vitest.mjs run src/components/Button.guard.test.ts > /tmp/g.log 2>&1; echo "LIMPIO: $? (debe ser 0)"
```

- [ ] **Paso 6: Commit**

```bash
git add -A
git commit -m "fix: 25 botones que en modo oscuro no se podian leer"
```

---

## Task B3: Los tokens que están escritos y nadie usa

**Medido:** `ease-salida` **0 usos**. `duration-rapido` **0 usos**. `duration-medio` **0 usos**.
Contra **55** `transition` pelados, que usan la curva por defecto de Tailwind — justamente la que
`docs/SISTEMA-VISUAL.md` dice que no hay que usar. La gramática de movimiento existe en el
documento y en la config; en la pantalla no existe.

Y dos colisiones que nadie puede ver:
- `rounded-xl` y `rounded-2xl` **son el mismo píxel**: `xl` está declarado en 16px y `2xl` quedó en
  el default de Tailwind, que también es 1rem. Alguien que quiso diferenciar dos tarjetas cambiando
  de uno a otro no cambió nada y no tiene forma de enterarse.
- `--chip` es idéntico a `--surface2` en claro y a `--accent-soft` en oscuro. `--naranja` es
  idéntico a `--warn` en los dos modos.

**Archivos:**
- Modificar: `tailwind.config.js`, `src/index.css`

- [ ] **Paso 1: Declarar `2xl` para que la colisión sea una decisión**

En `tailwind.config.js`, línea 24:

```js
// `2xl` explícito. Antes no estaba declarado y caía al default de Tailwind (1rem = 16px), o sea
// EL MISMO valor que `xl`. Dos intenciones distintas escritas en el código produciendo el mismo
// píxel, sin ninguna forma de notarlo. Roles: md para chips y controles chicos, lg para botones e
// inputs, xl para tarjetas, 2xl sólo para modales y contenedores de pantalla.
borderRadius: { md: "8px", lg: "12px", xl: "16px", "2xl": "20px" },
```

- [ ] **Paso 2: Agregar la escala de espaciado, que hoy no existe**

Medido sobre todo `src/`: se usan `py-1`, `py-1.5`, `py-2`, `py-2.5`, `py-3`, `py-3.5`, `py-4`,
`py-6`, `py-8`, `py-10` y `py-14` — once valores verticales para lo mismo. El trabajo duro ya se
hizo con la tipografía (571 tamaños a mano reducidos a nueve pasos, con guardián). El espaciado
quedó en el estado del que se sacó a la tipografía.

En `theme.extend` de `tailwind.config.js`:

```js
// ESCALA DE ESPACIADO. No existía: había once valores verticales y nueve horizontales para lo
// mismo, con todos los medios pasos. El ritmo vertical es lo que hace que una interfaz se sienta
// fabricada en vez de ensamblada, y es más barato de arreglar que el color.
//
// Siete pasos alcanzan. Los medios pasos (`py-2.5`) quedan disponibles porque sacarlos de una
// rompería 600 lugares; el camino es migrarlos por tandas y recién ahí prohibirlos con guardián.
spacing: { 1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "24px", 6: "32px", 7: "48px" },
```

- [ ] **Paso 3: Que la regla de movimiento sea una sola, y sea la del sistema**

En `src/index.css`, agregar a `:root` y reemplazar la regla global de la línea 87:

```css
:root {
  /* Los tokens de movimiento existían en tailwind.config.js con CERO usos, mientras 55 lugares
     escribían `transition` pelado — que es el default de Tailwind: 150ms con la curva
     cubic-bezier(.4,0,.2,1), justo la que SISTEMA-VISUAL.md dice que no va. Cuatro timings
     compitiendo y ninguno era el del sistema. */
  --dur-rapido: 120ms;
  --dur-medio: 200ms;
  --ease-salida: cubic-bezier(.22, 1, .36, 1);
}

/* Una sola regla, y es ésta. Enumerar las propiedades en vez de usar `transition: all` importa:
   `all` anima también `height` y `width`, que es lo que produce los saltos cuando react-query
   invalida y el contenido cambia de tamaño. */
button, a, input, select, textarea {
  transition: background-color var(--dur-rapido) var(--ease-salida),
              border-color     var(--dur-rapido) var(--ease-salida),
              color            var(--dur-rapido) var(--ease-salida),
              box-shadow       var(--dur-rapido) var(--ease-salida),
              transform        var(--dur-rapido) var(--ease-salida);
}
```

- [ ] **Paso 4: Borrar los dos tokens que son alias de otros**

`--chip` y `--naranja` tienen exactamente el mismo valor que `--surface2` y `--warn` en los dos
modos. Reemplazar sus usos y borrar las declaraciones.

```bash
grep -rn "bg-chip\|--chip\|--naranja\|naranja" src/ --include="*.tsx" --include="*.css" | wc -l
```

Reemplazá uno por uno (nunca con `sed`), después borrá las declaraciones de `src/index.css`.

- [ ] **Paso 5: Escribir en el documento la regla que falta — cuándo NO animar**

En `docs/SISTEMA-VISUAL.md`, sección de movimiento:

```markdown
### Cuándo NO animar

Nada que cambie por dato del servidor se anima. Cuando react-query invalida y vuelve a dibujar,
una transición convierte la actualización en un parpadeo — y el usuario no distingue un parpadeo
de un error.

Se anima sólo lo que responde a un gesto de la persona: un hover, un click, abrir un modal.

Corolario práctico: si tenés que escribir `transition` en un elemento que no es un control, casi
siempre la respuesta correcta es no animarlo.
```

- [ ] **Paso 6: Verificar**

```bash
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD: $?"
node scripts/peso.mjs
node node_modules/vitest/vitest.mjs run > /tmp/a.log 2>&1; echo "TESTS: $?"; tail -4 /tmp/a.log
```

Esperado: build EXIT 0, peso dentro del presupuesto, tests EXIT 0.

- [ ] **Paso 7: Commit**

```bash
git add tailwind.config.js src/index.css docs/SISTEMA-VISUAL.md src/
git commit -m "fix: rounded-xl y rounded-2xl eran el mismo pixel, y el movimiento no usaba sus tokens"
```

---

## Task B0: 69 clases que no generan una sola línea de CSS

**Va primero de toda la Fase B.** Es el hallazgo más grave de las tres auditorías y es el mismo
modo de falla que costó cinco pantallas sin sombra durante meses: el navegador descarta en
silencio y nadie se entera.

**Qué pasa.** Los colores de la marca están definidos en `tailwind.config.js` como `var(--x)`
planas. **Tailwind 3 no sabe aplicarle un modificador de opacidad a un color así** —necesita el
placeholder `<alpha-value>`— y en vez de avisar, **no emite la regla**. Cada `border-line/60`,
`bg-surface2/40`, `border-accent/40` es una clase que no existe.

**Verificado de forma concluyente** contra el CSS compilado:

```
border-line       (sin opacidad)  -> existe en el bundle
border-line/60    (con opacidad)  -> NO existe
white/10          (hex, no token) -> existe
```

La contraprueba con `white` es la que cierra el caso: no es que Tailwind no pueda hacer opacidad,
es que no puede hacerla **sobre un token `var()`**.

**Alcance medido: 69 usos en 20 archivos.** Los más repetidos:

| Usos | Clase | Dónde |
|---|---|---|
| 16 | `border-line/60` | NotificacionesPanel, Admin, PlantillaCierre |
| 10 | `border-accent/40` | Board, Calendario, MiDia |
| 7 | `border-line/70` | Shell (la barra superior), Board, Calendario |
| 4 | `border-warn/50` | ArqueoResultDialog, CumplimientoDiario, MiDia |
| 4 | `bg-surface2/40` | VacacionesModal, MiDia, TuSemana |

**Lo que hay que entender antes de arreglarlo:** cuando esto se corrija, **69 bordes y fondos que
hoy son invisibles van a aparecer de golpe**. No es un efecto secundario de la migración: *es* la
migración. Hay que mirar las 20 pantallas después.

**Archivos:**
- Crear: `src/lib/opacidad.guard.test.ts`
- Modificar: `tailwind.config.js` o `src/index.css` (según el camino que se elija)

- [ ] **Paso 1: Escribir el guardián que lo detecta, antes de arreglar nada**

```ts
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// GUARDIÁN DE OPACIDAD SOBRE TOKENS.
//
// POR QUÉ EXISTE. Los colores de la marca son `var(--x)` planas. Tailwind 3 no puede aplicarles
// un modificador de opacidad —necesita el placeholder `<alpha-value>`— y cuando no puede, NO
// EMITE LA REGLA. Sin error, sin warning, sin nada.
//
// Había 69 usos de `border-line/60`, `bg-surface2/40` y parecidas dibujándose sin ningún borde y
// sin ningún fondo, en 20 archivos, y nadie lo notó nunca. Es exactamente el mismo modo de falla
// que `box-shadow: var(--ring),var(--shadow)`, que dejó cinco pantallas sin sombra durante meses.
//
// La lección, que ya es la segunda vez: cuando el navegador descarta algo en silencio, la única
// forma de enterarse es un test que lo busque a propósito.
const TOKENS = "line|surface2|surface|ink2|ink|accent|warn|danger|done|chip|bg";
const RE = new RegExp(`\\b(?:border|bg|text|ring|from|to|via)-(?:${TOKENS})\\/\\d+`, "g");

describe("opacidad sobre tokens de color", () => {
  it("nadie le pone opacidad a un color que es una variable CSS", () => {
    const culpables: string[] = [];
    for (const ruta of archivosFuente("src")) {
      const lineas = readFileSync(ruta, "utf8").split("\n");
      for (let i = 0; i < lineas.length; i++) {
        const m = lineas[i].match(RE);
        if (m) culpables.push(`${ruta}:${i + 1}: ${[...new Set(m)].join(", ")}`);
      }
    }
    expect(
      culpables,
      "Tailwind 3 NO genera CSS para esto: la clase existe en el fuente y no en el bundle, así " +
      "que el borde o el fondo no se dibuja. Usá el token sin opacidad, o definí una variable " +
      "nueva en index.css con el valor ya mezclado.\n" + culpables.join("\n"),
    ).toEqual([]);
  });
});

function archivosFuente(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) { out.push(...archivosFuente(ruta)); continue; }
    if (!/\.tsx$/.test(nombre) || /\.test\.tsx$/.test(nombre)) continue;
    out.push(ruta);
  }
  return out;
}
```

- [ ] **Paso 2: Correr y confirmar que encuentra los 69**

```bash
node node_modules/vitest/vitest.mjs run src/lib/opacidad.guard.test.ts > /tmp/o.log 2>&1; echo "EXIT: $? (debe ser 1)"
grep -c "border-\|bg-\|text-" /tmp/o.log
```

Si el número no está cerca de 69, contá a mano y entendé la diferencia antes de seguir:

```bash
grep -rhoE "(border|bg|text|ring)-(line|surface2|surface|ink2|ink|accent|warn|danger|done)/[0-9]+" src/ --include="*.tsx" | wc -l
```

- [ ] **Paso 3: Elegir el camino, y es una decisión real**

**(a) Definir las mezclas como variables propias.** Para cada combinación que se usa de verdad
(son ~10 distintas), una variable en `src/index.css` con el color ya mezclado:

```css
/* `--line` al 60%. No se puede escribir `border-line/60` porque Tailwind 3 no genera esa clase
   cuando el color es una `var()` plana; hay que darle el valor ya resuelto. */
--line-60: color-mix(in oklab, var(--line) 60%, transparent);
```

Funciona hoy, sin migrar nada, y `color-mix` está soportado en todos los navegadores desde 2023.

**(b) Migrar a Tailwind 4.** Resuelve la opacidad con `color-mix` automáticamente y el problema
desaparece de raíz. **Es el argumento más fuerte a favor del salto**, mucho más que la velocidad
de build. Pero es un día de trabajo y hay que revisar las 20 pantallas igual.

**Recomendación: (a) ahora, (b) cuando el sistema visual esté asentado.** El camino (a) arregla el
defecto hoy y no bloquea el (b) después.

- [ ] **Paso 4: Mirar las 20 pantallas**

Los tests no pueden decirte si un borde que aparece de golpe se ve bien. Levantá la app y recorré
los archivos que el guardián listó, en los dos temas. Lo que buscás: bordes que ahora se ven
demasiado marcados, o fondos que tapan algo.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/opacidad.guard.test.ts src/index.css src/
git commit -m "fix: 69 clases que no generaban una sola linea de CSS"
```

---

## Task B4: `Vista.tsx` — diez anchos de columna en quince pantallas

**Medido:** `max-w-[560px]`, `[640px]`, `[720px]`, `[760px]`, `[820px]`, `[900px]`, `[940px]`,
`[960px]`, `[1000px]`, `[1200px]`. Diez valores. Y todo pegado a la izquierda salvo Mi día, que es
el único con `mx-auto`.

**Qué se ve:** navegar de Resumen a Reporte a Administración a Mi día hace que el bloque de
contenido cambie de ancho **y de alineación** en cada clic. Es el defecto de composición más
visible del producto: nadie va a decir "el ancho cambia", pero todos van a sentir que la app no
está asentada.

**Archivos:**
- Crear: `src/components/Vista.tsx`, `src/components/Vista.test.tsx`, `src/components/Vista.guard.test.ts`
- Modificar: las 15 pantallas de `src/features/**`

**Interfaces:**
- Produce: `<Vista ancho?="lectura" | "panel" | "tablero">`

- [ ] **Paso 1: Escribir el test (falla: no existe)**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Vista } from "./Vista";

describe("Vista", () => {
  it("centra siempre, en los tres anchos", () => {
    // Sólo una de quince pantallas tenía `mx-auto`. En un monitor ancho eso significa que catorce
    // quedan pegadas a la izquierda con un vacío a la derecha, y una centrada.
    for (const ancho of ["lectura", "panel", "tablero"] as const) {
      const { container } = render(<Vista ancho={ancho}>x</Vista>);
      expect(container.firstElementChild!.className).toContain("mx-auto");
    }
  });

  it("el padding es responsive", () => {
    // Catorce de quince usaban `px-6` fijo, sin variante. En un teléfono de 375px eso son 48px
    // de los 375 gastados en aire.
    const { container } = render(<Vista>x</Vista>);
    expect(container.firstElementChild!.className).toContain("px-4");
    expect(container.firstElementChild!.className).toContain("sm:px-6");
  });

  it("el ancho por defecto es panel", () => {
    const { container } = render(<Vista>x</Vista>);
    expect(container.firstElementChild!.className).toContain("max-w-[960px]");
  });

  it("tablero no limita el ancho", () => {
    const { container } = render(<Vista ancho="tablero">x</Vista>);
    expect(container.firstElementChild!.className).toContain("max-w-none");
  });
});
```

- [ ] **Paso 2: Correr y verificar que falla por no existir el módulo**

```bash
node node_modules/vitest/vitest.mjs run src/components/Vista.test.tsx > /tmp/v.log 2>&1; echo "EXIT: $?"; tail -15 /tmp/v.log
```

- [ ] **Paso 3: Implementar `src/components/Vista.tsx`**

```tsx
import type { ReactNode } from "react";
import { cn } from "../lib/ui";

// EL CONTENEDOR DE UNA PANTALLA. Ancho, centrado y padding, decididos una sola vez.
//
// Antes de esto había DIEZ anchos distintos —560, 640, 720, 760, 820, 900, 940, 960, 1000 y
// 1200— y una sola pantalla de quince estaba centrada. Navegar por el menú hacía que el bloque
// de contenido saltara de ancho y de alineación en cada clic.
//
// Nadie dice "el ancho de la columna cambió". Lo que se siente es que la app no está asentada, y
// es de las cosas que más rápido se leen como "hecho por partes".
//
// Los tres anchos se eligen por TIPO DE CONTENIDO, no por pantalla — que es lo que evita que
// vuelvan a ser diez.
const ANCHO = {
  /** Texto que se lee de corrido: Mi día, Anotaciones, Bitácora. Una columna cómoda. */
  lectura: "max-w-[720px]",
  /** Paneles y tablas: Resumen, Reporte, Director, Cierre, Administración, Calendario. */
  panel: "max-w-[960px]",
  /** El tablero kanban, que necesita todo el ancho disponible. */
  tablero: "max-w-none",
} as const;

export function Vista({ ancho = "panel", className, children }: {
  ancho?: keyof typeof ANCHO;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 py-5", ANCHO[ancho], className)}>
      {children}
    </div>
  );
}
```

- [ ] **Paso 4: Correr el test**

```bash
node node_modules/vitest/vitest.mjs run src/components/Vista.test.tsx > /tmp/v.log 2>&1; echo "EXIT: $?"; tail -6 /tmp/v.log
```

Esperado: EXIT 0, 4 tests.

- [ ] **Paso 5: Migrar las pantallas, de a una y mirando cada cierre**

```bash
grep -rn "max-w-\[[0-9]*px\]" src/features/ --include="*.tsx"
```

Para cada resultado, decidí cuál de los tres anchos le corresponde por **tipo de contenido** y
reemplazá el `<div className="max-w-[...] px-6 py-5">` por `<Vista ancho="...">`.

**Nunca con `sed`.** Y de a pocas por commit: si algo se ve mal, tiene que ser fácil saber cuál fue.

- [ ] **Paso 6: Verificar en pantalla, no sólo en tests**

Los tests garantizan que el componente hace lo que dice, **no** que las quince pantallas se vean
bien. Levantá el servidor y recorré el menú de punta a punta mirando una sola cosa: que el bloque
de contenido no salte al cambiar de pantalla.

- [ ] **Paso 7: Commit**

```bash
git add src/components/Vista.tsx src/components/Vista.test.tsx src/features/
git commit -m "feat: un solo contenedor de pantalla, en vez de diez anchos distintos"
```

---

# FASE C — Datos y rendimiento

## Task C1: `useCardPeriodos` trae toda la tabla, de todos los meses, siempre

**Verificado:** `src/hooks/useData.ts:324` dice `await supabase.from("card_periodos").select("*")`
— sin filtro de período, sin `limit`. Se llama desde `App.tsx:76`, o sea en cada carga de la app,
para todos.

**Por qué es urgente y no cosmético:** `card_periodos` suma ~600 filas por mes. **A los dos meses
cruza el corte silencioso de 1.000 filas de PostgREST** — el mismo que este repo ya detectó y
arregló tres veces en otros archivos. Cuando eso pase, el selector de períodos va a dejar de
ofrecer meses que sí existen, y `mergeCardPeriodo` va a caer al fallback devolviendo la tarjeta
cruda. O sea: exactamente el síntoma que la auditoría ya reportó, pero por otra causa.

**Archivos:**
- Modificar: `src/hooks/useData.ts:320-330`, y los llamadores

- [ ] **Paso 1: Ver qué forma tiene hoy y quién lo llama**

```bash
sed -n '315,345p' src/hooks/useData.ts
grep -rn "useCardPeriodos" src/ --include="*.tsx" --include="*.ts" | grep -v "\.test\."
```

- [ ] **Paso 2: Agregar el filtro y meter el período en la clave**

El cambio es de dos líneas, pero la clave de query es la parte que no se puede olvidar: sin
`periodo` adentro, react-query sirve el mes anterior en caché al cambiar de período.

```ts
// Sólo el período que se está mirando. Antes traía TODOS los meses de TODO el equipo, con
// checklist, comentarios e historial completos, en cada carga de la app.
//
// A ~600 filas por mes, a los dos meses cruza el corte silencioso de 1.000 filas de PostgREST
// —que devuelve `error: null`, así que es indistinguible de una tabla chica—. A partir de ahí el
// selector deja de ofrecer meses que existen y el tablero cae al fallback de la tarjeta cruda.
// Este repo ya detectó ese corte tres veces en otros archivos; acá se había pasado por alto.
//
// El índice `card_periodos_owner_periodo_idx` (migración 32) ya cubre esta consulta.
queryKey: ["card_periodos", periodo],
queryFn: async () => {
  const { data, error } = await supabase.from("card_periodos").select("*").eq("periodo", periodo);
  if (error) return [];
  return (data as CardPeriodo[]) ?? [];
},
```

- [ ] **Paso 3: Verificar que al cambiar de período la pantalla se actualiza**

Levantá la app, cambiá de mes en el selector, y confirmá que el tablero muestra el mes elegido.
Si muestra el anterior, la clave de query no tiene el período.

- [ ] **Paso 4: Verificar todo y commitear**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC: $?"
node node_modules/vitest/vitest.mjs run > /tmp/a.log 2>&1; echo "TESTS: $?"; tail -4 /tmp/a.log
git add src/hooks/useData.ts src/App.tsx
git commit -m "fix: los periodos se traian todos, siempre, y en dos meses iba a cortar en silencio"
```

---

## Task C2: Un evento por fila del reinicio mensual dispara un refetch por fila

**Verificado:** `src/hooks/useData.ts:335-341` suscribe a `event: "*"` sobre `cards` **sin filtro
de servidor**, y cada evento invalida la query entera.

**El caso peor no es el día a día: es el 1 de cada mes a las 00:05.** El cron reinicia ~600 filas,
el WAL genera 600 eventos, y cada cliente conectado recibe 600 mensajes por WebSocket. React-query
deduplica los refetch en vuelo, así que no son 600 fetches — pero el canal sí carga 600 mensajes
por usuario, y lo mismo pasa, más chico, cada vez que alguien genera una plantilla (20 inserts) o
reasigna en lote.

**Archivos:**
- Modificar: `src/hooks/useData.ts:332-345`

- [ ] **Paso 1: Agregar el debounce**

```ts
// DEBOUNCE DE 800 ms. El reinicio mensual toca ~600 filas de una, y cada fila es un evento de
// realtime. Sin esto, el 1 de cada mes a las 00:05 cada cliente conectado recibe 600 mensajes y
// dispara una cascada de invalidaciones. Con esto, 600 eventos son un refetch.
//
// 800 ms y no 100: el techo de lo que una persona percibe como "instantáneo" en una lista que se
// actualiza sola está alrededor del segundo, y la mutación optimista ya cubre el caso donde
// importa la respuesta inmediata (tu propio cambio, que ya se ve antes de que el servidor conteste).
let pendiente: ReturnType<typeof setTimeout> | undefined;
const canal = supabase
  .channel("cards-live-v2")
  .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, () => {
    clearTimeout(pendiente);
    pendiente = setTimeout(() => qc.invalidateQueries({ queryKey: ["cards"] }), 800);
  })
  .subscribe();

return () => { clearTimeout(pendiente); supabase.removeChannel(canal); };
```

El `clearTimeout` en la limpieza no es opcional: sin él, desmontar el componente deja un timer
apuntando a una query que ya no existe.

- [ ] **Paso 2: Verificar que el realtime sigue andando**

Abrí la app en dos ventanas con usuarios distintos. Mové una tarjeta en una. La otra tiene que
actualizarse en menos de dos segundos. Si no se actualiza nunca, el `clearTimeout` está mal puesto.

- [ ] **Paso 3: Commit**

```bash
git add src/hooks/useData.ts
git commit -m "fix: 600 eventos del reinicio mensual pasan a ser un refetch"
```

---

## Task C3: Migración 40 — valores imposibles, permisos e índices

Tres cosas del mismo tamaño que van juntas porque son un solo archivo SQL.

**1. Cinco columnas `text` sin CHECK.** La peor es `cards.reset_policy`: un `'menusal'` hace que la
tarea **nunca más se reinicie**, sin error y sin aviso, para siempre. El reinicio filtra por
`coalesce(reset_policy,'mensual') = 'mensual'`. Igual `task_occurrences.resultado`: un `'OK'` en
vez de `'ok'` y el arqueo no lo cuenta ni como correcto ni como diferencia.

**2. `card_periodos` repite por tercera vez la asimetría `using`/`with check`.** Verificado en
`migracion-32:96-115`: leer permite `owner = auth.uid() or es_jefe() or es_encargado_de(owner)`;
escribir permite **sólo** `owner = auth.uid()`. Es el mismo bug que la migración 36 arregló para
`task_occurrences` y la 39 para `notifications`. Un encargado que abre el tablero de alguien de su
equipo, navega a un mes no vigente y marca una tarea, recibe
`new row violates row-level security policy`.

**3. Cuatro índices que faltan**, el más importante `cards_archive(owner, mes desc)`: esa es la
tabla que más crece y `useArchive` la consulta cada vez que alguien abre el historial de una persona.

**Archivos:**
- Crear: `migracion-40-integridad-y-permisos.sql`
- Modificar: `src/lib/migraciones.ts` (agregar 40 a `MIGRACIONES_ESPERADAS`)

- [ ] **Paso 1: Antes de escribir los CHECK, mirar qué hay en la base**

Esta consulta la corre el dueño en Supabase → SQL Editor. **Si devuelve valores fuera del conjunto
esperado, hay filas ya rotas y hay que limpiarlas primero** — y esas filas probablemente expliquen
discrepancias que alguien viene notando.

```sql
select 'cards.reset_policy' as col, coalesce(reset_policy,'(null)') as valor, count(*)
  from public.cards group by 2
union all select 'occ.resultado', coalesce(resultado,'(null)'), count(*)
  from public.task_occurrences group by 2
union all select 'notif.tipo', tipo, count(*) from public.notifications group by 2
union all select 'annos.prioridad', coalesce(prioridad,'(null)'), count(*)
  from public.announcements group by 2
 order by 1, 3 desc;
```

- [ ] **Paso 2: Escribir la migración**

El archivo tiene que seguir el estilo del proyecto: cabecera que explica en criollo qué arregla y
por qué importa, idempotente (`if not exists`, `drop policy if exists`), sección de verificación al
final, y el `insert into schema_migrations` con `on conflict do nothing`.

Los CHECK van con `not valid` primero y `validate constraint` después, para que una fila sucia
existente no aborte la migración entera:

```sql
alter table public.cards
  add constraint cards_reset_policy_check
  check (reset_policy in ('mensual','mantener','manual')) not valid;
alter table public.cards validate constraint cards_reset_policy_check;
```

Los CHECK a agregar: `cards.reset_policy`, `task_occurrences.resultado`,
`announcements.prioridad`, `notifications.tipo`, y `cards_archive.mes` con el patrón
`'^\d{4}-\d{2}$'`.

Las policies de `card_periodos` pasan a tener el **mismo texto** en `using` y en `with check`:
`owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner)`.

Los índices:

```sql
create index if not exists cards_archive_owner_mes_idx on public.cards_archive (owner, mes desc);
create index if not exists task_occurrences_owner_fecha_idx on public.task_occurrences (owner, fecha);
create index if not exists activity_log_owner_at_idx on public.activity_log (owner, at desc);
create index if not exists announcements_visible_to_gin on public.announcements using gin (visible_to);
```

- [ ] **Paso 3: El guardián de migraciones va a fallar, y está bien**

```bash
node node_modules/vitest/vitest.mjs run src/lib/migraciones.guard.test.ts > /tmp/g.log 2>&1; echo "EXIT: $? (debe ser 1)"
```

Esperado: EXIT 1, avisando que la 40 existe como archivo y no está vigilada. Agregá `40` a
`MIGRACIONES_ESPERADAS` en `src/lib/migraciones.ts` y volvé a correr: EXIT 0.

- [ ] **Paso 4: Escribir la regla para que no haya una cuarta vez**

En `CLAUDE.md`, sección 4:

```markdown
- **`using` y `with check` de una tabla de trabajo tienen que decir lo mismo**, salvo que haya un
  motivo escrito al lado. Ya pasó tres veces: migración 36 (`task_occurrences`, `activity_log`),
  39 (`notifications`) y 40 (`card_periodos`). El síntoma siempre es el mismo y siempre confunde:
  alguien VE algo que no puede GUARDAR, y el error que recibe es el crudo de Postgres.
```

- [ ] **Paso 5: Commit**

```bash
git add migracion-40-integridad-y-permisos.sql src/lib/migraciones.ts CLAUDE.md
git commit -m "feat: migracion 40 - valores imposibles, el permiso del encargado y cuatro indices"
```

---

## Task C4: Migración 41 — cuatro de los cinco crons fallan en silencio

**El proyecto ya aprendió esta lección y la aplicó a un solo job.** La migración 37 escribió:
*"un cron que falla callado es peor que no tener cron, porque genera confianza en algo que no está
pasando"*. Ese razonamiento vale para los cinco.

| Job | ¿Deja rastro? | ¿Alguien se entera si falla? |
|---|---|---|
| `reset-recurrentes` | sí, `reinicios_mensuales` | sí, el aviso del tablero |
| `materializar-mes` | no | no |
| `refresh-resumen-mensual` | no | no |
| resumen semanal | publica un aviso | sólo si alguien nota que falta |
| `snapshot-diario` | no | no |

El caso de `refresh-resumen-mensual` ya está documentado en `docs/PASOS-MANUALES.md:283-289`: sin
el cron, el RPC devuelve datos válidos del último refresh, potencialmente de meses atrás, **sin
error ni aviso**. Un dato mudo que envejece.

**Archivos:**
- Crear: `migracion-41-bitacora-de-crons.sql`
- Modificar: `src/lib/migraciones.ts`, `src/features/admin/Admin.tsx`

- [ ] **Paso 1: Ver qué crons existen realmente (lo corre el dueño)**

```sql
select j.jobid, j.jobname, j.schedule, j.active,
       max(r.start_time) filter (where r.status = 'succeeded') as ultimo_ok,
       max(r.start_time) filter (where r.status = 'failed')    as ultimo_error
  from cron.job j left join cron.job_run_details r on r.jobid = j.jobid
 group by j.jobid, j.jobname, j.schedule, j.active order by j.jobid;
```

**Qué mirar:** si `ultimo_ok` de alguno es de hace más de un mes o es `null`, ese job no está
corriendo y nadie se enteró. Y revisá los horarios: están en **UTC**. La auditoría ya detectó que
`materializar_mes_recurrentes` está documentado como `5 0 1 * *`, que en Argentina son las 21:05
del último día del mes anterior — materializa el mes que termina, no el que empieza. La 37 lo hace
bien con `5 3 1 * *`.

- [ ] **Paso 2: Escribir la migración con la bitácora y el envoltorio**

Generaliza lo que la 37 ya inventó para un job: una tabla `cron_bitacora` y una función
`correr_job(nombre, sql)` que registra siempre, falle o no, y que es lo que se programa en el cron
en lugar de la función directa.

- [ ] **Paso 3: Mostrarlo donde ya se mira**

En Administración, al lado del chip de migraciones, un indicador con la última corrida de cada job
en ámbar si pasó su ventana (35 días para los mensuales, 8 para el semanal). Es el mismo patrón del
chip de migraciones, que ya funciona y que el mantenedor ya sabe leer.

**Reglas de esta pantalla:** sin emojis, iconos de `lucide-react`, y el texto en lenguaje de
usuario — "El reinicio mensual no corre desde el 1 de julio", no "cron job failed".

- [ ] **Paso 4: Agregar 41 al guardián y verificar**

```bash
node node_modules/vitest/vitest.mjs run src/lib/migraciones.guard.test.ts > /tmp/g.log 2>&1; echo "EXIT: $?"
```

- [ ] **Paso 5: Commit**

```bash
git add migracion-41-bitacora-de-crons.sql src/lib/migraciones.ts src/features/admin/Admin.tsx
git commit -m "feat: los cinco crons dejan rastro, no solo el del reinicio"
```

---

## Task C5: Sacar `xlsx` — 416 kB para cuatro llamadas

**Medido:** el chunk `xlsx-*.js` pesa **416 kB** y es el segundo más grande de todo el build. La app
usa exactamente cuatro funciones: `book_new`, `aoa_to_sheet`, `book_append_sheet`, `writeFile`
(`src/lib/excel.ts:55-61`).

**Sobre los CVE, el matiz honesto:** `xlsx@0.18.5` es la última versión que SheetJS publicó en npm
antes de mudarse a su propio CDN, y arrastra dos vulnerabilidades de severidad alta sin arreglo
posible desde npm. **Pero las dos están en el camino de LECTURA de archivos, y esta app sólo
escribe.** No son alcanzables.

Lo que sí es real es el costo permanente: la alerta va a aparecer en cada auditoría de seguridad
para siempre. Y ya vimos en este proyecto lo que hace una alarma que no se puede apagar.

**Archivos:**
- Crear: `src/lib/excel-min.ts`, `src/lib/excel-min.test.ts`
- Modificar: `src/lib/excel.ts:55-61`

- [ ] **Paso 1: Decidir el alcance mirando qué se exporta hoy**

```bash
sed -n '1,70p' src/lib/excel.ts
grep -rn "descargarExcel" src/ --include="*.tsx" | grep -v "\.test\."
```

El uso real es tabular: hojas con filas de strings y números. **No** hay fórmulas, ni formatos, ni
estilos, ni fechas con formato de Excel. Eso es lo que hay que reproducir, y nada más.

- [ ] **Paso 2: Escribir el test antes que el escritor**

Un `.xlsx` es un ZIP con XML adentro. El test tiene que verificar la estructura, no sólo que no
tire error:

```ts
import { describe, it, expect } from "vitest";
import { construirXlsx } from "./excel-min";

describe("excel-min", () => {
  it("genera un ZIP con las partes que Excel exige", async () => {
    const blob = construirXlsx([{ nombre: "Resumen", filas: [["Mes", "Total"], ["2026-08", 42]] }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Firma de ZIP: PK\x03\x04. Si esto falla, el archivo no abre en ningún lado.
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("escapa los caracteres que romperían el XML", () => {
    // Un nombre de empresa con & o < rompe el archivo entero y Excel dice "formato no válido",
    // sin decir dónde. Es el modo de falla más probable de un escritor propio.
    const blob = construirXlsx([{ nombre: "H", filas: [["Torres & Cía <SA>"]] }]);
    expect(blob).toBeInstanceOf(Blob);
  });

  it("distingue números de texto", () => {
    // Si un número va como texto, Excel lo alinea a la izquierda y no se puede sumar. Es la
    // diferencia entre una exportación que sirve y una que hay que reescribir a mano.
    const blob = construirXlsx([{ nombre: "H", filas: [["Cant", 42]] }]);
    expect(blob).toBeInstanceOf(Blob);
  });
});
```

- [ ] **Paso 3: Correr y verificar que falla por no existir el módulo**

```bash
node node_modules/vitest/vitest.mjs run src/lib/excel-min.test.ts > /tmp/e.log 2>&1; echo "EXIT: $?"; tail -10 /tmp/e.log
```

- [ ] **Paso 4: Implementar `excel-min.ts`**

Un `.xlsx` mínimo son cinco entradas en un ZIP: `[Content_Types].xml`, `_rels/.rels`,
`xl/workbook.xml`, `xl/_rels/workbook.xml.rels` y una `xl/worksheets/sheetN.xml` por hoja. El ZIP
puede ir **sin comprimir** (método 0), lo que evita tener que implementar deflate — el archivo pesa
más pero se genera en el navegador sin ninguna dependencia.

Puntos donde esto se rompe si no se cuida, y que por eso van comentados en el código:
- **Escapar `& < > "` en todo texto.** Es la falla más probable y Excel no dice dónde está.
- **Distinguir número de texto** (`t="n"` contra `t="str"`), o los números no se pueden sumar.
- **CRC-32 correcto** por entrada, o el ZIP se considera corrupto.

- [ ] **Paso 5: Verificar que el archivo abre de verdad**

Los tests verifican la estructura. **No verifican que Excel lo abra.** Generá un archivo desde la
app, abrilo en Excel y en Google Sheets, y confirmá: las hojas tienen nombre, los números están a
la derecha, y los acentos y la eñe se ven bien.

Si no abre, **no sigas**: revertí a `xlsx` y reportá. Una exportación rota es peor que una pesada.

- [ ] **Paso 6: Cambiar el import y medir**

En `src/lib/excel.ts:55`, reemplazar `await import("xlsx")` por `construirXlsx` de `./excel-min`.

```bash
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD: $?"
ls -S dist/assets/*.js | head -5
```

Esperado: el chunk `xlsx-*.js` ya no aparece.

- [ ] **Paso 7: Sacar la dependencia por el workflow**

GitHub → Actions → Dependencias → Run workflow → `quitar` → `xlsx`.

Aprovechá la misma corrida para las siete que están instaladas y no se usan, **menos las tres que
`Button` ahora sí usa**: quitar `@base-ui/react`, `shadcn`, `tw-animate-css` y `motion`; y
**dejar** `class-variance-authority`, `clsx` y `tailwind-merge`.

- [ ] **Paso 8: Commit**

```bash
git add src/lib/excel-min.ts src/lib/excel-min.test.ts src/lib/excel.ts
git commit -m "perf: 416 kB menos, y una alerta de seguridad que deja de sonar para siempre"
```

---

# FASE D — Las dos decisiones que necesitan una conversación

Estas **no son tareas**. Son las dos cosas más importantes del análisis y las dos que no se pueden
empezar sin una decisión tomada.

## D1. El tablero no funciona en un teléfono, y nadie lo dice

**Verificado:** el arrastre usa HTML5 nativo (`draggable` + `dataTransfer`, `Board.tsx:304` y
`:406`). **HTML5 drag-and-drop no dispara con eventos táctiles en ningún navegador móvil.** No hay
`onTouchStart` ni `onPointerDown` en todo el proyecto. El teclado sobre una tarjeta sólo la abre.

O sea: la interacción central del producto —mover una tarea de columna— **no existe en el
teléfono**. Lo único que se puede hacer ahí es mirar, y entrar al modal a marcar "terminada".

Y el diagnóstico general: 11 de 70 archivos `.tsx` tienen algún breakpoint. Las columnas son de
290px fijos, o sea 1.268px de ancho total en una pantalla de 375.

**Las dos salidas, y no son equivalentes:**

**(a) Meter una librería de drag táctil** (`dnd-kit`). Conserva el gesto en todos lados. Cuesta una
dependencia nueva, reescribir el arrastre, y el drag con el dedo en una pantalla chica sigue siendo
incómodo aunque funcione.

**(b) Reemplazar el kanban en móvil, no portarlo.** En menos de 768px: una sola columna por vez,
con un selector arriba (`Pendiente · En proceso · Terminado`) y un botón explícito de "Mover a" de
44px en cada tarjeta. Es una fracción del trabajo, no agrega dependencias, y **es mejor que el
arrastre incluso donde el arrastre funciona** — porque un botón que dice a dónde va es más rápido y
más preciso que arrastrar.

**Mi recomendación es la (b)**, y la razón de fondo: el arrastre es una metáfora de escritorio. En
un teléfono, lo que la gente espera es tocar. Pero antes de escribir una línea hay una pregunta que
sólo vos podés contestar: **¿alguien del equipo usa hoy la app desde el teléfono?** Si nadie la usa
—y puede ser que nadie la use *porque* no funciona—, el orden correcto es distinto.

## D0. Dependabot tiene silenciadas TODAS las actualizaciones mayores

Esto no es una decisión difícil, es una línea para borrar — pero va acá porque **explica por qué el
proyecto se quedó atrás sin que nadie lo decidiera**.

`.github/dependabot.yml:41-44` dice:

```yaml
ignore:
  - dependency-name: "*"
    update-types: ["version-update:semver-major"]
```

Y el comentario que tiene arriba dice: *"Las mayores NO se agrupan: Dependabot las abre por
separado y se revisan una por una."*

**`ignore` significa ignorar, no separar.** Dependabot no va a proponer nunca una mayor. Ni Tailwind
4, ni React 20, ni Vite 9, ni el día que salga un parche de seguridad que sólo exista en una mayor.

Es el mismo patrón que el chip de migraciones ciego y que el archivo que gritaba una emergencia
resuelta: **un mecanismo que parece estar cuidando algo y no lo está**. Y el comentario al lado
describe un comportamiento que el código no tiene, que es lo que hace que nadie lo revise.

**El arreglo es borrar el bloque `ignore` entero.** El agrupamiento de menores y parches ya está
bien resuelto más arriba, y `open-pull-requests-limit: 5` evita el desborde.

---

## D2. El estado de una tarea vive en cuatro tablas, y de ahí salen cuatro bugs

Hoy el estado de trabajo de una tarea está repartido así: `cards` guarda el del mes vigente,
`card_periodos` el de los demás meses, `task_occurrences` el del día, y `cards_archive` una foto
mensual. Hay un `if` en tiempo de ejecución (`periodo-instancias.ts:87`) decidiendo cuál leer.

**Los cuatro hallazgos más graves de la auditoría son consecuencia directa de esa dualidad, no
coincidencias:**

- El reinicio mensual **tiene que mutar** `cards`; como la foto se saca de algo que después se
  rompe, correrlo dos veces destruye el mes.
- El trabajo adelantado en `card_periodos` queda huérfano cuando ese mes pasa a ser el vigente,
  porque el `if` cambia de rama.
- Una pestaña abierta al cambiar el mes escribe en el mes viejo, porque hay dos lugares donde
  escribir.
- El semáforo del Cierre existe para verificar que las recurrentes arrancaron en cero — algo que
  sólo hay que verificar porque el reinicio muta datos.

**La alternativa: `card_periodos` como única fuente del estado, siempre, incluido el mes vigente.**
`cards` queda como definición pura. Un mes nuevo no tiene fila, y no tener fila **es** estar
pendiente.

Lo que se borra solo con ese cambio: el reinicio mensual como operación (no hay nada que mutar),
`cards_archive` entera (el archivo del mes M *es* `where periodo = 'M'`, inmutable por
construcción), el `if` de `periodo-instancias`, y tres de las cuatro copias del criterio de
recurrencia.

**Es el único cambio de todo este análisis que QUITA código en vez de agregarlo.** También es el más
grande: toca unos 15 archivos del front y no se puede hacer a pedazos sin quedar peor a mitad de
camino.

**El indicador de cuándo:** `cards_archive` cruza las 5.000 filas alrededor del mes 8 de uso, y a
partir de ahí el Comparador empieza a descartar meses viejos avisando sólo por `console.warn`. Cada
mes que pasa suma un mes de datos para migrar.

**Lo que hace falta antes de empezar:** que corras la consulta D3 (`pg_stat_user_tables`) y sepamos
cuántas filas tiene `cards_archive` hoy. Ese número dice si esto es para el mes que viene o para
dentro de seis.

---

# FASE E — Las tres del arquitecto de front

Van aparte porque son de otra naturaleza: no cambian lo que se ve, cambian lo que cuesta trabajar.
Todo lo de acá está medido en esta máquina, no estimado.

## Task E1: La suite tarda 6,6 veces más de lo necesario

**Medido:** de 108 archivos de test, sólo **11** necesitan DOM. Los otros 97 pagan el arranque de
jsdom para probar funciones puras.

```
mismos 98 archivos, mismos 1138 tests:
  jsdom : 87,33 s
  node  : 13,14 s     -> 6,6x, 74 segundos menos
```

**Por qué va primero de esta fase:** el hook de pre-commit corre `tsc` (14 s) más la suite entera.
CLAUDE.md ya documenta esos 90-180 s como fricción. **Es el cambio que hace más barato hacer todos
los demás**, y se paga en cada commit de los próximos dos años.

- [ ] **Paso 1: Confirmar el corte**

```bash
node node_modules/vitest/vitest.mjs run src/lib --environment node > /tmp/n.log 2>&1; echo "EXIT: $?"; tail -12 /tmp/n.log
```

Los archivos que fallen son exactamente los que sí usan DOM. Anotalos: son la lista de excepciones.

- [ ] **Paso 2: Partir el entorno con `test.projects`**

Vitest 4 sacó `environmentMatchGlobs` y el docblock `@vitest-environment` ya no se parsea. Lo que
sí existe es `projects`. En `vite.config.ts`:

```ts
test: {
  projects: [
    // Los tests de lógica no tocan el DOM. Montarles jsdom cuesta 74 segundos por corrida para
    // probar funciones puras — y un ciclo de feedback largo es lo que hace que alguien empiece a
    // saltearse el hook de pre-commit, que es la red que evita subir algo roto.
    { extends: true, test: { name: "logica", environment: "node",
        include: ["src/**/*.test.ts"],
        exclude: ["src/lib/{prefs,red-global,impresion-dom}.test.ts"] } },
    { extends: true, test: { name: "ui", environment: "jsdom",
        include: ["src/**/*.test.tsx", "src/lib/{prefs,red-global,impresion-dom}.test.ts"] } },
  ],
}
```

Ajustá la lista de excepciones con lo que hayas anotado en el paso 1: si adivinás, algún test se
va a quedar afuera de los dos proyectos y **va a dejar de correr sin que nadie lo note**.

- [ ] **Paso 3: Verificar que corren TODOS**

```bash
node node_modules/vitest/vitest.mjs run > /tmp/a.log 2>&1; echo "EXIT: $?"; tail -5 /tmp/a.log
```

Esperado: EXIT 0 y **1202 tests**, el mismo número que antes. Si son menos, algún archivo quedó
huérfano entre los dos proyectos: ése es el riesgo real de este cambio y por eso se verifica el
número, no sólo el exit code.

- [ ] **Paso 4: Commit**

```bash
git add vite.config.ts
git commit -m "perf: los tests de logica dejan de montar jsdom - 87s a 13s"
```

---

## Task E2: El presupuesto de peso no cuenta el archivo más pesado

**Medido:** `src/assets/InterVariable.woff2` pesa **352.240 bytes**. `scripts/peso.mjs` filtra por
`/^(index|vendor-)/` y por extensión `.js|.css`, así que la fuente no entra por ninguno de los dos.

```
lo que mide el gate:  222,4 kB  ("entra con 17,6 kB de margen")
primer render real:   574,6 kB
```

Y no hay `<link rel="preload">`: el navegador la descubre recién después de bajar y parsear el CSS.

**Por qué importa más que cualquier optimización de JS:** los ocho `lazy()` que faltan valen 12-18
kB. Esto vale ~260 kB. Y un presupuesto que no cuenta el activo más grande entrena a confiar en un
número equivocado — que es justo lo que el propio script dice venir a evitar.

- [ ] **Paso 1: Meter la fuente en la medición, antes de optimizarla**

En `scripts/peso.mjs`, que `ES_DE_ARRANQUE` incluya `.woff2`. El número va a saltar de 222 a ~575 y
**el gate va a fallar**. Eso es correcto: el presupuesto estaba mal, no el archivo.

Subir el presupuesto a un valor que refleje la realidad de hoy (por ejemplo 600 kB) y dejar escrito
en el comentario que baja a 320 cuando la fuente esté subseteada. Un presupuesto que se cumple
mintiendo no es un presupuesto.

- [ ] **Paso 2: Subsetear a latín**

La app es sólo en español. El archivo de rsms trae Griego, Cirílico y Vietnamita que nunca se usan.
Generar el subconjunto `latin` + `latin-ext` y reemplazar el archivo.

**Medí el resultado real** antes de anotar ningún número: el tamaño depende de la herramienta y de
los rangos incluidos.

- [ ] **Paso 3: Precargarla**

En `index.html`, un `<link rel="preload" as="font" type="font/woff2" crossorigin>` apuntando al
archivo con hash. Sin `crossorigin` el navegador la baja dos veces.

- [ ] **Paso 4: Verificar y bajar el presupuesto**

```bash
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD: $?"
node scripts/peso.mjs
```

Con el número real medido, ajustá el presupuesto a algo que apriete de verdad.

- [ ] **Paso 5: Commit**

```bash
git add scripts/peso.mjs index.html src/assets/ src/index.css
git commit -m "perf: la fuente pesaba mas que todo el JS y no la contaba nadie"
```

---

## Task E3: Siete componentes definidos adentro del render

**Medido con el linter que ya está instalado, sólo apagado:**

```bash
node node_modules/oxlint/bin/oxlint -A all -D react/no-unstable-nested-components
```

Siete errores. El que más duele es `NavItem` en `Shell.tsx:32`: se recrea con identidad nueva en
cada render, así que para React es un tipo de componente distinto y **desmonta y vuelve a montar
los ~15 botones de la barra lateral** en vez de reconciliarlos. Como el estado del buscador vive en
`App`, **cada tecla en "Buscar tarea…" dispara ese remonte completo**.

- [ ] **Paso 1: Encender la regla**

En `.oxlintrc.json`: `"react/no-unstable-nested-components": "error"`.

- [ ] **Paso 2: Confirmar que falla con los siete**

```bash
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "EXIT: $? (debe ser 1)"; grep -c "no-unstable" /tmp/l.log
```

- [ ] **Paso 3: Sacar los siete al nivel de módulo**

Uno por uno, pasándoles como props lo que hoy toman del closure. Es mecánico pero **no es
automático**: cada uno usa variables distintas del render que lo contiene.

- [ ] **Paso 4: Verificar**

```bash
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/a.log 2>&1; echo "TESTS: $?"; tail -4 /tmp/a.log
```

- [ ] **Paso 5: Commit**

```bash
git add .oxlintrc.json src/
git commit -m "perf: siete componentes se recreaban en cada render"
```

---

# FASE F — Lo que ninguno de los tres auditores miró

Esta fase salió de una guía general de buenas prácticas que trajo un tercero. **Vale decir de dónde
vino**: los tres auditores leyeron el código, y estas dos cosas no viven en el código — viven en la
respuesta HTTP y en el navegador. Una lista genérica encontró lo que tres revisiones profundas no
buscaron, y eso es exactamente para lo que sirven las listas genéricas.

## Task F1: La app no manda una sola cabecera de seguridad

**Verificado:** `public/_headers` **no existe**. No hay `Content-Security-Policy`, ni
`X-Frame-Options`, ni `Strict-Transport-Security`, ni `Referrer-Policy` en ningún lado del
proyecto.

**Por qué en esta app importa más que en la mayoría.** El modelo de seguridad entero es la RLS de
Postgres, y la clave pública de Supabase está en el bundle *por diseño*. Eso significa que
**cualquier script que logre ejecutarse en la página puede hablar con PostgREST como el usuario
que tiene la sesión abierta**, con todos sus permisos. No necesita robar nada: usa la sesión que
ya está.

Una `Content-Security-Policy` es la única defensa contra eso, y hoy no hay ninguna.

El vector más plausible no es exótico: el tablón de avisos, los comentarios de una tarjeta y las
consultas aceptan texto que después se muestra. React escapa por defecto —eso está bien—, pero
alcanza un solo `dangerouslySetInnerHTML` futuro, o una dependencia comprometida, para que no
haya nada atajando.

**Archivos:**
- Crear: `public/_headers`
- Test: `e2e/cabeceras.spec.ts`

- [ ] **Paso 1: Ver qué se está sirviendo hoy**

```bash
curl -sI https://<tu-dominio> | grep -i "content-security\|x-frame\|strict-transport\|referrer\|permissions"
```

Esperado hoy: nada. Cloudflare agrega HSTS por su cuenta en algunos planes, así que puede aparecer
sólo esa. Anotá lo que salga: es la línea de base.

- [ ] **Paso 2: Escribir `public/_headers`**

`_headers` es la convención de Cloudflare Pages, la misma familia que el `_redirects` que ya usás
para el proxy de ARCA.

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://yyyrlopgwmuvfbzwxiwp.supabase.co wss://yyyrlopgwmuvfbzwxiwp.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Los dos puntos donde esto se rompe si no se cuida, y por eso van explicados:

- **`style-src` lleva `'unsafe-inline'` y no se puede sacar.** Tailwind no lo necesita, pero el
  proyecto usa `style={{ ... }}` inline en varios lugares (las barras de progreso calculan el
  ancho, las sombras de tarjeta). Sacarlo dejaría media app sin estilos. `script-src` sí queda
  estricto, que es el que importa.
- **`connect-src` tiene que nombrar tu proyecto de Supabase, y también el `wss://`**, o el
  realtime deja de conectar en silencio y las notificaciones dejan de llegar sin ningún error
  visible.

- [ ] **Paso 3: Escribir el test que verifica que llegan de verdad**

Un archivo `_headers` mal escrito no da error: Cloudflare ignora las líneas que no entiende. Así
que hay que comprobarlo contra la respuesta real, no contra el archivo.

Crear `e2e/cabeceras.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// Un `_headers` con un error de sintaxis no falla: Cloudflare ignora la línea y sigue. O sea que
// el archivo puede estar en el repo, verse bien, y no estar protegiendo nada. La única forma de
// saberlo es mirar la respuesta.
test("la app manda las cabeceras de seguridad", async ({ request, baseURL }) => {
  const r = await request.get(baseURL!);
  const h = r.headers();

  expect(h["content-security-policy"], "sin CSP, un script inyectado habla con la base como vos").toBeTruthy();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBeTruthy();
});
```

- [ ] **Paso 4: Verificar en la preview antes de main**

Publicá a la rama `dev`, esperá la preview de Cloudflare, y **abrí la app entera** mirando la
consola del navegador. Una CSP mal armada rompe cosas de forma silenciosa: el realtime deja de
conectar, las fuentes no cargan, los `blob:` de las descargas fallan.

Recorré: entrar, mover una tarjeta, abrir el reporte, descargar el Excel, ver que llegue una
notificación. Si algo falla, la consola lo dice con `Refused to ...`.

- [ ] **Paso 5: Commit**

```bash
git add public/_headers e2e/cabeceras.spec.ts
git commit -m "feat: cabeceras de seguridad - hoy no se manda ninguna"
```

---

## Task F2: Nunca se midió lo que siente el usuario

**Verificado:** cero referencias a Lighthouse, a `web-vitals`, a LCP o a CLS en todo el proyecto.

Lo que sí hay es `scripts/peso.mjs`, que mide kilobytes. **Pero kilobytes no es velocidad**, y la
Task E2 ya mostró la trampa: el gate dice "222 kB, entra con margen" mientras el primer render real
son 575 kB porque la fuente no está contada. Se viene optimizando contra un número que no
representa lo que le pasa a una persona abriendo la app.

Y falta lo que ese número no puede ver aunque esté bien: cuánto tarda en aparecer el contenido
(LCP), cuánto salta el layout mientras carga (CLS), y cuánto tarda en responder al primer click
(INP).

- [ ] **Paso 1: Medir la línea de base, antes de tocar nada**

Chrome → DevTools → Lighthouse → Mobile → Analizar. Contra la app publicada, no contra `localhost`
(en local no hay latencia de red y los números mienten hacia arriba).

Anotá los cuatro números en `docs/CONTINUIDAD.md` o en un archivo nuevo, con la fecha:
Rendimiento, LCP, CLS, INP.

**Esa medición es el entregable de este paso.** Sin línea de base, "mejoró" no se puede afirmar.

- [ ] **Paso 2: Repetir después de la Task E2 (la fuente)**

La fuente son ~260 kB del primer render y no tiene `preload`, así que el navegador la descubre
recién después de parsear el CSS. Es el candidato número uno a estar dominando el LCP.

Volvé a medir con los mismos parámetros y compará. **Si el LCP no mejoró, la hipótesis era
equivocada** — y eso también hay que anotarlo, porque evita que alguien repita el intento.

- [ ] **Paso 3: Poner el número donde se vea**

Agregá los valores medidos a `docs/ESTADO-DEL-PROYECTO.md`, en la sección de estado, con la fecha
de la medición. Un número medido hace seis meses y sin fecha es peor que ninguno.

- [ ] **Paso 4: Commit**

```bash
git add docs/
git commit -m "docs: la primera medicion real de lo que siente el usuario"
```

---

## Task F3: La auditoría de dependencias no puede fallar nunca

**Verificado**, `.github/workflows/mantenimiento.yml:45`:

```yaml
npm audit --audit-level=moderate 2>&1 | tail -40 >> $GITHUB_STEP_SUMMARY || true
```

El `|| true` está puesto a propósito y con un comentario que lo explica: sin él, el workflow entero
se corta cuando encuentra algo. El problema no es la decisión, es la consecuencia: **el resultado
va a un resumen que hay que abrir a mano, y siempre va a estar en rojo por `xlsx`**, que no tiene
arreglo posible desde npm.

Es el cuarto caso del mismo patrón que atraviesa todo este plan: un mecanismo que parece estar
cuidando algo y no puede avisar. Los otros tres fueron el chip de migraciones ciego, el respaldo
que trae 7 tablas de 20, y el presupuesto de peso que no cuenta la fuente.

**El arreglo no es sacar el `|| true`** —sin eso vuelve el problema original— sino que la Task C5
saque `xlsx`. Cuando eso pase, el `npm audit` queda limpio y **ahí sí** vale sacarle el `|| true`:
un chequeo que grita siempre se ignora; uno que grita cuando pasa algo, se mira.

- [ ] **Paso 1: Confirmar que quedó limpio después de la Task C5**

```bash
node node_modules/.bin/npm audit --audit-level=moderate 2>&1 | tail -20
```

- [ ] **Paso 2: Sacar el `|| true` y dejar escrito por qué se pudo**

En `mantenimiento.yml`, reemplazar el comentario actual por uno que cuente la historia: que el
`|| true` existió mientras hubo una vulnerabilidad sin arreglo, y que se sacó cuando dejó de
haberla. Sin esa nota, el próximo que se tope con un audit en rojo lo va a volver a poner.

- [ ] **Paso 3: Commit**

```bash
git add .github/workflows/mantenimiento.yml
git commit -m "fix: la auditoria de dependencias vuelve a poder fallar"
```

---

# Herramientas: qué sumar, qué sacar, qué actualizar

Esta tabla es la respuesta corta a "¿qué instalo?". Está ordenada por relación valor/costo, y la
última columna es la que decide: **este proyecto lo mantiene una persona sola que no es
programadora**, así que una herramienta que necesita atención semanal es una mala herramienta acá
aunque sea excelente en abstracto.

| Herramienta | Acción | Qué gana | Qué cuesta | ¿Lo sostiene una persona sola? |
|---|---|---|---|---|
| **`test.projects` de Vitest** | Configurar | La suite baja de 147 s a ~65-75 s (medido: 87 s → 13 s en los tests de lógica) | 10 líneas, cero dependencias | **Sí.** El cambio de menor riesgo de todos |
| **Subset de la fuente + `preload`** | Proceso | ~260 kB menos en el primer render — más que todo lo demás junto | 1 hora, una vez | **Sí.** Se genera y se commitea |
| **`write-excel-file`** en vez de `xlsx` | Cambiar | −100 kB en la descarga diferida; el `npm audit` deja de estar en rojo permanente | ~8 líneas; la parte pura y testeada no se toca | **Sí.** La superficie usada son 4 funciones |
| **`react/no-unstable-nested-components`** en oxlint | Encender | Los 7 componentes que remontan la barra lateral en cada tecla | 1 línea + 30 min | **Sí.** El linter ya está en CI |
| **`_headers` de Cloudflare** | Sumar | CSP y cabeceras de seguridad, que hoy no existen | Un archivo de texto | **Sí.** No es una dependencia |
| **`gen:types` de Supabase** | Activar | Elimina ~121 casts a mano; `tsc` empieza a ver los renombres de columnas | Un comando después de cada migración | **Sí**, pero es la única carga *recurrente* nueva. Vale porque hay 39 migraciones y van a seguir |
| **`@tanstack/react-query-persist-client`** | Sumar | Recargar sin red muestra los últimos datos en vez de una app vacía | ~4 kB gzip, ~15 líneas | **Sí.** Es configuración |
| **Tailwind 4** | Actualizar | Arregla de raíz las 69 clases muertas; builds 3-10x más rápidos; se van `postcss` y `autoprefixer` | ~1 día + revisar 20 pantallas donde van a aparecer estilos que hoy no se ven | **Sí**, pero **después** de que el sistema visual esté asentado |
| **React Router** | Sumar | URLs compartibles, deep links, botón Atrás | ~13 kB + 1-2 días de reescribir la navegación | **Sí**, con reservas. Es la decisión más cara. Hacerla cuando alguien pida compartir un link |
| **7 dependencias sin uso** | **Sacar** | 31 MB, 7 líneas menos de superficie de supply-chain, PRs de Dependabot más limpios | Una corrida del workflow `Dependencias` | **Sí** |
| **Bloque `ignore` de Dependabot** | **Sacar** | Que vuelvan a proponerse las actualizaciones mayores, que hoy están todas silenciadas | Borrar 4 líneas | **Sí** |
| **Sentry / GlitchTip** | Esperar | — | Cuenta, DSN, cuota, y sobre todo *alguien que mire un tablero* | **No todavía.** El canal actual (Consultas + detalle copiable) funciona y no tiene mantenimiento |
| **Virtualización de listas** | **No** | — | Una librería, scroll y drag a rehacer | **No.** Medido: un tablero son ~20 tarjetas, y el techo real es un O(n²) que se arregla con 6 líneas |
| **Reglas `react-perf` de oxlint** | **No** | — | 607 hallazgos medidos, ninguno describe un problema real | **No.** 607 warnings se apagan en una semana y ahí se pierde la costumbre de mirar el linter |
| **typescript-eslint** en vez de oxlint | **No** | — | 10-50x más lento; y las reglas que faltarían ya están todas en oxlint | **No** |

---

# Lo que este plan NO hace, y por qué

- **No migra a Tailwind 4 todavía, pero el argumento cambió.** Yo tenía anotado que el beneficio
  era velocidad de build. **Es mucho más que eso**: Tailwind 4 resuelve la opacidad sobre tokens
  `var()` con `color-mix`, o sea que **arregla de raíz las 69 clases muertas de la Task B0**. Aun
  así va después: la migración hace desaparecer `tailwind.config.js` —donde viven la escala
  tipográfica, la de espaciado nueva y el guardián que las protege— y cambia el modo oscuro a
  `prefers-color-scheme`, mientras acá hay un selector de tres estados sobre `data-theme`. Migrar
  un sistema visual que todavía se está definiendo es hacer el trabajo dos veces. **La superficie
  está medida y es chica**: 0 `space-x`, 0 `divide-`, 0 renombres de sombras o radios, 19
  `outline-none`.
- **No mete virtualización, y ahora con un número.** Se midió la curva: el trabajo de JS por render
  recién cruza un frame (16,7 ms) alrededor de las **4.500 tarjetas vivas**, y el archivado mensual
  mantiene `cards` en los cientos. Además el tablero muestra las tareas *de una persona*: a 30
  personas y 800 tarjetas son ~20 por tablero. **El techo no es la cantidad de nodos: es un O(n²)
  en el cálculo de dependencias**, y eso se arregla con un `Map` de seis líneas, no con una
  librería.
- **No enciende las reglas `react-perf` de oxlint.** Se midieron: **607 hallazgos**. Sin un solo
  `memo()` en el proyecto, esas reglas no describen ningún problema real. 607 warnings se
  desactivan en una semana y ahí se pierde la costumbre de mirar el linter.
- **No suma Sentry todavía.** El canal de errores que existe (Consultas + el detalle copiable del
  ErrorBoundary) funciona y no tiene mantenimiento. Sentry recién vale cuando haya alguien que mire
  un tablero de errores. Si algún día se hace, **GlitchTip o Bugsink son compatibles con el SDK de
  Sentry** —el código no cambia— y GlitchTip da 5.000 eventos al mes gratis.
- **No mete un router.** Hoy la navegación es por estado, y eso significa que no hay URLs
  compartibles ni botón "atrás". Es una carencia real, pero es una decisión de producto ("¿querés
  poder mandarle a alguien el link de una tarea?") antes que técnica.
- **No virtualiza listas.** No hay virtualización en ningún lado, y con ~600 tarjetas no hace falta.
  El límite real no es el renderizado: es el payload de `useCards`, que trae `history` completo de
  todas las tarjetas. Eso se ataca antes, y es más barato.
- **No pasa las migraciones al CLI de Supabase.** Se evaluó y la respuesta es no: `db push` no tiene
  rollback, `db reset` necesita Docker (que esta máquina no puede correr), y aplicar DDL a
  producción desde el CI requiere la contraseña de la base como secret y convierte "pego y leo lo
  que va a pasar" en "se aplicó solo". Para este mantenedor eso es **peor**. Lo que sí vale del CLI
  son dos piezas sueltas: `gen types` desde el CI (cierra la divergencia silenciosa entre el código
  y la base) y `db dump` semanal como respaldo real fuera de la plataforma.

---

# Lo que ya está bien y no hay que tocar

Vale tanto como la lista de problemas, porque dice dónde **no** gastar tiempo.

**Del front:**
- `clasificarFalla` + `ErrorBoundary`. La acción que se ofrece depende del tipo de falla en vez de
  ser un "Reintentar" de adorno, el orden de las ramas está razonado, y hay "Copiar detalle" porque
  el canal real es Consultas. Está por encima de la media de productos pagos.
- El foco visible con `:focus-visible` y la excepción de la barra oscura, resuelto **por la razón
  correcta**.
- Sacar la librería de animación de 42 kB replicando el resorte con una curva equivalente.
- El encuadre no punitivo, y sobre todo *cómo* está implementado: orden alfabético y barra
  normalizada contra el total del equipo, con el razonamiento escrito ("con el máximo, la barra más
  larga siempre llega al 100% y arma un primer puesto visual aunque no haya números de puesto").
  Eso es entender que el podio no está en la palabra sino en la geometría.
- Los KPIs de Resumen y la composición del Director: son el patrón a copiar en las otras dieciocho.

**Del backend:**
- Los helpers `SECURITY DEFINER` **sí** están marcados `stable` y con `search_path` fijo. La
  sospecha de que se evaluaban por fila no se confirmó.
- Cero recursión en las 28 migraciones. La regla se respeta sin una sola excepción desde el 42P17
  de la migración 14.
- La plata es `numeric`, no `float`. El error clásico no está.
- Idempotencia real: la migración 30 llega a **preservar el estado enabled/disabled de un trigger**
  entre corridas. Es un nivel de cuidado que no se ve seguido en equipos profesionales.
- La matview se lee vía RPC porque las matviews no soportan RLS — la solución correcta a un
  problema que mucha gente no sabe que tiene.
- `buscar_cards` es `SECURITY INVOKER` a propósito y **sí tiene índice GIN**, sobre una columna
  generada con `setweight` para que el título pese más que la descripción.
- `reinicios_mensuales` arranca vacía a propósito, prefiriendo "no sé" a inventar historia.

**Del proceso:**
- La densidad de comentarios en español explicando el porqué. Es la decisión más valiosa del
  proyecto: es la razón por la que tres auditorías independientes pudieron trabajar sin preguntar
  nada.
