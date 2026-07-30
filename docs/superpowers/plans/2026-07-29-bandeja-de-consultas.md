# Bandeja de consultas para análisis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Valentino corra un comando y todas las consultas, sugerencias y errores que reportó el equipo queden en un archivo Markdown local que Claude pueda leer y analizar con él, sin abrir el navegador y sin una segunda base de datos.

**Architecture:** Un script Node de solo lectura (`scripts/consultas.mjs`) se autentica contra Supabase con las credenciales de la cuenta de administración, baja `consultas` + los nombres de `profiles`, y delega el armado del texto a una librería pura y testeada (`src/lib/consultas-informe.ts`). El script es una cáscara de entrada/salida; toda la lógica que vale la pena probar vive en la lib, igual que en el resto del proyecto. La salida es un `.md` ignorado por git.

**Tech Stack:** Node 18+ (`fetch` nativo, sin dependencias nuevas), TypeScript, vitest, la API REST de Supabase (PostgREST) y su endpoint de auth (GoTrue).

## Por qué NO una segunda base de datos

Se descartó explícitamente, y conviene dejarlo escrito para no volver sobre esto:

1. **No resuelve el problema.** Claude no puede conectarse a ninguna base de datos —
   ni a la actual ni a una nueva. Lee archivos y ejecuta comandos. Poner las consultas en
   otra base dejaría exactamente el mismo problema: sigue haciendo falta bajarlas a un archivo.
2. **Dos fuentes de verdad.** Habría que mantener un trabajo de sincronización, y el día que
   falle, la bandeja miente sin avisar. Un dato desactualizado que parece actualizado es peor
   que no tener el dato.
3. **Duplica datos de personas.** Las consultas tienen texto escrito por empleados. Copiarlas
   a un segundo sistema duplica la superficie de exposición sin ninguna ganancia.

La alternativa elegida agrega **un archivo de script y una lib**, y no toca la base.

## Global Constraints

- **Sin dependencias nuevas.** El script usa `fetch` nativo de Node 18+, igual que
  `scripts/rls-smoke.mjs`. En esta máquina **no hay npm**, así que no se puede instalar nada.
- **`node` está en `C:\Users\Vmagni\AppData\Local\OpenAI\Codex\bin\node.exe`.** Los comandos
  del plan asumen ese `node` en el PATH.
- **Solo lectura.** El script hace `GET`. No hace `POST`, `PATCH` ni `DELETE` contra datos
  reales. Marcar una consulta como leída se sigue haciendo desde la app.
- **Ningún secreto entra al repositorio.** Las credenciales viven en `.env.consultas.local`,
  y la salida en `consultas-bandeja.md`. Ambos ignorados por git y verificados en la Task 3.
- **Cero emojis en toda salida de usuario** (regla del proyecto). El informe usa texto y
  Markdown, nada de iconos.
- **Encuadre no punitivo.** El informe describe pedidos y problemas del sistema. No cuenta
  cuántas consultas mandó cada persona ni arma ningún ranking de autores.
- El proyecto corre con `node node_modules/vitest/vitest.mjs run` (no hay `npm test`).

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/consultas-informe.ts` | **Puro.** Consultas + perfiles → texto Markdown. Sin red, sin `new Date()` de "ahora". |
| `src/lib/consultas-informe.test.ts` | Tests de la lib. |
| `scripts/consultas.mjs` | Cáscara de I/O: lee env, se autentica, baja datos, llama a la lib, escribe el archivo. |
| `docs/CONSULTAS-PARA-ANALISIS.md` | Cómo configurarlo y correrlo, en lenguaje de usuario. |
| `.gitignore` | Ignora la salida y el archivo de credenciales. |

**Por qué la lib es TypeScript y el script `.mjs`:** Node 24 (el de esta máquina) lee
TypeScript de forma nativa — borra los tipos y ejecuta —, así que el script importa
directamente `src/lib/consultas-informe.ts`. La lógica del informe existe **una sola vez**,
en el archivo que cubren los tests. Funciona porque la lib sólo usa `import type`, que se
borra sin dejar nada que resolver en tiempo de ejecución.

> **Corrección durante la ejecución.** La primera versión de este plan compilaba la lib con
> `tsc` a una carpeta temporal, asumiendo que Node no podía leer `.ts`. Falló: el repo tiene
> **TypeScript 6**, donde pasar archivos por línea de comandos existiendo un `tsconfig.json`
> es un error (TS5112) y `tsc` sale con status 1 sin emitir nada. El diseño de arriba no es
> un parche a eso: es **menos** código —sin `tsc`, sin carpeta temporal, sin puente— y por
> eso reemplaza al anterior en lugar de arreglarlo.

---

### Task 1: Lib pura que arma el informe

**Files:**
- Create: `src/lib/consultas-informe.ts`
- Test: `src/lib/consultas-informe.test.ts`

**Interfaces:**
- Consumes: `Consulta` de `src/lib/types.ts`, ya existente:
  ```ts
  export interface Consulta {
    id: string; autor: string; tipo: "consulta" | "sugerencia" | "error";
    texto: string; estado: "nueva" | "leida" | "archivada";
    respuesta: string | null; created_at: string; respondida_at: string | null;
  }
  ```
- Produces:
  - `export interface PerfilMinimo { id: string; name: string }`
  - `export function ordenarConsultas(cs: Consulta[]): Consulta[]`
  - `export function informeConsultas(cs: Consulta[], perfiles: PerfilMinimo[], generadoISO: string): string`

- [ ] **Step 1: Write the failing test**

Crear `src/lib/consultas-informe.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ordenarConsultas, informeConsultas, type PerfilMinimo } from "./consultas-informe";
import type { Consulta } from "./types";

const PERFILES: PerfilMinimo[] = [
  { id: "u1", name: "Ana Pérez" },
  { id: "u2", name: "Bruno Díaz" },
];
const GENERADO = "2026-07-29T12:00:00.000Z";

function consulta(over: Partial<Consulta> = {}): Consulta {
  return {
    id: "aaaaaaaa-1111-2222-3333-444444444444", autor: "u1", tipo: "consulta",
    texto: "No encuentro el botón de imprimir", estado: "nueva",
    respuesta: null, created_at: "2026-07-20T10:00:00Z", respondida_at: null, ...over,
  };
}

describe("ordenarConsultas", () => {
  it("pone los errores primero: bloquean a alguien ahora", () => {
    const cs = [consulta({ id: "a", tipo: "sugerencia" }), consulta({ id: "b", tipo: "error" })];
    expect(ordenarConsultas(cs)[0].id).toBe("b");
  });

  it("dentro del mismo tipo, las nuevas antes que las ya vistas", () => {
    const cs = [
      consulta({ id: "a", tipo: "error", estado: "archivada" }),
      consulta({ id: "b", tipo: "error", estado: "nueva" }),
    ];
    expect(ordenarConsultas(cs)[0].id).toBe("b");
  });

  it("a igual tipo y estado, la más reciente primero", () => {
    const cs = [
      consulta({ id: "a", created_at: "2026-07-01T10:00:00Z" }),
      consulta({ id: "b", created_at: "2026-07-20T10:00:00Z" }),
    ];
    expect(ordenarConsultas(cs)[0].id).toBe("b");
  });

  it("no muta el arreglo que recibe", () => {
    const cs = [consulta({ id: "a", tipo: "sugerencia" }), consulta({ id: "b", tipo: "error" })];
    ordenarConsultas(cs);
    expect(cs[0].id).toBe("a");
  });

  it("es defensiva ante entradas raras", () => {
    expect(ordenarConsultas(null as unknown as Consulta[])).toEqual([]);
  });
});

describe("informeConsultas", () => {
  it("resuelve el nombre del autor a partir de los perfiles", () => {
    const md = informeConsultas([consulta({ autor: "u2" })], PERFILES, GENERADO);
    expect(md).toContain("Bruno Díaz");
  });

  it("si no conoce al autor, muestra el id en vez de romperse", () => {
    const md = informeConsultas([consulta({ autor: "desconocido" })], PERFILES, GENERADO);
    expect(md).toContain("desconocido");
  });

  it("incluye el texto de la consulta", () => {
    const md = informeConsultas([consulta()], PERFILES, GENERADO);
    expect(md).toContain("No encuentro el botón de imprimir");
  });

  it("cita el texto como blockquote para que no rompa la estructura del informe", () => {
    // Un texto que arranque con '#' partiría el Markdown en dos si se pegara crudo.
    const md = informeConsultas([consulta({ texto: "## no es un título" })], PERFILES, GENERADO);
    expect(md).toContain("> ## no es un título");
  });

  it("cita bien un texto de varias líneas", () => {
    const md = informeConsultas([consulta({ texto: "linea uno\nlinea dos" })], PERFILES, GENERADO);
    expect(md).toContain("> linea uno");
    expect(md).toContain("> linea dos");
  });

  it("muestra la respuesta cuando ya la hay", () => {
    const md = informeConsultas([consulta({ respuesta: "Está en el menú" })], PERFILES, GENERADO);
    expect(md).toContain("Está en el menú");
  });

  it("marca explícitamente lo que sigue sin responder", () => {
    const md = informeConsultas([consulta({ respuesta: null })], PERFILES, GENERADO);
    expect(md).toMatch(/sin responder/i);
  });

  it("resume cuántas hay de cada estado", () => {
    const cs = [
      consulta({ id: "a", estado: "nueva" }),
      consulta({ id: "b", estado: "nueva" }),
      consulta({ id: "c", estado: "leida" }),
    ];
    const md = informeConsultas(cs, PERFILES, GENERADO);
    expect(md).toContain("3 en total");
    expect(md).toContain("2 nuevas");
    expect(md).toContain("1 leída");
  });

  it("agrupa por tipo con un título por grupo", () => {
    const cs = [consulta({ id: "a", tipo: "error" }), consulta({ id: "b", tipo: "sugerencia" })];
    const md = informeConsultas(cs, PERFILES, GENERADO);
    expect(md).toContain("## Errores");
    expect(md).toContain("## Sugerencias");
  });

  it("no crea grupos vacíos", () => {
    const md = informeConsultas([consulta({ tipo: "error" })], PERFILES, GENERADO);
    expect(md).not.toContain("## Sugerencias");
  });

  // Encuadre no punitivo: el informe habla de pedidos, no de personas.
  it("no cuenta consultas por persona ni arma ranking de autores", () => {
    const cs = [consulta({ id: "a", autor: "u1" }), consulta({ id: "b", autor: "u1" })];
    const md = informeConsultas(cs, PERFILES, GENERADO);
    expect(md).not.toMatch(/Ana Pérez.*\b2\b.*consultas/i);
    expect(md).not.toMatch(/ranking/i);
  });

  it("sin consultas lo dice, en vez de devolver un archivo vacío", () => {
    const md = informeConsultas([], PERFILES, GENERADO);
    expect(md).toMatch(/no hay consultas/i);
  });

  it("deja la fecha de generación para saber a qué momento corresponde", () => {
    const md = informeConsultas([consulta()], PERFILES, GENERADO);
    expect(md).toContain("2026-07-29");
  });

  it("es defensiva ante entradas raras", () => {
    expect(informeConsultas(null as unknown as Consulta[], PERFILES, GENERADO)).toMatch(/no hay consultas/i);
    expect(informeConsultas([consulta()], null as unknown as PerfilMinimo[], GENERADO)).toContain("u1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node node_modules/vitest/vitest.mjs run src/lib/consultas-informe.test.ts
```
Expected: FAIL — `Failed to resolve import "./consultas-informe"`.

- [ ] **Step 3: Write the implementation**

Crear `src/lib/consultas-informe.ts`:

```ts
import type { Consulta } from "./types";

// Informe de la bandeja de consultas, para leerlo y analizarlo fuera de la app.
//
// PURA: no toca la red ni pregunta la hora. Recibe los datos ya bajados y devuelve texto.
// Toda la parte de red vive en `scripts/consultas.mjs`, que es solo entrada y salida.
//
// ENCUADRE: esto describe PEDIDOS Y PROBLEMAS DEL SISTEMA, no personas. El autor aparece
// para poder responderle, no para contabilizarlo: no hay conteo por persona ni ranking.
// Alguien que reporta diez errores está haciendo el trabajo bien, no mal.

export interface PerfilMinimo { id: string; name: string }

/** Los errores primero: son los que tienen a alguien trabado ahora mismo. */
const PESO_TIPO: Record<Consulta["tipo"], number> = { error: 0, consulta: 1, sugerencia: 2 };
/** Lo no visto primero: es lo que todavía espera una respuesta. */
const PESO_ESTADO: Record<Consulta["estado"], number> = { nueva: 0, leida: 1, archivada: 2 };

const TITULO_GRUPO: Record<Consulta["tipo"], string> = {
  error: "## Errores",
  consulta: "## Consultas",
  sugerencia: "## Sugerencias",
};
const ORDEN_GRUPOS: Consulta["tipo"][] = ["error", "consulta", "sugerencia"];

/** Copia ordenada: errores → consultas → sugerencias, nuevas primero, más reciente primero. */
export function ordenarConsultas(cs: Consulta[]): Consulta[] {
  if (!Array.isArray(cs)) return [];
  return [...cs].sort((a, b) => {
    const t = (PESO_TIPO[a.tipo] ?? 9) - (PESO_TIPO[b.tipo] ?? 9);
    if (t !== 0) return t;
    const e = (PESO_ESTADO[a.estado] ?? 9) - (PESO_ESTADO[b.estado] ?? 9);
    if (e !== 0) return e;
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
}

/**
 * Cita un texto como blockquote de Markdown. NO es cosmético: el texto lo escribe una
 * persona y puede empezar con "#", "-" o "```". Pegado crudo, partiría el informe en dos
 * y una consulta podría tapar a las que vienen abajo.
 */
function citar(texto: string): string {
  return String(texto ?? "").split("\n").map((l) => "> " + l).join("\n");
}

function nombreDe(perfiles: PerfilMinimo[], id: string): string {
  if (!Array.isArray(perfiles)) return id;
  return perfiles.find((p) => p?.id === id)?.name ?? id;
}

/** YYYY-MM-DD de un instante ISO. Si no se puede leer, devuelve el original. */
function dia(iso: string): string {
  const d = new Date(iso);
  return isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : String(iso ?? "");
}

function bloque(c: Consulta, perfiles: PerfilMinimo[]): string {
  const partes = [
    `### ${nombreDe(perfiles, c.autor)} · ${dia(c.created_at)} · ${c.estado}`,
    "",
    citar(c.texto),
    "",
  ];
  if (c.respuesta) {
    partes.push(`**Respondida** el ${dia(c.respondida_at ?? c.created_at)}:`, "", citar(c.respuesta), "");
  } else {
    partes.push("**Sin responder.**", "");
  }
  return partes.join("\n");
}

/**
 * El informe completo en Markdown. `generadoISO` entra por parámetro para que la función
 * sea pura y testeable: sin él, cada corrida daría un texto distinto.
 */
export function informeConsultas(cs: Consulta[], perfiles: PerfilMinimo[], generadoISO: string): string {
  const lista = ordenarConsultas(cs);
  const cabecera = `# Bandeja de consultas\n\nGenerado el ${dia(generadoISO)}.\n`;
  if (lista.length === 0) {
    return cabecera + "\nNo hay consultas para mostrar.\n";
  }

  const cuenta = (e: Consulta["estado"]) => lista.filter((c) => c.estado === e).length;
  const resumen =
    `\n${lista.length} en total · ${cuenta("nueva")} nuevas · ` +
    `${cuenta("leida")} leída${cuenta("leida") === 1 ? "" : "s"} · ${cuenta("archivada")} archivadas\n`;

  const grupos = ORDEN_GRUPOS.map((tipo) => {
    const delTipo = lista.filter((c) => c.tipo === tipo);
    if (delTipo.length === 0) return ""; // sin grupos vacíos: ruido puro
    return `\n${TITULO_GRUPO[tipo]} (${delTipo.length})\n\n` +
      delTipo.map((c) => bloque(c, perfiles)).join("\n");
  }).join("");

  return cabecera + resumen + grupos;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node node_modules/vitest/vitest.mjs run src/lib/consultas-informe.test.ts
```
Expected: PASS — 19 tests.

- [ ] **Step 5: Verify types**

Run:
```bash
node node_modules/typescript/bin/tsc -b
```
Expected: exit 0, sin salida.

- [ ] **Step 6: Commit**

```bash
git add src/lib/consultas-informe.ts src/lib/consultas-informe.test.ts
git commit -m "feat: lib pura del informe de consultas"
```

---

### Task 2: Script que baja las consultas y escribe el informe

**Files:**
- Create: `scripts/consultas.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `informeConsultas(cs, perfiles, generadoISO)` y `PerfilMinimo` de la Task 1.
- Produces: el comando `node scripts/consultas.mjs`, que escribe `consultas-bandeja.md` en la
  raíz del repositorio.

**Cómo el script `.mjs` usa una lib `.ts`:** con un `import` normal. Node 24 lee TypeScript
nativamente, así que la lógica del informe existe **una sola vez**, en el archivo que cubren
los tests. Ver la nota de corrección en la sección "Estructura de archivos".

- [ ] **Step 1: Add the ignore rules first, so no secret can be committed by accident**

Editar `.gitignore` — dejarlo así:

```
node_modules/
dist/
*.local

test-results/
playwright-report/

# Bandeja de consultas (scripts/consultas.mjs): datos reales del equipo y credenciales.
# NUNCA se versionan. `.env.consultas.local` ya cae bajo `*.local`; se repite explícito
# para que se vea al leer el archivo y nadie lo mueva sin darse cuenta.
consultas-bandeja.md
.env.consultas.local
```

- [ ] **Step 2: Verify the ignore rules actually work**

Run:
```bash
touch consultas-bandeja.md .env.consultas.local && git status --short && git check-ignore -v consultas-bandeja.md .env.consultas.local
```
Expected: `git status --short` NO menciona ninguno de los dos archivos, y `git check-ignore`
imprime dos líneas apuntando a `.gitignore`. Después: `rm consultas-bandeja.md .env.consultas.local`.

- [ ] **Step 3: Write the script**

Crear `scripts/consultas.mjs`:

```js
#!/usr/bin/env node
// ============================================================
// Bandeja de consultas — SOLO LECTURA.
//
// Baja las consultas, sugerencias y errores que reportó el equipo y las escribe en
// `consultas-bandeja.md` para poder leerlas y analizarlas fuera de la app.
//
// Uso:
//   1) Crear `.env.consultas.local` en la raíz del repo con:
//        SUPABASE_EMAIL=cuenta.de.administracion@...
//        SUPABASE_PASSWORD=...
//   2) node scripts/consultas.mjs
//
// Ese archivo está ignorado por git y NO debe salir de esta máquina.
//
// Sin dependencias nuevas: `fetch` nativo de Node 18+, igual que scripts/rls-smoke.mjs.
// No hace POST, PATCH ni DELETE sobre datos reales: solo el login y dos GET.
// Marcar una consulta como leída o responderla se sigue haciendo desde la app.
// ============================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// Node 24 lee TypeScript directamente (borra los tipos y ejecuta), así que el informe se
// importa de la MISMA lib que cubren los tests. Sin compilar nada y sin copiar la lógica
// acá: una sola versión, la testeada.
import { informeConsultas } from "../src/lib/consultas-informe.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = join(RAIZ, "consultas-bandeja.md");

// Los mismos valores públicos que usa la app (src/lib/supabase.ts). No son secretos:
// la clave publicable está pensada para vivir en el navegador, y RLS es lo que protege.
const SUPABASE_URL = "https://yyyrlopgwmuvfbzwxiwp.supabase.co";
const ANON_KEY = "sb_publishable_cL-5aTeSpy2dNBQHzqO9Sg_D_fncvGN";

function salirConAyuda(motivo) {
  console.error(`
${motivo}

Falta el archivo de credenciales. Creá "${join(RAIZ, ".env.consultas.local")}" con:

  SUPABASE_EMAIL=cuenta.de.administracion@ejemplo.com
  SUPABASE_PASSWORD=la-contrasena

Es la misma cuenta con la que entrás a la app a ver las consultas. El archivo está
ignorado por git y no sale de esta computadora.
`);
  process.exit(1);
}

/** Lee un .env simple (CLAVE=valor por línea). Sin dependencias. */
function leerEnv(ruta) {
  let crudo;
  try { crudo = readFileSync(ruta, "utf8"); }
  catch { salirConAyuda("No encontré las credenciales."); }
  const env = {};
  for (const linea of crudo.split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

async function iniciarSesion(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    const detalle = await r.text();
    throw new Error(`No pude iniciar sesión (${r.status}). Revisá el email y la contraseña.\n${detalle}`);
  }
  const { access_token } = await r.json();
  if (!access_token) throw new Error("El login no devolvió una sesión válida.");
  return access_token;
}

async function traer(tabla, columnas, token) {
  const url = `${SUPABASE_URL}/rest/v1/${tabla}?select=${columnas}`;
  const r = await fetch(url, {
    headers: { apikey: ANON_KEY, authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`No pude leer "${tabla}" (${r.status}): ${await r.text()}`);
  return r.json();
}

async function main() {
  const env = leerEnv(join(RAIZ, ".env.consultas.local"));
  if (!env.SUPABASE_EMAIL || !env.SUPABASE_PASSWORD) {
    salirConAyuda("El archivo de credenciales está incompleto.");
  }

  const token = await iniciarSesion(env.SUPABASE_EMAIL, env.SUPABASE_PASSWORD);
  const [consultas, perfiles] = await Promise.all([
    traer("consultas", "id,autor,tipo,texto,estado,respuesta,created_at,respondida_at", token),
    traer("profiles", "id,name", token),
  ]);

  if (consultas.length === 0) {
    console.log(
      "La consulta funcionó pero no vino ninguna fila.\n" +
      "Puede ser que todavía nadie haya mandado nada, o que esta cuenta no tenga permiso\n" +
      "para verlas (hace falta la migración 33 y que la cuenta sea admin del sistema).",
    );
  }

  writeFileSync(SALIDA, informeConsultas(consultas, perfiles, new Date().toISOString()), "utf8");

  const nuevas = consultas.filter((c) => c.estado === "nueva").length;
  console.log(`Listo: ${consultas.length} consultas (${nuevas} nuevas) en consultas-bandeja.md`);
}

// `exitCode` y NO `process.exit()`: cortar el proceso de golpe con una conexión HTTP todavía
// abierta hace abortar a libuv en Windows, y entonces el error real queda tapado por un
// "Assertion failed" y el código de salida pasa a ser 127. Así Node cierra ordenado y el
// código de salida es 1, que es lo que cualquier script que lo llame va a mirar.
main().catch((e) => { console.error("\n" + e.message); process.exitCode = 1; });
```

- [ ] **Step 4: Verify the script fails cleanly with no credentials**

Este es el camino que más se va a recorrer la primera vez, así que tiene que estar bien.

Run:
```bash
node scripts/consultas.mjs
```
Expected: exit 1, y un mensaje que empieza con `No encontré las credenciales.` y muestra la
ruta exacta del archivo a crear. **No** debe imprimir un stack trace de Node.

- [ ] **Step 5: Verify the script fails cleanly with bad credentials**

Run:
```bash
printf 'SUPABASE_EMAIL=no.existe@ejemplo.com\nSUPABASE_PASSWORD=incorrecta\n' > .env.consultas.local && node scripts/consultas.mjs; echo "EXIT: $?"; rm .env.consultas.local
```
Expected: `EXIT: 1` y el mensaje `No pude iniciar sesión (400). Revisá el email y la contraseña.`
El exit code tiene que ser **1**, no 127: un 127 significa que volvió el `process.exit()` y
libuv abortó tapando el error real.

- [ ] **Step 6: Verify Node reads the TypeScript lib and the report comes out right**

El `import` de la lib es estático, así que los Steps 4 y 5 ya lo ejercitaron: si no
resolviera, el script fallaría antes de imprimir su mensaje. Este paso comprueba además que
la salida sale bien formada, sin tocar la red:

```bash
node --input-type=module -e "
import { pathToFileURL } from 'node:url';
const { informeConsultas } = await import(pathToFileURL('src/lib/consultas-informe.ts').href);
console.log(informeConsultas([{id:'x',autor:'u1',tipo:'error',texto:'falla al imprimir',estado:'nueva',respuesta:null,created_at:'2026-07-20T10:00:00Z',respondida_at:null}], [{id:'u1',name:'Ana'}], '2026-07-29T12:00:00Z'));
"
```
Expected: exit 0, e imprime un informe que contiene `# Bandeja de consultas`, `## Errores (1)`,
`### Ana · 2026-07-20 · nueva`, `> falla al imprimir` y `**Sin responder.**`.

- [ ] **Step 7: Commit**

```bash
git add scripts/consultas.mjs .gitignore
git commit -m "feat: script de solo lectura para bajar la bandeja de consultas"
```

---

### Task 3: Documentación y cierre

**Files:**
- Create: `docs/CONSULTAS-PARA-ANALISIS.md`
- Modify: `docs/ESTADO-DEL-PROYECTO.md`

**Interfaces:**
- Consumes: el comando `node scripts/consultas.mjs` de la Task 2.
- Produces: nada de código. Es el documento que Valentino va a leer para configurarlo.

- [ ] **Step 1: Write the user-facing doc**

Crear `docs/CONSULTAS-PARA-ANALISIS.md`:

```markdown
# Leer las consultas del equipo fuera de la app

Un comando baja todo lo que el equipo reportó (consultas, sugerencias y errores) a un
archivo de texto en esta carpeta, para poder leerlo y analizarlo sin abrir el navegador.

## Preparación (una sola vez)

1. Crear un archivo llamado **`.env.consultas.local`** en la carpeta del proyecto, con
   estas dos líneas:

   ```
   SUPABASE_EMAIL=tu.cuenta.de.administracion@ejemplo.com
   SUPABASE_PASSWORD=la-contrasena-de-esa-cuenta
   ```

   Es la misma cuenta con la que entrás a la app a ver las consultas.

2. Listo. No hay que instalar nada.

## Cada vez que quieras mirarlas

```bash
node scripts/consultas.mjs
```

Escribe **`consultas-bandeja.md`** en la carpeta del proyecto, agrupado así:

- **Errores** primero, porque son los que tienen a alguien trabado.
- Después **consultas**, y por último **sugerencias**.
- Dentro de cada grupo, lo que todavía nadie vio va arriba, y lo más reciente primero.
- Cada una indica quién la mandó, cuándo, y si ya tiene respuesta.

## Qué NO hace

- **No modifica nada.** Solo lee. Marcar una consulta como leída o responderla se sigue
  haciendo desde la app, que es donde le llega la respuesta a la persona.
- **No cuenta consultas por persona ni arma ningún ranking.** El nombre está para poder
  responderle, no para contabilizarlo. Alguien que reporta diez errores está haciendo el
  trabajo bien, no mal.

## Cosas a tener en cuenta

- **`consultas-bandeja.md` tiene texto escrito por tu equipo.** Está ignorado por git, así
  que no se sube a GitHub, pero queda en esta computadora en texto plano. Si la compartís,
  compartís lo que escribieron.
- **`.env.consultas.local` tiene una contraseña en texto plano.** También está ignorado por
  git. Es el precio de no tener que abrir el navegador cada vez; si preferís no tenerlo,
  la alternativa es mirar las consultas desde la app como hasta ahora.
- **Si el archivo sale vacío**, puede ser que todavía nadie haya mandado nada, o que la
  cuenta no tenga permiso: hace falta la **migración 33** aplicada y que esa cuenta esté
  marcada como administradora del sistema.

## Por qué no una segunda base de datos

Fue lo primero que se evaluó y se descartó. Poner las consultas en otra base no ayudaría:
seguiría haciendo falta bajarlas a un archivo igual, y encima habría dos copias de los
mismos datos que se pueden desincronizar sin avisar. Este script hace lo que hacía falta y
nada más.
```

- [ ] **Step 2: Update the project status doc**

En `docs/ESTADO-DEL-PROYECTO.md`, dentro de la tabla de la sección **3**, agregar una fila
al final:

```markdown
| Bandeja de consultas leíble fuera de la app (`node scripts/consultas.mjs`) | Hecho — necesita migración 33 |
```

- [ ] **Step 3: Full verification**

Run:
```bash
node node_modules/typescript/bin/tsc -b > /tmp/tsc.log 2>&1; echo "TSC EXIT: $?"; node node_modules/vitest/vitest.mjs run > /tmp/t.log 2>&1; echo "TESTS EXIT: $?"; tail -5 /tmp/t.log; node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"; node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
```
Expected: `TSC EXIT: 0`, `TESTS EXIT: 0` con **1006 tests** en 88 archivos, `LINT EXIT: 0`,
`BUILD EXIT: 0`.

- [ ] **Step 4: Verify nothing sensitive is staged**

Run:
```bash
git status --short && git check-ignore -v consultas-bandeja.md .env.consultas.local
```
Expected: ningún archivo de datos ni de credenciales en el `git status`, y las dos rutas
listadas por `check-ignore`.

- [ ] **Step 5: Commit**

```bash
git add docs/CONSULTAS-PARA-ANALISIS.md docs/ESTADO-DEL-PROYECTO.md
git commit -m "docs: como leer la bandeja de consultas fuera de la app"
```

---

## Lo que este plan deja afuera a propósito

- **Un botón "exportar consultas" en la app.** Sería un segundo camino al mismo resultado
  y habría que mantener los dos. Seiri: una sola forma de hacer cada cosa.
- **Responder desde el archivo.** La respuesta tiene que llegarle a la persona por la app,
  que es donde la va a ver. Un canal de escritura paralelo se desincroniza el primer día.
- **Detección automática de temas repetidos.** Con el volumen actual, leer la lista alcanza.
  Cuando haya cientos de consultas se puede reevaluar; hoy sería adivinar el problema.
