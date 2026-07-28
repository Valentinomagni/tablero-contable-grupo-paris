# Vista de impresión dedicada del Reporte — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que "Imprimir / PDF" del Reporte produzca un PDF con contenido real, en vez de
páginas en blanco.

**Architecture:** Se abandona el enfoque `@media print` (esconder la app con CSS) y se pasa
a una **vista de impresión dedicada**: una función pura arma un documento HTML completo y
autocontenido con los datos del reporte, se abre en una ventana nueva y se imprime ahí. La
ventana nueva no tiene el armazón de la app (contenedores flex, `height:100vh`,
`overflow:hidden`), que es exactamente lo que recortaba el contenido y dejaba la hoja
vacía. El modo de falla anterior queda **estructuralmente imposible**, no "mitigado".

**Tech Stack:** TypeScript, React 19, vitest. Sin librerías nuevas (nada de jsPDF/html2canvas).

## Global Constraints

- **Cero emojis** en la UI y en el documento impreso (regla de marca del proyecto).
- Monocromo negro/blanco; el color sólo comunica estado.
- Nada de dependencias nuevas.
- Todo texto que venga de datos (nombres de personas, marcas, sucursales) debe ir
  **escapado** en el HTML generado: son datos de usuario y se inyectan como string.
- El documento impreso no debe depender de red: sin fuentes externas ni imágenes remotas.

---

## Diagnóstico (por qué falló lo anterior)

`src/features/reporte/Reporte.tsx:80-88` inyecta reglas `@media print` que ocultan `aside`,
`.no-print` y los botones, y `src/index.css:67-72` intenta deshacer el layout de la app.
El problema es que el contenido vive dentro de una cadena de contenedores flex con altura
fija y `overflow` recortado; deshacer eso desde CSS de impresión es frágil y depende del
navegador. Además yo lo di por verificado con una captura estática, que **no ejercita el
motor de impresión** — por eso no detecté que seguía en blanco.

**Criterio de verificación de esta tanda:** no alcanza con tests. La confirmación final es
visual y la hace el propietario (Ctrl+P → ver la vista previa con contenido). El diseño
elegido hace que eso sea fácil de comprobar de un vistazo.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/impresion.ts` (nuevo) | **Puro.** `escaparHtml()` y `documentoImpresion(datos)`: arma el HTML completo del reporte. Sin DOM, sin React → testeable. |
| `src/lib/impresion.test.ts` (nuevo) | Tests de la función pura. |
| `src/lib/impresion-dom.ts` (nuevo) | `abrirImpresion(html)`: única parte que toca `window.open`. Aislada para que la lógica siga siendo testeable. |
| `src/features/reporte/Reporte.tsx` (modificar) | Arma `DatosReporte` con lo que ya calcula y cambia el `onClick` del botón. Se borran las reglas `@media print` locales. |

---

## Task 1: Función pura que arma el documento

**Files:**
- Create: `src/lib/impresion.ts`
- Test: `src/lib/impresion.test.ts`

**Interfaces:**
- Produces:
  - `export function escaparHtml(s: string): string`
  - `export interface DatosReporte { titulo: string; subtitulo: string; generado: string; kpis: {rotulo: string; valor: string; detalle?: string}[]; secciones: {titulo: string; filas: {celdas: string[]}[]; encabezados: string[]}[]; }`
  - `export function documentoImpresion(d: DatosReporte): string`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { escaparHtml, documentoImpresion, type DatosReporte } from "./impresion";

const DATOS: DatosReporte = {
  titulo: "Reporte ejecutivo — Equipo Contable",
  subtitulo: "Peugeot · Centro",
  generado: "27 de julio de 2026",
  kpis: [{ rotulo: "Salud del equipo", valor: "82%", detalle: "Saludable" }],
  secciones: [{ titulo: "Por persona", encabezados: ["Persona", "Puntos"], filas: [{ celdas: ["Ana", "12"] }] }],
};

describe("escaparHtml", () => {
  it("escapa los caracteres que romperían el HTML", () => {
    expect(escaparHtml('<b>"A" & \'B\'</b>')).toBe("&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;");
  });
});

describe("documentoImpresion", () => {
  it("devuelve un documento HTML completo y autocontenido", () => {
    const html = documentoImpresion(DATOS);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("</html>");
    expect(html).toContain("<style>");
    // sin recursos externos: nada de red al imprimir
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
  });

  it("incluye título, subtítulo, fecha, KPIs y las filas de cada sección", () => {
    const html = documentoImpresion(DATOS);
    expect(html).toContain("Reporte ejecutivo");
    expect(html).toContain("Peugeot · Centro");
    expect(html).toContain("27 de julio de 2026");
    expect(html).toContain("Salud del equipo");
    expect(html).toContain("82%");
    expect(html).toContain("Por persona");
    expect(html).toContain("Ana");
    expect(html).toContain("12");
  });

  it("escapa los datos de usuario (un nombre con < > no rompe el documento)", () => {
    const html = documentoImpresion({ ...DATOS, secciones: [{ titulo: "T", encabezados: ["P"], filas: [{ celdas: ["<script>x</script>"] }] }] });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("sin secciones ni kpis igual devuelve un documento válido", () => {
    const html = documentoImpresion({ ...DATOS, kpis: [], secciones: [] });
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("</html>");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node node_modules/vitest/vitest.mjs run src/lib/impresion.test.ts`
Expected: FAIL — "Failed to resolve import ./impresion"

- [ ] **Step 3: Implementar `src/lib/impresion.ts`**

Requisitos de la implementación:
- `escaparHtml` reemplaza `&`, `<`, `>`, `"`, `'` (el `&` primero, o se re-escapan los demás).
- `documentoImpresion` devuelve `<!DOCTYPE html>` … `</html>` con `<style>` embebido.
- CSS: `@page { size: A4; margin: 14mm }`, tipografía del sistema, tablas con
  `border-collapse`, `thead { display: table-header-group }` para repetir encabezados en
  cada hoja, y `tr { break-inside: avoid }`.
- **Sin** `http://` ni `https://` en la salida (ni fuentes ni imágenes remotas).
- Todos los strings de `d` pasan por `escaparHtml`.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node node_modules/vitest/vitest.mjs run src/lib/impresion.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/impresion.ts src/lib/impresion.test.ts
git commit -m "feat: documento de impresion autocontenido (funcion pura + tests)"
```

---

## Task 2: Apertura de la ventana de impresión

**Files:**
- Create: `src/lib/impresion-dom.ts`

**Interfaces:**
- Consumes: nada de Task 1 (recibe el html ya armado).
- Produces: `export function abrirImpresion(html: string): boolean` — `false` si el
  navegador bloqueó la ventana emergente.

- [ ] **Step 1: Implementar**

```ts
/**
 * Abre el documento de impresión en una ventana nueva y dispara el diálogo de impresión.
 *
 * POR QUÉ UNA VENTANA NUEVA: imprimir la app en el lugar obligaba a deshacer con CSS todo
 * el armazón (contenedores flex, height:100vh, overflow:hidden). Eso es frágil y fue lo que
 * dejaba la hoja en blanco. Un documento propio no tiene nada de eso que deshacer.
 *
 * Devuelve false si el navegador bloqueó la ventana emergente, para que la UI avise en vez
 * de quedarse callada (falla silenciosa = el usuario cree que la app se colgó).
 */
export function abrirImpresion(html: string): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  // El print va después del load: si se dispara antes, Chrome imprime el documento vacío.
  win.onload = () => { win.focus(); win.print(); };
  return true;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `node node_modules/typescript/bin/tsc -b`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/lib/impresion-dom.ts
git commit -m "feat: abrir la vista de impresion en ventana propia"
```

---

## Task 3: Conectar el Reporte

**Files:**
- Modify: `src/features/reporte/Reporte.tsx` (borrar el `<style>` con `@media print` de las
  líneas 80-88 y el `rep-print-header`; cambiar el `onClick` del botón de la línea 116)

**Interfaces:**
- Consumes: `documentoImpresion(d: DatosReporte): string`, `abrirImpresion(html): boolean`.

- [ ] **Step 1: Armar los datos y cambiar el botón**

El componente ya calcula todo: `salud`/`saludTxt`, `pctAvance`, `term30`, `total`, `punt`,
`arqueo`, `rank`, `vencidas`, `bloqueadas`, `estSegs`, `segLbl`. Se arma `DatosReporte` con
eso y el botón pasa a:

```tsx
onClick={() => {
  const ok = abrirImpresion(documentoImpresion(datosImpresion));
  if (!ok) toast.error("El navegador bloqueó la ventana. Permití las ventanas emergentes de este sitio y probá de nuevo.");
}}
```

- [ ] **Step 2: Borrar el CSS de impresión que ya no aplica**

Sacar el bloque `<style>` de `Reporte.tsx:80-88` y el `div.rep-print-header`. Dejar en
`src/index.css:67-72` el `@media print` general (lo usan otras vistas), pero verificar que
nada más dependa de `rep-print-header`.

- [ ] **Step 3: Verificar tipos, tests y build**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run && node node_modules/vite/bin/vite.js build`
Expected: tsc exit 0, todos los tests en verde, build OK.

- [ ] **Step 4: Commit**

```bash
git add src/features/reporte/Reporte.tsx
git commit -m "fix: el Reporte imprime desde una vista dedicada, no con @media print"
```

---

## Verificación final (la hace el propietario)

Los tests garantizan que el documento se arma bien, **no** que el navegador lo imprima
bien — esa fue justamente mi falla anterior. Confirmación visual, en la app publicada:

1. Entrar a **Reporte**.
2. Apretar **Imprimir / PDF**.
3. Se abre una pestaña nueva y aparece el diálogo de impresión.
4. **En la vista previa tiene que verse el contenido** (título, KPIs, tablas), no hojas en
   blanco.
5. Guardar como PDF y abrirlo para confirmar.

Si la vista previa sale en blanco, el enfoque falló y hay que reportarlo — no darlo por
bueno.
