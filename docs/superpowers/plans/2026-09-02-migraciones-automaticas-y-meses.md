# Migraciones automáticas y navegación mensual — Plan de implementación

> **Para quien lo ejecute:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development
> (recomendada) o superpowers:executing-plans, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** que el dueño no vuelva a copiar una migración a mano, y que se pueda mirar cualquier
mes pasado y ver lo que de verdad pasó.

**Arquitectura:** tres cambios que se apoyan uno en otro. (1) El tablero pasa a la estructura del
CLI de Supabase, como ya la usa GESTORIA, así las migraciones se aplican con un comando desde la
terminal en vez de copiarse al panel. (2) Antes de aplicar, la migración se ensaya **dentro de una
transacción que se revierte**, contra la base real — eso reemplaza al banco de pruebas sin
necesitar un segundo proyecto. (3) `cardsDelPeriodo` pasa de dos casos a tres, y el mes pasado sale
de `cards_archive` en vez de dibujarse en blanco.

**Stack:** React 19 + TypeScript + Vite + Tailwind + TanStack Query + Supabase (Postgres, RLS),
CLI de Supabase 2.116.0 por `npx`, vitest.

---

## Lo que cambió respecto del spec, y por qué

El spec del 02/09 proponía un **segundo proyecto de Supabase** como banco de pruebas. Dos cosas lo
cambiaron, las dos del dueño:

**1. El plan gratuito permite dos proyectos y el otro lo ocupa GESTORIA.**

Reemplazo: **ensayo dentro de una transacción**. Postgres aplica DDL transaccionalmente, así que
una migración entera más sus comprobaciones pueden correr con `begin` y terminar en `rollback`.
Prueba contra el esquema real y los datos reales, y no deja nada.

Verificado antes de proponerlo: de las 46 migraciones, **sólo la 30 usa `CONCURRENTLY`** —lo único
que no puede ir en una transacción— y esa vista se está retirando en la 57.

**2. "No quiero tener que integrar ninguna migración más."**

Y tenía razón en que ya existe el camino: **GESTORIA lo hace.** Tiene `supabase/migrations/`, el
proyecto enlazado (`drsooohkwwpnijonxwwt`) y el CLI. El tablero usa una convención propia
—`db/migraciones/migracion-NN-nombre.sql`— que **sólo se puede aplicar copiando y pegando en el
panel**. Ése es todo el motivo por el que hubo que pedírselo 57 veces.

**Sentry queda afuera** por decisión del dueño. Nota al margen, por si sirve más adelante: GESTORIA
ya lo usa (`VITE_SENTRY_DSN` en su `.env.example`) y tiene plan gratuito. No lo empujo; queda
anotado por si el dato cambia la decisión algún día.

---

## Global Constraints

Todas las tareas heredan esto. Está en `CLAUDE.md`; se copia porque quien ejecute una tarea suelta
no lo va a leer entero.

- **Cero emojis** en texto de usuario. Iconos sólo de `lucide-react`.
- **Encuadre no punitivo.** Las métricas describen procesos, **nunca juzgan personas**.
- **Español de Argentina**, sin jerga técnica. Un error **nunca** muestra el mensaje crudo de la
  base: todo pasa por `mensajeUsuario` de `src/lib/fallas.ts`.
- **Comentarios en español que explican el POR QUÉ**, no el qué.
- Tamaños de texto: sólo la escala `text-2xs`…`text-4xl`. Nunca `text-[Npx]` (hay guardián).
- **Nunca editar JSX con `sed` ni regex.** Ya rompió archivos acá.
- **TDD**: test primero, verificar que falla **por la razón esperada**, después implementar.
- **Si un aserto existente se da vuelta, NO se ajusta para que pase.** Se analiza si cambió de
  significado y se reescribe documentando por qué.
- Migraciones **idempotentes**. RLS con `using` y `with check` idénticos.
- Entorno: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`. `git commit` con **timeout
  420000**. Salidas: `cmd > /tmp/log 2>&1; echo "EXIT: $?"`.
- Publicar: `git push origin main` funciona. Antes, los cuatro comandos en 0.
- **NUNCA escribir las credenciales del dueño en ningún archivo, comando o registro.**

---

# FASE A — Que no vuelvas a cargar una migración a mano

## Lo que tiene que hacer el dueño, una sola vez

**Esto bloquea toda la fase y son dos comandos.** Los corre él porque escriben una credencial, y
esa credencial no la veo yo nunca.

```bash
npx supabase login
npx supabase link --project-ref yyyrlopgwmuvfbzwxiwp
```

El primero abre el navegador y guarda el token en su perfil. El segundo pide la contraseña de la
base (Supabase → Settings → Database) y la guarda enlazada al proyecto. **Después de eso, los
comandos de las tareas de abajo corren sin pedir nada.**

---

## Task A1: La estructura del CLI, sin tocar lo que ya está aplicado

**Archivos:**
- Crear: `supabase/config.toml`, `supabase/migrations/.gitkeep`
- Crear: `docs/MIGRACIONES.md`
- Modificar: `.gitignore`

**Interfaces:**
- Produce: la carpeta `supabase/migrations/` donde van **las migraciones nuevas, de la 58 en
  adelante**.

**LA DECISIÓN QUE EVITA UN DESASTRE, y hay que entenderla antes de tocar nada:**

`supabase db push` aplica los archivos de `supabase/migrations/` que **no** figuran en la tabla
`supabase_migrations.schema_migrations` de la base remota. Esa tabla está **vacía**, porque el
tablero nunca usó el CLI.

**Entonces: si se mueven las 46 migraciones históricas a esa carpeta, el CLI intentaría aplicarlas
TODAS otra vez.** Varias son destructivas — el reinicio mensual, el archivado. Sería reproducir a
mano el peor incidente del proyecto.

**Por eso las 46 no se mueven.** `db/migraciones/` queda como registro histórico, congelado y de
sólo lectura. `supabase/migrations/` arranca vacía y recibe únicamente lo nuevo.

Sí, quedan dos carpetas. Es feo y es correcto: la alternativa es reescribir la historia de una base
en producción.

- [ ] **Paso 1: Inicializar la estructura**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"
npx supabase init > /tmp/init.log 2>&1; echo "EXIT: $?"; tail -10 /tmp/init.log
```

Si `supabase/config.toml` ya existiera, no se pisa. Esperado: crea `supabase/` con `config.toml` y
`migrations/`.

- [ ] **Paso 2: Que no se suba nada secreto**

En `.gitignore`, agregar:

```
# El CLI de Supabase guarda acá el enlace al proyecto y credenciales de sesión.
supabase/.temp/
supabase/.branches/
```

- [ ] **Paso 3: Comprobar que el enlace funciona SIN escribir nada**

```bash
npx supabase migration list > /tmp/ml.log 2>&1; echo "EXIT: $?"; cat /tmp/ml.log
```

Esperado: EXIT 0 y una tabla vacía o casi. **Si pide contraseña, el enlace no está hecho: PARAR y
avisar**, no inventar credenciales.

- [ ] **Paso 4: `docs/MIGRACIONES.md`, con las dos carpetas explicadas**

Tiene que decir, en castellano y sin rodeos: qué carpeta es histórica y por qué no se toca, dónde
van las nuevas, cuál es el comando que las aplica, y **que el ensayo en transacción es obligatorio
antes de aplicar**.

- [ ] **Paso 5: Commit**

```bash
git add supabase/ .gitignore docs/MIGRACIONES.md
git commit -m "feat: estructura del CLI de supabase, sin tocar las 46 migraciones ya aplicadas"
```

---

## Task A2: El ensayo en transacción — el banco de pruebas sin segundo proyecto

**Archivos:**
- Crear: `scripts/ensayar-migracion.mjs`
- Modificar: `package.json` (script `ensayo`)

**Interfaces:**
- Produce: `npm run ensayo <archivo.sql>` — aplica la migración dentro de una transacción, corre
  las comprobaciones y **siempre revierte**. Sale 0 si aplicó limpio, 1 si falló.

**POR QUÉ ESTO REEMPLAZA AL SEGUNDO PROYECTO.** Postgres aplica DDL transaccionalmente: se puede
crear una tabla, cambiar una función, correr las verificaciones y deshacer todo. La prueba corre
contra **el esquema real y los datos reales**, que es más fiel que un proyecto vacío.

**LOS LÍMITES, escritos para que nadie los descubra tarde:**

- **`CREATE INDEX CONCURRENTLY` no puede ir en una transacción.** El script tiene que
  **detectarlo y negarse**, diciendo por qué, en vez de fallar con un error de Postgres.
- No prueba nada que dependa del paso del tiempo: crons, la acumulación entre meses.
- Una transacción larga toma bloqueos. Se corre cuando no hay nadie trabajando, y el script lo
  advierte.

- [ ] **Paso 1: Escribir el test del detector de `CONCURRENTLY`**

La parte con lógica es decidir si un SQL es ensayable. Eso es una función pura y va con test:

```js
// scripts/ensayar-migracion.test.mjs
import { describe, it, expect } from "vitest";
import { esEnsayable } from "./ensayar-migracion.mjs";

describe("qué migración se puede ensayar en una transacción", () => {
  it("una migración normal, sí", () => {
    expect(esEnsayable("create table if not exists x (id int);")).toEqual({ ok: true });
  });

  // POSTGRES NO PERMITE `CONCURRENTLY` DENTRO DE UNA TRANSACCIÓN. Sin esta comprobación, el
  // ensayo fallaría con un error crudo de Postgres y parecería que la migración está mal
  // cuando el que no sirve es el ensayo.
  it("con CREATE INDEX CONCURRENTLY, no, y dice por qué", () => {
    const r = esEnsayable("create index concurrently foo on bar (baz);");
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("CONCURRENTLY");
  });

  it("lo detecta sin importar mayúsculas ni espacios de más", () => {
    expect(esEnsayable("CREATE  INDEX   CONCURRENTLY x on y (z);").ok).toBe(false);
  });

  it("la palabra dentro de un comentario NO cuenta", () => {
    // Varias migraciones de este proyecto explican en comentarios por qué NO usan concurrently.
    // Si el detector mirara los comentarios, se negaría a ensayar migraciones perfectamente
    // ensayables — y un guardián que da falsos positivos se termina desactivando.
    expect(esEnsayable("-- ojo: no usar concurrently acá\ncreate table x (id int);").ok).toBe(true);
  });
});
```

- [ ] **Paso 2: Correr y verificar que falla**

```bash
npx vitest run scripts/ensayar-migracion.test.mjs > /tmp/e.log 2>&1; echo "EXIT: $?"; tail -12 /tmp/e.log
```

Esperado: FAIL con `Failed to resolve import` o `esEnsayable is not a function`.

- [ ] **Paso 3: Implementar el script**

`esEnsayable(sql)` saca los comentarios (`--` hasta fin de línea y `/* */`) y después busca
`create\s+index\s+concurrently` sin distinguir mayúsculas.

El resto del script:
1. Lee el archivo.
2. Si no es ensayable, sale 1 con el motivo.
3. Arma `begin; <sql> ; <comprobaciones> ; rollback;` y lo manda con
   `npx supabase db execute --file -` (o `psql` si el CLI no lo soporta; **verificar cuál existe
   antes de elegir, no suponer**).
4. Informa qué pasó, con la salida completa.

**La última línea que imprime tiene que ser `REVERTIDO` o `FALLÓ`, nunca ambigua.** Un ensayo que
no deja claro si tocó la base es peor que no tenerlo.

- [ ] **Paso 4: Correr los tests y verificar que pasan**

```bash
npx vitest run scripts/ensayar-migracion.test.mjs > /tmp/e.log 2>&1; echo "EXIT: $?"; grep -E "Tests " /tmp/e.log
```

- [ ] **Paso 5: Ensayar de verdad con la migración 57, que es la única sin aplicar**

```bash
npm run ensayo db/migraciones/migracion-57-retirar-mv-resumen.sql
```

Esperado: aplica, las comprobaciones corren, imprime `REVERTIDO`. Y después, para probar que el
ensayo no mintió:

```sql
select matviewname from pg_matviews where matviewname = 'mv_resumen_mensual';
```

**Tiene que seguir existiendo.** Si desapareció, el `rollback` no ocurrió y hay que parar todo.

- [ ] **Paso 6: Commit**

```bash
git add scripts/ensayar-migracion.mjs scripts/ensayar-migracion.test.mjs package.json
git commit -m "feat: ensayar una migracion en una transaccion que se revierte"
```

---

## Task A3: Aplicar migraciones desde la terminal, y cerrar el círculo

**Archivos:**
- Crear: `scripts/aplicar-migracion.mjs`
- Modificar: `package.json`, `docs/MIGRACIONES.md`, `CLAUDE.md`

**Interfaces:**
- Produce: `npm run migrar` — ensaya cada migración pendiente y sólo entonces la aplica.

- [ ] **Paso 1: El script, con el ensayo como paso obligatorio**

`npm run migrar` hace, en este orden:

1. Lista lo pendiente en `supabase/migrations/` (`npx supabase migration list`).
2. **Para cada una, corre el ensayo.** Si alguna falla, **no aplica ninguna** y sale 1.
3. Si todas ensayaron bien, `npx supabase db push`.
4. Vuelve a listar y muestra qué quedó aplicado.

**El paso 2 no se puede saltear con una bandera.** Si existiera esa bandera se usaría el día que
haya apuro, que es exactamente el día que no hay que usarla.

- [ ] **Paso 2: Actualizar `CLAUDE.md` §5**

Hoy dice que las migraciones se corren en el panel. Tiene que decir:

- Las nuevas van en `supabase/migrations/`, con el nombre que genera
  `npx supabase migration new <nombre>`.
- Se aplican con `npm run migrar`, que ensaya primero.
- `db/migraciones/` es historia y **no se toca**.
- El dueño **no copia nada al panel nunca más**.

- [ ] **Paso 3: Verificar de punta a punta con la 57**

La única pendiente. Se la convierte al formato nuevo:

```bash
npx supabase migration new retirar_mv_resumen
# copiar el contenido de db/migraciones/migracion-57-retirar-mv-resumen.sql al archivo nuevo
npm run migrar
```

Esperado: ensaya, aplica, y `select matviewname from pg_matviews where matviewname =
'mv_resumen_mensual';` devuelve **cero filas**.

**Ésta es la prueba de que toda la fase sirvió:** una migración que llegó a producción sin que el
dueño abriera el panel.

- [ ] **Paso 4: Commit**

```bash
git add scripts/aplicar-migracion.mjs package.json docs/MIGRACIONES.md CLAUDE.md supabase/migrations/
git commit -m "feat: migrar desde la terminal, con el ensayo como paso obligatorio"
```

---

# FASE B — Las herramientas de verificación

## Task B1: MCP de Supabase en sólo lectura, y codegraph

**Archivos:**
- Crear: `.mcp.json`
- Modificar: `.gitignore`, `CLAUDE.md`

- [ ] **Paso 1: `.mcp.json` con producción en SÓLO LECTURA**

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y", "@supabase/mcp-server-supabase@latest",
        "--read-only",
        "--project-ref=yyyrlopgwmuvfbzwxiwp"
      ],
      "env": { "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}" }
    }
  }
}
```

**`--read-only` no es cautela de más.** Este proyecto ya destruyó el archivo de un mes con una
función mal escrita. Leer resuelve todos los casos en que hoy hay que pedir una consulta; escribir
no agrega nada que valga ese riesgo — y para escribir ya está `npm run migrar`, que ensaya primero.

**El token va por variable de entorno y NUNCA dentro del archivo.** El dueño lo genera en
Supabase → Account → Access Tokens y lo pone en su entorno.

- [ ] **Paso 2: codegraph como MCP**

```bash
codegraph install
codegraph init .
```

- [ ] **Paso 3: Comprobar que las dos sirven, con una pregunta real**

Con el MCP de Supabase, contestar sin pedirle nada al dueño:

```
select mes, count(*), count(*) filter (where card->>'status' = 'term')
  from cards_archive where mes in ('2026-07','2026-08') group by mes;
```

Con codegraph, la pregunta que falló tres veces el 20/08:

```bash
codegraph impact cardsDelPeriodo
```

Esperado: nombra a `App.tsx` y a lo que dependa. **Si no encuentra más que un `grep`, anotarlo:
es su criterio de descarte.**

- [ ] **Paso 4: Commit**

```bash
git add .mcp.json .gitignore CLAUDE.md
git commit -m "feat: mcp de supabase en solo lectura y codegraph para analisis de impacto"
```

## Task B2: Las skills, en el proyecto donde hacen falta

**Archivos:**
- Crear: `.claude/skills/postgres-patterns/`, `database-migrations/`, `safety-guard/`,
  `verification-loop/`

- [ ] **Paso 1: Copiar las cuatro**

Las dos primeras de `AUTOMATIZACION TRABAJO/ECC/skills/`; las otras dos de
`AUTOMATIZACION TRABAJO/.claude/skills/`.

**Copiar, no enlazar:** un enlace a una carpeta de otro proyecto se rompe el día que ese proyecto
se mueve, y se rompe en silencio.

- [ ] **Paso 2: Anotar en `CLAUDE.md` cuándo se usan**

`postgres-patterns` y `database-migrations` antes de escribir una migración. `safety-guard` antes
de algo destructivo. `verification-loop` antes de decir que algo está terminado.

- [ ] **Paso 3: Commit**

```bash
git add .claude/skills/ CLAUDE.md
git commit -m "feat: las cuatro skills que faltaban, en el proyecto que las necesita"
```

---

# FASE C — La navegación mensual

## Task C1: La decisión de qué se muestra, como función pura

**Archivos:**
- Modificar: `src/lib/periodo-instancias.ts`, `src/lib/periodo-instancias.test.ts`

**Interfaces:**
- Produce: `type FuenteDelMes = "vigente" | "futuro" | "pasado"`
- Produce: `function fuenteDelMes(periodo: string, vigente: string): FuenteDelMes`
- Produce: `function resolverMesPasado(cards, archivo, periodos, periodo)` → las tarjetas de ese
  mes, o `null` si no hay archivo.

- [ ] **Paso 1: Escribir los tests**

```ts
describe("de dónde sale cada mes", () => {
  it("el mes en curso son las tarjetas crudas", () => {
    expect(fuenteDelMes("2026-09", "2026-09")).toBe("vigente");
  });

  it("el mes que viene es futuro", () => {
    expect(fuenteDelMes("2026-10", "2026-09")).toBe("futuro");
  });

  // ACÁ ESTABA EL BUG. `cardsDelPeriodo` tenía dos casos y metía el mes que viene y el mes
  // pasado en la misma bolsa. Son opuestos: en blanco es correcto para el futuro —todavía no
  // pasó nada— y es una mentira para el pasado, donde pasó todo.
  it("el mes anterior es pasado, no 'cualquier otro'", () => {
    expect(fuenteDelMes("2026-08", "2026-09")).toBe("pasado");
  });

  it("con datos rotos cae en vigente, que es lo que se comporta como siempre", () => {
    expect(fuenteDelMes("", "2026-09")).toBe("vigente");
  });
});

describe("resolver un mes pasado", () => {
  const card = (over = {}) => ({ id: "c1", owner: "u1", title: "IVA", status: "pend",
    description: "", checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal", deps: [],
    created_at: "2026-08-01T00:00:00Z", ...over });

  it("sale del archivo y no de las tarjetas de hoy", () => {
    const hoy = [card({ id: "c1", status: "pend" })];
    const archivo = [{ id: "a1", owner: "u1", mes: "2026-08", archived_at: "2026-09-01",
      card: card({ id: "c1", status: "term", done_at: "2026-08-20T12:00:00Z" }) }];
    const r = resolverMesPasado(hoy, archivo, [], "2026-08");
    expect(r?.[0].status).toBe("term");
  });

  // LA OTRA MITAD DEL PEDIDO, y no estaba a la vista. Hoy la vista de agosto recorre las
  // tarjetas DE HOY: una tarea creada en septiembre aparece en agosto, y una que existió en
  // agosto y se borró después no aparece. El archivo tiene las tareas que el mes tuvo.
  it("muestra las tareas que ese mes tuvo, no las de hoy", () => {
    const hoy = [card({ id: "nueva-de-septiembre" })];
    const archivo = [{ id: "a1", owner: "u1", mes: "2026-08", archived_at: "2026-09-01",
      card: card({ id: "vieja-de-agosto", status: "term" }) }];
    const r = resolverMesPasado(hoy, archivo, [], "2026-08");
    expect(r?.map((c) => c.id)).toEqual(["vieja-de-agosto"]);
  });

  // LA CORRECCIÓN POSTERIOR. Sin esta regla, reabrir agosto en octubre y arreglar una tarea
  // no se vería nunca: la foto del archivo la taparía.
  it("una fila de card_periodos posterior gana sobre la foto", () => {
    const archivo = [{ id: "a1", owner: "u1", mes: "2026-08", archived_at: "2026-09-01",
      card: card({ id: "c1", status: "pend" }) }];
    const periodos = [{ card_id: "c1", periodo: "2026-08", status: "term" }];
    const r = resolverMesPasado([], archivo, periodos, "2026-08");
    expect(r?.[0].status).toBe("term");
  });

  // Las filas ya volcadas se siguen ignorando (migraciones 51 y 56): ésas se aplicaron sobre
  // `cards` y volver a leerlas taparía el trabajo real.
  it("una fila YA VOLCADA no gana", () => {
    const archivo = [{ id: "a1", owner: "u1", mes: "2026-08", archived_at: "2026-09-01",
      card: card({ id: "c1", status: "term" }) }];
    const periodos = [{ card_id: "c1", periodo: "2026-08", status: "pend",
      aplicado_at: "2026-09-01T03:00:00Z" }];
    const r = resolverMesPasado([], archivo, periodos, "2026-08");
    expect(r?.[0].status).toBe("term");
  });

  // "NO SÉ" NO ES "NO HABÍA NADA". Es la regla que cierra el agujero de fondo: el bug de agosto
  // fue una falla dibujada como un dato con confianza — cero terminadas, prolijo, creíble.
  it("sin archivo devuelve null, NO una lista vacía ni tarjetas en blanco", () => {
    expect(resolverMesPasado([card()], [], [], "2026-08")).toBeNull();
  });
});
```

- [ ] **Paso 2: Correr y verificar que falla**

```bash
npx vitest run src/lib/periodo-instancias.test.ts > /tmp/p.log 2>&1; echo "EXIT: $?"; tail -12 /tmp/p.log
```

Esperado: FAIL con `fuenteDelMes is not a function`.

- [ ] **Paso 3: Implementar las dos funciones**

`fuenteDelMes` compara las cadenas `YYYY-MM`. `resolverMesPasado` toma las filas del archivo de ese
mes, saca la tarjeta de cada una, y aplica encima las filas de `card_periodos` sin `aplicado_at`.
Devuelve `null` si no hay ninguna fila de archivo para ese mes.

- [ ] **Paso 4: Correr y verificar que pasan**

- [ ] **Paso 5: Commit**

```bash
git add src/lib/periodo-instancias.ts src/lib/periodo-instancias.test.ts
git commit -m "feat: un mes pasado se resuelve desde el archivo, no en blanco"
```

## Task C2: El hook que distingue un error de un mes vacío

**Archivos:**
- Modificar: `src/hooks/useArchive.ts`

**Interfaces:**
- Produce: `useArchiveMes(ownerId, mes)` → `{ filas, estado }` con
  `estado: "cargando" | "hay" | "sin-archivo" | "error"`.

**POR QUÉ UN HOOK NUEVO Y NO REUSAR `useArchive`.** `useArchive` y `useArchiveEquipo` **devuelven
`[]` ante cualquier error**. Apoyar la lectura nueva en eso reconstruiría exactamente el mismo bug
con otra fuente: una consulta que falla se vería igual que un mes sin trabajo.

Además `useArchive` trae **todos** los meses sin filtro, y para el tablero alcanza con uno.

- [ ] **Paso 1: Escribir el hook, con los cuatro estados explícitos**

Filtra por `owner` y por `mes` en el servidor. Ante error devuelve `estado: "error"` y **no** una
lista vacía. Con la consulta bien pero sin filas, `"sin-archivo"`.

- [ ] **Paso 2: Commit**

```bash
git add src/hooks/useArchive.ts
git commit -m "feat: un hook del archivo que distingue error de mes vacio"
```

## Task C3: Conectarlo al tablero, con los tres estados a la vista

**Archivos:**
- Modificar: `src/App.tsx`, `src/features/board/Board.tsx`

- [ ] **Paso 1: Que `App.tsx` use `fuenteDelMes` y pida el archivo cuando corresponda**

El hook del archivo se pide **sólo cuando el período elegido es pasado**. Para el mes en curso no
se toca nada.

- [ ] **Paso 2: Los tres estados, visiblemente distintos**

| Estado | Qué se ve |
|---|---|
| Hay archivo | Las tareas de ese mes |
| Sin archivo | *"Este mes no quedó archivado."* y **ninguna tarjeta** — dibujarlas sería inventar un mes que nadie guardó |
| Error | *"No se pudo cargar este mes."* con opción de reintentar, y **ninguna tarjeta** |

Y una consecuencia que hay que aceptar: los meses anteriores a que existiera `cards_archive` van a
decir "no quedó archivado". Es incómodo y es correcto.

- [ ] **Paso 3: Los tres comprobados en el navegador**

**Ésta es la verificación que más importa, porque es la que falló en agosto:** cortar la red y
abrir un mes pasado tiene que decir que no se pudo cargar. Si muestra cero tareas, el arreglo no
sirvió.

- [ ] **Paso 4: Los cuatro comandos y commit**

```bash
git add src/App.tsx src/features/board/Board.tsx
git commit -m "feat: el tablero muestra los meses pasados, y dice cuando no sabe"
```

---

# FASE D — Los comentarios por mes

**VA ÚLTIMA Y ES LA ÚNICA DESTRUCTIVA.** No se toca hasta que la Fase A esté andando, porque el
ensayo en transacción es lo único que la vuelve segura.

## Task D1: Que la observación del mes quede en su mes

**Archivos:**
- Crear: `supabase/migrations/<sello>_comentarios_por_mes.sql`

**El pedido:** *"si yo puse en el banco de agosto 'cerrado con salvedad, revisar X movimiento', no
debería arrastrarse mes a mes, debería quedar como constancia del mes."*

El reinicio toca `status`, `done_at`, `proc_at`, `checklist` e `history`. **No toca `comments`.**

- [ ] **Paso 1: La migración, con el orden que no es negociable**

Limpiar `comments` **después** de insertar la foto en `cards_archive`. Al revés, la constancia se
pierde de verdad.

**Un borde conocido que va escrito en el archivo:** el archivado usa `on conflict do nothing`. Si un
mes ya estaba archivado y después se escribieron comentarios, ésos no entran en la foto y se
pierden al limpiar. Es angosto, y queda anotado en vez de tapado.

- [ ] **Paso 2: Ensayarla, que es el punto de toda la Fase A**

```bash
npm run ensayo supabase/migrations/<sello>_comentarios_por_mes.sql
```

Adentro de la transacción, comprobar que un comentario escrito antes está en la foto **y** que la
tarjeta quedó sin comentarios. Y que después del `rollback` la base está intacta.

- [ ] **Paso 3: Aplicar y commit**

```bash
npm run migrar
git add supabase/migrations/
git commit -m "feat: la observacion de un mes queda en ese mes"
```

---

# Lo que este plan NO hace

- **No mueve las 46 migraciones históricas al CLI.** El CLI intentaría aplicarlas de nuevo, y
  varias son destructivas.
- **No mergea `card_periodos` sobre el mes vigente.** Ya analizado el 05/08.
- **No entra Sentry**, por decisión del dueño.
- **No entran las reglas de diseño de Vercel ni frontend-design.** El proyecto tiene su sistema
  visual con dos guardianes; una segunda autoridad crea dos verdades.
- **No parte `Admin.tsx` (713 líneas) ni `Board.tsx` (611).** Deuda real, no sirve a este objetivo.

---

# Cómo se sabe que esto funcionó

Cuatro comprobaciones, ninguna es "está implementado":

1. **Una migración llegó a producción sin que el dueño abriera el panel.** La 57 es la prueba.
2. **Abrir agosto muestra 157 tareas con 119 terminadas** — los mismos números que el archivo.
3. **Reabrir una tarea de julio, corregirla, cerrar, y volver a abrir julio:** la corrección sigue.
4. **Cortar la red y abrir un mes pasado:** dice que no se pudo cargar. **No** muestra cero tareas.

La cuarta es la que más importa: es exactamente lo que falló en agosto.
