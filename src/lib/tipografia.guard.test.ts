/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// La primera línea (`/// <reference types="node" />`) NO es decorativa y no se puede borrar:
// `tsconfig.app.json` fija `"types": ["vite/client"]`, así que los tipos de Node no entran
// solos y `tsc` corta con TS2591 en el import de `node:fs`. La alternativa era agregar "node"
// a ese `types`, pero eso mete los globales de Node en el chequeo de TODO el código de la
// app: un `process.env` perdido en código de navegador dejaría de ser un error. Esta forma
// resuelve el problema en el único archivo que lo tiene.
//
// GUARDIÁN, no test de lógica. Existe para que la escala tipográfica no se erosione: el
// modo en que se rompe un sistema de diseño no es una decisión, es un `text-[13px]` puesto
// a las apuradas que nadie revisa. Un test que falla es la única forma de que eso no pase.
//
// Si de verdad hace falta un tamaño nuevo, se agrega A LA ESCALA en tailwind.config.js —
// que es justamente la conversación que este test fuerza a tener.

function archivosFuente(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) { out.push(...archivosFuente(ruta)); continue; }
    if (/\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) out.push(ruta);
  }
  return out;
}

describe("escala tipográfica", () => {
  // 30 segundos y no los 5 por defecto: este test lee todo `src` de disco, así que su
  // duración crece con el proyecto y depende de la carga de la máquina. Ver el comentario
  // largo en `src/lib/encuadre.guard.test.ts` — un guardián que falla al azar se termina
  // borrando por molesto, y ahí se pierde la protección.
  it("ningún archivo usa un tamaño de texto en píxeles a mano", { timeout: 30_000 }, () => {
    const culpables: string[] = [];
    for (const ruta of archivosFuente("src")) {
      const texto = readFileSync(ruta, "utf8");
      const encontrados = texto.match(/text-\[\d+(\.\d+)?px\]/g);
      if (encontrados) culpables.push(`${ruta}: ${[...new Set(encontrados)].join(", ")}`);
    }
    expect(culpables, `Usá la escala (text-2xs .. text-2xl) en vez de píxeles a mano:\n${culpables.join("\n")}`).toEqual([]);
  });
});
