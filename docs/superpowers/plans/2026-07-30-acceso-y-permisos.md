# Acceso y permisos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que nadie vuelva a quedarse afuera del sistema esperando a que alguien abra Supabase — que el jefe pueda blanquear una contraseña desde la app, y que cuando el login falle diga qué pasó y qué hacer.

**Architecture:** El blanqueo necesita permisos de servidor (`service_role`), que no pueden vivir en el navegador, así que va en una Edge Function nueva siguiendo el mismo patrón que las dos que ya existen. La UI vive en el modal de usuario que ya usa el jefe. Los mensajes del login pasan por `clasificarFalla`, que ya existe.

**Tech Stack:** Deno (Edge Function), React 19, TypeScript, vitest, Supabase Auth.

---

## El problema, con nombre y fecha

**30/07/2026.** Un empleado no pudo volver a entrar. Valentino tuvo que arreglarlo a mano desde
el panel de Supabase. Eso significa que:

- Un problema de cinco minutos depende de una persona con acceso a la consola de la base.
- Si esa persona no está, el empleado no trabaja.
- El jefe —que es quien debería resolverlo— no tiene forma de hacerlo.

Y el mismo día, otro usuario reportó **"usuario no encontrado"** al entrar. El sistema tiene la
información para explicar qué pasó y no la usa: dice tres palabras y deja a la persona sin
saber si escribió mal, si le cambiaron el usuario, o si el sistema está roto.

## Por qué NO se hace con "recuperar contraseña por email"

Es lo primero que uno piensa y no sirve acá. `resetPasswordForEmail()` funciona desde el
navegador sin permisos especiales, pero depende de que **la casilla exista y llegue el mail**.
En este sistema los usuarios se crean con un "correo corporativo" que el jefe escribe a mano
—el placeholder del formulario dice literalmente "(acceso/recuperación)"— y nada garantiza que
sea una casilla real que la persona revise. Un blanqueo que depende de un mail que quizá no
llega es peor que no tener blanqueo: da falsa sensación de solución.

El camino que sí funciona siempre: el jefe genera una contraseña temporal y se la pasa a la
persona por donde ya se hablan. Eso necesita `service_role`, y `service_role` **no puede vivir
en el navegador** — con esa clave cualquiera lee y escribe toda la base salteándose RLS. Por
eso va en una Edge Function, que es donde ya viven `crear-usuario` y `eliminar-usuario`.

## Global Constraints

- **NO hay npm, pnpm, yarn ni corepack.** Cero dependencias nuevas. Ver `CLAUDE.md` §1.
- `node` en `C:\Users\Vmagni\AppData\Local\OpenAI\Codex\bin\node.exe`. Bash:
  `export PATH="/c/Users/Vmagni/AppData/Local/OpenAI/Codex/bin:$PATH"`
- Tests `node node_modules/vitest/vitest.mjs run` · Tipos `node node_modules/typescript/bin/tsc -b`
  · Lint `node node_modules/oxlint/bin/oxlint` · Build `node node_modules/vite/bin/vite.js build`
- Exit codes explícitos: `comando > /tmp/log 2>&1; echo "EXIT: $?"`. Nunca `comando | tail`.
- **El pre-commit tarda 90-180 s.** Timeout de **420000 ms** en `git commit`.
- **Cero emojis.** Iconos sólo de `lucide-react`.
- Comentarios en español explicando el **por qué**.
- **Ningún error muestra el mensaje crudo de la base.** Todo pasa por `mensajeUsuario()` o
  `clasificarFalla()` de `src/lib/fallas.ts`.
- **La contraseña temporal no se guarda en ningún lado.** Se muestra una vez y se olvida.
- Nada de tamaños `text-[Npx]`; usar la escala. Tarjetas con `<Panel>`. Hay guardianes.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `edge-function-blanquear-clave.ts` | **Nueva.** Edge Function: valida que quien llama sea jefe y setea una contraseña temporal. Referencia local, se pega en el dashboard. |
| `src/lib/clave-temporal.ts` | **Pura.** Genera y valida la contraseña temporal. Sin red. |
| `src/lib/clave-temporal.test.ts` | Tests de la generación. |
| `src/features/admin/BlanquearClave.tsx` | La UI del blanqueo dentro del modal de usuario. |
| `src/features/admin/UserModal.tsx` | Monta el bloque anterior, sólo para jefes. |
| `src/hooks/useAuth.ts` | Mensajes de login que explican qué pasó. |
| `src/lib/auth.ts` | Diagnóstico puro del fallo de login. |
| `src/lib/auth.test.ts` | Tests del diagnóstico. |
| `docs/ACCESO-Y-PERMISOS.md` | Qué puede hacer cada rol y qué hacer cuando alguien no entra. |

---

### Task 1: Generador de contraseña temporal (puro)

**Files:**
- Create: `src/lib/clave-temporal.ts`
- Test: `src/lib/clave-temporal.test.ts`

**Interfaces:**
- Produces:
  - `export const LARGO_CLAVE = 10`
  - `export function generarClaveTemporal(azar?: () => number): string`
  - `export function claveAceptable(clave: string): string | null`

- [ ] **Step 1: Write the failing test**

Crear `src/lib/clave-temporal.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generarClaveTemporal, claveAceptable, LARGO_CLAVE } from "./clave-temporal";

describe("generarClaveTemporal", () => {
  it("tiene el largo definido", () => {
    expect(generarClaveTemporal()).toHaveLength(LARGO_CLAVE);
  });

  it("cumple el mínimo que pide Supabase (8 caracteres)", () => {
    expect(LARGO_CLAVE).toBeGreaterThanOrEqual(8);
  });

  // Se dicta por teléfono o se manda por chat: un 0 y una O confundidos son otra llamada.
  it("no usa caracteres que se confunden al leerlos en voz alta", () => {
    const clave = generarClaveTemporal();
    expect(clave).not.toMatch(/[0OolI1]/);
  });

  it("no repite la misma clave dos veces seguidas", () => {
    const claves = new Set(Array.from({ length: 50 }, () => generarClaveTemporal()));
    expect(claves.size).toBeGreaterThan(45);
  });

  it("es determinista si se le pasa el azar, para poder testearla", () => {
    const fijo = () => 0;
    expect(generarClaveTemporal(fijo)).toBe(generarClaveTemporal(fijo));
  });

  it("siempre incluye al menos un número, para que no la rechace ninguna política", () => {
    for (let i = 0; i < 30; i++) expect(generarClaveTemporal()).toMatch(/[0-9]/);
  });
});

describe("claveAceptable", () => {
  it("acepta una clave normal", () => {
    expect(claveAceptable("Paris2026x")).toBeNull();
  });

  it("rechaza una demasiado corta, diciendo el mínimo", () => {
    expect(claveAceptable("corta")).toMatch(/8/);
  });

  it("rechaza la vacía", () => {
    expect(claveAceptable("")).not.toBeNull();
    expect(claveAceptable("        ")).not.toBeNull();
  });

  it("es defensiva ante entradas raras", () => {
    expect(claveAceptable(null as unknown as string)).not.toBeNull();
  });

  it("acepta lo que genera el generador", () => {
    for (let i = 0; i < 20; i++) expect(claveAceptable(generarClaveTemporal())).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node node_modules/vitest/vitest.mjs run src/lib/clave-temporal.test.ts > /tmp/c.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/c.log
```
Expected: EXIT distinto de 0, `Failed to resolve import "./clave-temporal"`.

- [ ] **Step 3: Write the implementation**

Crear `src/lib/clave-temporal.ts`:

```ts
// Contraseña temporal para el blanqueo que hace el jefe.
//
// NO es una clave definitiva ni pretende serlo: es un pase de un solo uso que la persona
// cambia apenas entra. Por eso lo que importa acá no es la entropía máxima sino que se pueda
// DICTAR sin errores — se la van a pasar por teléfono o por chat, y un 0 confundido con una O
// es otra llamada y otros diez minutos de alguien que no puede trabajar.

/** Alfabeto sin caracteres ambiguos: se fueron 0, O, o, l, I y 1. */
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const NUMEROS = "23456789";

/** Supabase exige 8 como mínimo; 10 da margen sin volverla incómoda de dictar. */
export const LARGO_CLAVE = 10;
const MINIMO = 8;

/**
 * Una clave temporal. `azar` se inyecta para poder testearla — sin eso, un test sobre algo
 * aleatorio o es frágil o no prueba nada.
 */
export function generarClaveTemporal(azar: () => number = Math.random): string {
  const alfabeto = LETRAS + NUMEROS;
  let out = "";
  for (let i = 0; i < LARGO_CLAVE - 1; i++) {
    out += alfabeto[Math.floor(azar() * alfabeto.length)];
  }
  // El último SIEMPRE es número: hay políticas de contraseña que exigen al menos uno, y que
  // el blanqueo falle por eso sería absurdo justo cuando alguien está esperando para entrar.
  return out + NUMEROS[Math.floor(azar() * NUMEROS.length)];
}

/** `null` si la clave sirve; si no, el motivo en lenguaje de usuario. */
export function claveAceptable(clave: string): string | null {
  const c = typeof clave === "string" ? clave.trim() : "";
  if (!c) return "Escribí una contraseña.";
  if (c.length < MINIMO) return `La contraseña necesita al menos ${MINIMO} caracteres.`;
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node node_modules/vitest/vitest.mjs run src/lib/clave-temporal.test.ts > /tmp/c.log 2>&1; echo "EXIT: $?"; tail -8 /tmp/c.log
```
Expected: `EXIT: 0`, 11 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clave-temporal.ts src/lib/clave-temporal.test.ts
git commit -m "feat: generador de contrasena temporal, dictable sin errores"
```

---

### Task 2: Edge Function que hace el blanqueo

**Files:**
- Create: `edge-function-blanquear-clave.ts`

**Interfaces:**
- Consumes: nada del código de la app (corre en Deno, aparte).
- Produces: el endpoint `POST /functions/v1/blanquear-clave`, body `{ userId, nuevaClave }`,
  respuesta `{ ok: true }` o `{ error: string }`.

**Nota:** este archivo es **referencia local**. Se despliega pegándolo en el dashboard de
Supabase, igual que los otros dos. La Task 5 documenta el paso a paso.

- [ ] **Step 1: Write the function**

Crear `edge-function-blanquear-clave.ts`:

```ts
// Edge Function "blanquear-clave" — pegar en:
// Supabase Dashboard → Edge Functions → blanquear-clave → Edit → reemplazar TODO → Deploy
//
// POR QUÉ EXISTE. El 30/07/2026 un empleado no pudo volver a entrar y hubo que arreglarlo a
// mano desde el panel de Supabase. Eso hace que un problema de cinco minutos dependa de una
// persona con acceso a la consola de la base: si no está, el empleado no trabaja.
//
// POR QUÉ NO SE HACE DESDE EL NAVEGADOR. Cambiar la contraseña de otra persona necesita la
// `service_role`, y esa clave se saltea RLS entero: con ella se lee y escribe TODA la base.
// Puesta en el navegador queda a la vista de cualquiera que abra las herramientas de
// desarrollo. Por eso vive acá, del lado del servidor, y esta función es el único camino.
//
// POR QUÉ NO SE USA EL MAIL DE RECUPERACIÓN. Depende de que la casilla exista y de que llegue
// el mail. Acá los usuarios se crean con un correo que el jefe escribe a mano y que puede no
// ser una casilla real. Un blanqueo que quizá no llega es peor que no tener blanqueo.
//
// ⚠ Este archivo es solo referencia local: NO subirlo a Netlify/Cloudflare.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Mismo mínimo que pide Supabase Auth. */
const MINIMO_CLAVE = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const fail = (s: number, m: string) =>
    new Response(JSON.stringify({ error: m }), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) Quién llama. El JWT viene del navegador y lo valida el servidor de auth: no se
    //    confía en nada que mande el cliente sobre su propia identidad.
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return fail(401, "Sesión inválida. Cerrá sesión y volvé a entrar.");

    // 2) Sólo el jefe. Se lee el rol de la base con la service key, NUNCA del cuerpo del
    //    pedido: si el rol lo mandara el cliente, cualquiera se declararía jefe.
    const { data: perfil } = await admin.from("profiles").select("role, name").eq("id", user.id).single();
    if (perfil?.role !== "jefe") return fail(403, "Solo un jefe puede blanquear contraseñas.");

    const { userId, nuevaClave } = await req.json();
    if (!userId) return fail(400, "Falta indicar de quién es la contraseña.");
    if (typeof nuevaClave !== "string" || nuevaClave.trim().length < MINIMO_CLAVE) {
      return fail(400, `La contraseña necesita al menos ${MINIMO_CLAVE} caracteres.`);
    }

    // 3) Que el destinatario exista de verdad. Sin esto, un id equivocado daría un error
    //    técnico de Auth en vez de decir que esa persona no está.
    const { data: destino } = await admin.from("profiles").select("id, name").eq("id", userId).single();
    if (!destino) return fail(404, "No encontré a esa persona en el equipo.");

    // 4) El cambio en sí.
    const { error } = await admin.auth.admin.updateUserById(userId, { password: nuevaClave.trim() });
    if (error) return fail(400, "No se pudo cambiar la contraseña: " + error.message);

    // 5) Rastro. Un cambio de contraseña ajena SIEMPRE tiene que quedar registrado: es la
    //    diferencia entre una herramienta de soporte y una puerta trasera. Si la tabla de
    //    notificaciones no existiera, el blanqueo NO se deshace por eso — ya está hecho.
    try {
      await admin.from("notifications").insert({
        owner: userId,
        tipo: "sistema",
        titulo: "Tu contraseña fue restablecida",
        detalle: `${perfil.name ?? "La administración"} generó una contraseña nueva para tu cuenta. Cambiala cuando entres.`,
        leida: false,
      });
    } catch { /* el aviso es deseable, no imprescindible */ }

    return new Response(JSON.stringify({ ok: true, nombre: destino.name }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return fail(500, "Error inesperado: " + (e as Error).message);
  }
});
```

- [ ] **Step 2: Verify it is not bundled into the web build**

El archivo usa `Deno.serve` y `npm:` — si Vite lo tomara, el build rompería. Está en la raíz,
fuera de `src/`, igual que `edge-function-eliminar-usuario.ts`.

```bash
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
grep -rn "blanquear-clave" dist/ 2>/dev/null | head -3 || echo "(no aparece en el bundle — correcto)"
```
Expected: `BUILD EXIT: 0`, y el grep sin resultados.

- [ ] **Step 3: Commit**

```bash
git add edge-function-blanquear-clave.ts
git commit -m "feat: edge function para que el jefe blanquee una contrasena"
```

---

### Task 3: El botón, dentro del modal de usuario

**Files:**
- Create: `src/features/admin/BlanquearClave.tsx`
- Modify: `src/features/admin/UserModal.tsx`

**Interfaces:**
- Consumes: `generarClaveTemporal()`, `claveAceptable()` de `src/lib/clave-temporal.ts`
  (Task 1); el endpoint de la Task 2; `mensajeUsuario()` de `src/lib/fallas.ts`;
  `SUPABASE_URL` de `src/lib/supabase.ts`.
- Produces: `export function BlanquearClave({ userId, nombre }: { userId: string; nombre: string })`

- [ ] **Step 1: Write the component**

Crear `src/features/admin/BlanquearClave.tsx`:

```tsx
import { useState } from "react";
import { KeyRound, Copy, Check } from "lucide-react";
import { supabase, SUPABASE_URL } from "../../lib/supabase";
import { generarClaveTemporal } from "../../lib/clave-temporal";
import { mensajeUsuario } from "../../lib/fallas";

// Blanqueo de contraseña, para que nadie quede afuera esperando a que alguien abra Supabase.
//
// DECISIONES QUE IMPORTAN:
//
// · La clave se muestra UNA VEZ y no se guarda en ningún lado. No va a la base, no va a
//   localStorage, no queda en el historial. Si se pierde, se genera otra — que es barato.
//   Guardarla "por las dudas" convertiría a la app en el lugar donde están las contraseñas
//   de todos en texto plano.
//
// · Hay confirmación antes de hacerlo. Es una acción sobre la cuenta de otra persona y la
//   deja sin poder entrar hasta que reciba la clave nueva: no puede pasar por un clic al pasar.
//
// · El texto dice explícitamente que hay que avisarle a la persona. El blanqueo sin aviso deja
//   a alguien sin poder trabajar y sin entender por qué.

export function BlanquearClave({ userId, nombre }: { userId: string; nombre: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [clave, setClave] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function blanquear() {
    setEnviando(true);
    setError("");
    const nueva = generarClaveTemporal();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(SUPABASE_URL + "/functions/v1/blanquear-clave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (session?.access_token ?? ""),
        },
        body: JSON.stringify({ userId, nuevaClave: nueva }),
      });
      const out = await r.json();
      if (!r.ok) { setError(out.error ?? "No se pudo blanquear la contraseña."); return; }
      setClave(nueva);
      setConfirmando(false);
    } catch (e) {
      setError(mensajeUsuario(e, "blanquear la contraseña"));
    } finally {
      setEnviando(false);
    }
  }

  function copiar() {
    if (!clave) return;
    navigator.clipboard?.writeText(clave)
      .then(() => { setCopiada(true); setTimeout(() => setCopiada(false), 2000); })
      .catch(() => { /* sin permiso de portapapeles: la clave igual está a la vista */ });
  }

  // Después del blanqueo: la clave, una sola vez.
  if (clave) {
    return (
      <div className="border-t border-line mt-4 pt-4">
        <p className="text-sm text-ink m-0 mb-2">
          Contraseña nueva de <b>{nombre}</b>. <b>Anotala ahora</b>: no se guarda en ningún lado
          y no se puede volver a ver.
        </p>
        <div className="flex items-center gap-2">
          <code className="bg-surface2 border border-line rounded-lg px-3 py-2 text-base tracking-wider select-all">{clave}</code>
          <button onClick={copiar}
            className="inline-flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3 py-2 text-sm font-semibold">
            {copiada ? <Check size={14} /> : <Copy size={14} />} {copiada ? "Copiada" : "Copiar"}
          </button>
        </div>
        <p className="text-xs text-ink2 m-0 mt-2">
          Pasásela por donde se hablen habitualmente y pedile que la cambie cuando entre.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-line mt-4 pt-4">
      {!confirmando ? (
        <>
          <button onClick={() => setConfirmando(true)}
            className="inline-flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3 py-2 text-sm font-semibold text-ink">
            <KeyRound size={14} /> Blanquear contraseña
          </button>
          <p className="text-xs text-ink2 m-0 mt-1.5">
            Genera una contraseña nueva para que {nombre} pueda volver a entrar.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-ink m-0 mb-2">
            La contraseña actual de <b>{nombre}</b> deja de servir en el momento. Hasta que le
            pases la nueva, no va a poder entrar.
          </p>
          <div className="flex gap-2">
            <button onClick={blanquear} disabled={enviando}
              className="rounded-lg px-3.5 py-2 text-sm font-semibold bg-accent text-[color:var(--accent-ink)] disabled:opacity-50">
              {enviando ? "Generando…" : "Sí, blanquear"}
            </button>
            <button onClick={() => setConfirmando(false)} disabled={enviando}
              className="border border-line bg-surface2 rounded-lg px-3.5 py-2 text-sm font-semibold text-ink">
              Cancelar
            </button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-danger m-0 mt-2">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Mount it in the user modal, for jefes only**

En `src/features/admin/UserModal.tsx`, agregar al bloque de imports:

```tsx
import { BlanquearClave } from "./BlanquearClave";
```

Buscar dónde está el bloque de eliminar usuario, que ya está gateado por `esJefe`:

```bash
grep -n "esJefe" src/features/admin/UserModal.tsx
```

Insertar el componente **dentro** de ese mismo bloque condicional, justo **antes** del bloque
de eliminar. El orden importa: blanquear es reversible y frecuente, eliminar es definitivo y
raro; lo peligroso va último y separado.

```tsx
{esJefe && <BlanquearClave userId={u.id} nombre={u.name} />}
```

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
git add src/features/admin/BlanquearClave.tsx src/features/admin/UserModal.tsx
git commit -m "feat: el jefe puede blanquear una contrasena desde la app"
```

---

### Task 4: Que el login diga qué pasó

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/hooks/useAuth.ts`
- Test: `src/lib/auth.test.ts`

**Interfaces:**
- Consumes: `resuelveIdentificador()` de `src/lib/auth.ts`, ya existente.
- Produces: `export function mensajeDeLogin(e: unknown, identificador: string): string`

**Contexto:** hoy `useAuth.ts:41` devuelve el texto `"Usuario no encontrado"` y nada más. La
persona no sabe si escribió mal, si le cambiaron el usuario, o si el sistema está roto — y el
sistema **sí tiene** cómo distinguirlo.

- [ ] **Step 1: Write the failing test**

Agregar al final de `src/lib/auth.test.ts`:

```ts
import { mensajeDeLogin } from "./auth";

describe("mensajeDeLogin — explicar en vez de dejar a alguien adivinando", () => {
  it("credenciales incorrectas: dice que puede ser cualquiera de los dos", () => {
    const msg = mensajeDeLogin({ message: "Invalid login credentials" }, "jperez");
    expect(msg).toMatch(/usuario|contraseña/i);
    expect(msg).not.toMatch(/Invalid login credentials/);
  });

  // El caso del 30/07: alguien entró y le dijo "Usuario no encontrado", sin más.
  it("usuario inexistente: sugiere probar con el email y a quién pedirle ayuda", () => {
    const msg = mensajeDeLogin({ codigo: "sin-usuario" }, "jperez");
    expect(msg).toMatch(/jperez/);
    expect(msg).toMatch(/correo|email/i);
  });

  it("si el identificador era un email, NO sugiere probar con el email", () => {
    const msg = mensajeDeLogin({ codigo: "sin-usuario" }, "j@paris.com");
    expect(msg).not.toMatch(/probá con tu correo/i);
  });

  it("sin conexión lo dice, en vez de acusar a la contraseña", () => {
    expect(mensajeDeLogin(new TypeError("Failed to fetch"), "jperez")).toMatch(/conexión|internet/i);
  });

  it("email sin confirmar se distingue de contraseña equivocada", () => {
    expect(mensajeDeLogin({ message: "Email not confirmed" }, "j@paris.com")).toMatch(/confirm/i);
  });

  it("demasiados intentos se distingue, para que no cambien la clave al pedo", () => {
    const msg = mensajeDeLogin({ message: "For security purposes, you can only request this after 42 seconds" }, "j");
    expect(msg).toMatch(/esperá|momento|intentos/i);
  });

  it("nunca devuelve vacío ni el mensaje crudo", () => {
    for (const raro of [null, undefined, {}, "", 0]) {
      const msg = mensajeDeLogin(raro, "x");
      expect(msg.trim().length).toBeGreaterThan(10);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node node_modules/vitest/vitest.mjs run src/lib/auth.test.ts > /tmp/a.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/a.log
```
Expected: EXIT distinto de 0, `mensajeDeLogin is not a function`.

- [ ] **Step 3: Write the implementation**

Agregar al final de `src/lib/auth.ts`:

```ts
/**
 * Qué mostrarle a alguien que no pudo entrar.
 *
 * POR QUÉ. Hasta acá el login decía "Usuario no encontrado" y nada más. El 30/07/2026 alguien
 * se quedó afuera con ese cartel: no sabía si había escrito mal, si le habían cambiado el
 * usuario, o si el sistema estaba roto. El sistema SÍ puede distinguir esos casos, y no
 * hacerlo convierte un problema de treinta segundos en una llamada.
 *
 * Regla de seguridad que se respeta igual: ante credenciales incorrectas NO se dice cuál de
 * las dos falló. Decir "el usuario existe pero la contraseña está mal" le confirma a un
 * desconocido que esa cuenta existe.
 *
 * PURA: recibe el error y el identificador, devuelve texto.
 */
export function mensajeDeLogin(e: unknown, identificador: string): string {
  const msg = (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string")
    ? (e as { message: string }).message : "";
  const codigo = (e && typeof e === "object") ? (e as { codigo?: string }).codigo : undefined;
  const id = (identificador ?? "").trim();

  if (/failed to fetch|load failed|networkerror/i.test(msg)) {
    return "No hay conexión con el servidor. Revisá tu internet y probá de nuevo.";
  }

  // Nuestro propio código, cuando el nombre de usuario no resuelve a ninguna cuenta.
  if (codigo === "sin-usuario") {
    const sugerencia = resuelveIdentificador(id) === "username"
      ? " Probá con tu correo en lugar del usuario."
      : "";
    return `No encontré ninguna cuenta con "${id}".${sugerencia} Si estás seguro de que está bien, pedile a la administración que lo verifique.`;
  }

  if (/email not confirmed/i.test(msg)) {
    return "Tu cuenta todavía no está confirmada. Avisale a la administración para que la habilite.";
  }

  if (/for security purposes|rate limit|too many/i.test(msg)) {
    return "Hubo demasiados intentos seguidos. Esperá un momento y volvé a probar — no hace falta cambiar la contraseña.";
  }

  if (/invalid login credentials/i.test(msg)) {
    // A propósito no se aclara cuál de los dos: ver el comentario de arriba.
    return "El usuario o la contraseña no coinciden. Si no la recordás, pedile a la administración que te la blanquee.";
  }

  return "No se pudo iniciar sesión. Probá de nuevo, y si sigue pasando avisale a la administración.";
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node node_modules/vitest/vitest.mjs run src/lib/auth.test.ts > /tmp/a.log 2>&1; echo "EXIT: $?"; tail -8 /tmp/a.log
```
Expected: `EXIT: 0`.

- [ ] **Step 5: Use it in useAuth**

En `src/hooks/useAuth.ts`, reemplazar la línea:

```ts
    if (!email) return { message: "Usuario no encontrado" };
```

por:

```ts
    // `codigo` propio para que `mensajeDeLogin` distinga este caso del de contraseña
    // equivocada: son problemas distintos y llevan a acciones distintas.
    if (!email) return { message: mensajeDeLogin({ codigo: "sin-usuario" }, id), codigo: "sin-usuario" };
```

Y en el import de arriba del archivo:

```ts
import { resuelveIdentificador, mensajeDeLogin } from "../lib/auth";
```

Además, envolver los dos `signInWithPassword` para que su error también pase por el traductor.
La rama de email queda:

```ts
    if (resuelveIdentificador(id) === "email") {
      const { error } = await supabase.auth.signInWithPassword({ email: id, password });
      return error ? { message: mensajeDeLogin(error, id) } : null;
    }
```

y la de username, después de resolver el email:

```ts
    const { error } = await supabase.auth.signInWithPassword({ email: email as string, password });
    return error ? { message: mensajeDeLogin(error, id) } : null;
```

- [ ] **Step 6: Full verification**

```bash
node node_modules/typescript/bin/tsc -b > /tmp/t.log 2>&1; echo "TSC EXIT: $?"; cat /tmp/t.log
node node_modules/oxlint/bin/oxlint > /tmp/l.log 2>&1; echo "LINT EXIT: $?"
node node_modules/vitest/vitest.mjs run > /tmp/all.log 2>&1; echo "TESTS EXIT: $?"; tail -6 /tmp/all.log
node node_modules/vite/bin/vite.js build > /tmp/b.log 2>&1; echo "BUILD EXIT: $?"
```
Expected: los cuatro en `EXIT: 0`.

Si `Login.tsx` renderiza `error.message`, ya muestra el texto nuevo sin tocar nada. Verificar:

```bash
grep -n "message" src/components/Login.tsx
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts src/hooks/useAuth.ts
git commit -m "fix: el login explica que paso en vez de decir usuario no encontrado"
```

---

### Task 5: Documentar quién puede qué, y qué hacer cuando alguien no entra

**Files:**
- Create: `docs/ACCESO-Y-PERMISOS.md`
- Modify: `src/lib/version.ts`
- Modify: `docs/ESTADO-DEL-PROYECTO.md`

**Interfaces:** ninguna. Es documentación y cierre.

- [ ] **Step 1: Write the doc**

Crear `docs/ACCESO-Y-PERMISOS.md`:

```markdown
# Acceso y permisos

Quién puede hacer qué, y qué hacer cuando alguien no puede entrar.

## Cuando alguien no puede entrar

Preguntale **qué dice exactamente el cartel**. El login ahora distingue los casos, y cada uno
lleva a una acción distinta:

| Lo que dice | Qué pasó | Qué hacer |
|---|---|---|
| "No encontré ninguna cuenta con X" | El usuario que escribió no existe | Que pruebe con su correo. Si tampoco, revisá el usuario en Administración |
| "El usuario o la contraseña no coinciden" | Existe, pero algo no coincide | Blanqueale la contraseña (abajo) |
| "Hubo demasiados intentos seguidos" | Supabase lo frenó un rato | Esperar unos minutos. **No** cambiar la contraseña: no es eso |
| "No hay conexión con el servidor" | Internet | Revisar la conexión |
| "Tu cuenta todavía no está confirmada" | Falta confirmarla | Confirmarla en Supabase → Authentication → Users |

A propósito, cuando la contraseña no coincide **no se aclara cuál de los dos falló**. Decir
"el usuario existe pero la contraseña está mal" le confirma a un desconocido que esa cuenta
existe.

## Blanquear una contraseña

**Sólo el jefe.** Administración → clic en la persona → "Blanquear contraseña".

Genera una contraseña temporal, la muestra **una sola vez** y no la guarda en ningún lado. Hay
que anotarla en el momento; si se pierde, se genera otra. Pasásela a la persona por donde se
hablen habitualmente y pedile que la cambie cuando entre.

La persona recibe además un aviso dentro de la app diciendo que su contraseña fue restablecida
y quién lo hizo. Eso no es un detalle: es lo que separa una herramienta de soporte de una
puerta trasera.

**Por qué no hay "recuperar contraseña por email":** los usuarios se crean con un correo que se
escribe a mano y que puede no ser una casilla real que la persona revise. Un blanqueo que
depende de un mail que quizá no llega es peor que no tener blanqueo.

## Qué puede hacer cada rol

| | Empleado | Encargado | Jefe | Admin del sistema |
|---|---|---|---|---|
| Ver y editar sus tareas | Sí | Sí | Sí | Sí |
| Ver y editar las de su equipo | No | Sí | Sí | Sí |
| Ver todo el equipo | No | Su equipo | Sí | Sí |
| Crear y eliminar usuarios | No | No | Sí | No |
| Blanquear contraseñas | No | No | **Sí** | No |
| Cambiar rol, marca o sucursal | No | No | Sí | No |
| Ver las consultas del equipo | Las suyas | Las suyas | **No** | **Sí** |

Dos cosas de esa tabla que suelen sorprender y son a propósito:

- **El jefe no ve las consultas.** Es el canal donde el equipo reporta problemas; si lo leyera
  el jefe, nadie reportaría nada incómodo. Van a la cuenta de administración del sistema.
- **El admin del sistema no administra usuarios.** Sólo ve las consultas. Son dos permisos
  separados a propósito: quien lee los reclamos no es quien decide sobre las cuentas.

## Cómo se hace cumplir

En la base, no en la pantalla. Esconder un botón no es un permiso: quien sepa hacerlo llama a
la base igual. Las reglas reales son las policies de RLS, y la app sólo evita mostrar cosas que
el servidor va a rechazar de todos modos.

Tres piezas:

- **Policies de RLS** por tabla, con el mismo modelo en todas: propio, o `es_jefe()`, o
  `es_encargado_de(owner)`. **Lectura y escritura tienen que coincidir** — la migración 36
  existe porque no coincidían y un encargado podía ver el trabajo de su equipo pero no
  guardarlo.
- **Un trigger sobre `profiles`** que bloquea las columnas sensibles (`role`, `manager_id`,
  `oculto`, `username`, `email`, `marca`, `sucursal`, `admin_sistema`). **Toda columna nueva
  que otorgue permisos tiene que agregarse ahí en la misma migración que la crea**: es una
  lista explícita, así que lo que no está queda desprotegido en silencio. La migración 35
  existe porque `admin_sistema` se agregó y nadie tocó el trigger.
- **Edge Functions** para lo que necesita `service_role` (crear, eliminar y blanquear). Cada
  una valida el rol leyéndolo de la base, nunca del cuerpo del pedido.

## Desplegar una Edge Function

Los archivos `edge-function-*.ts` de la raíz son **referencia local**: no se compilan ni se
suben con la app. Para cada uno:

1. Supabase Dashboard → Edge Functions
2. Si no existe, "Create function" con el nombre exacto (`blanquear-clave`)
3. Edit → reemplazar **todo** el contenido por el del archivo → Deploy

No hace falta configurar variables: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya están
disponibles dentro de las funciones.
```

- [ ] **Step 2: Add the changelog entry**

En `src/lib/version.ts`, agregar arriba de todo en `CHANGELOG`:

```ts
  {
    version: "2.10.0",
    fecha: "2026-07-30",
    cambios: [
      "El jefe ya puede blanquear la contraseña de alguien desde Administración, sin depender de nadie. Se muestra una vez, se anota y se le pasa a la persona.",
      "Si te blanquean la contraseña, te llega un aviso dentro de la app diciendo quién lo hizo.",
      "Cuando falla el ingreso, ahora dice qué pasó y qué hacer, en vez de \"Usuario no encontrado\". Distingue usuario inexistente, contraseña equivocada, falta de conexión y demasiados intentos seguidos.",
      "Corregido: un encargado no podía guardar la recurrencia de una tarea de su equipo ni ver lo que registraban en las operativas.",
    ],
  },
```

- [ ] **Step 3: Update the status doc**

En `docs/ESTADO-DEL-PROYECTO.md`: actualizar la versión a **2.10.0** y el número de tests al de
la corrida final, y agregar al final de la tabla de la sección 3:

```markdown
| Blanqueo de contraseña por el jefe | Hecho — **falta desplegar la Edge Function** |
| Mensajes de login que explican qué pasó | Hecho |
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
git commit -m "docs: acceso y permisos, changelog 2.10.0"
```

---

## Lo que este plan NO hace, y por qué

- **No rehace el modelo de permisos.** Está bien como está: propio / equipo / todo, con RLS
  como fuente de verdad. Lo que fallaba no era el modelo sino dos olvidos puntuales, ya
  corregidos por las migraciones 35 y 36. Rehacerlo sería cambiar algo que funciona por algo
  sin probar.
- **No agrega autenticación de dos factores ni política de expiración de contraseñas.** Para un
  equipo de esta escala, agregan fricción diaria y resuelven un riesgo que hoy no es el que
  duele. El que duele es quedarse afuera, y eso lo resuelve la Task 3.
- **No toca la creación de usuarios.** Funciona. Se documenta y listo.
- **No arregla los 30 mensajes de error crudos que quedan** fuera de los cinco ya migrados.
  Es una tarea aparte, mecánica, que merece su propio commit.

## Lo que queda en tus manos

1. **Desplegar `blanquear-clave`** pegándola en el dashboard (tres pasos, documentados arriba).
   Hasta que eso pase, el botón va a existir y va a dar error.
2. **Probar el blanqueo** con una cuenta de prueba antes de usarlo con alguien real.
