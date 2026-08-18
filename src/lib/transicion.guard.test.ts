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
