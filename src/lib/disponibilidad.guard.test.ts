import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Guardián: ninguna pantalla que NO sea Administración le nombra un número de migración a
// quien la está mirando.
//
// POR QUÉ HACE FALTA UN GUARDIÁN Y NO ALCANZA CON HABERLO ARREGLADO. Esto ya se arregló en seis
// archivos, y el patrón vuelve solo: cada función nueva que depende de una migración necesita un
// texto para cuando la migración no está, y lo más cómodo de escribir es el número. El
// `TransferenciasSection` de esta misma semana nació con "va a estar disponible tras la
// migración 49" sin que nadie lo pidiera.
//
// La regla de fondo: un número de migración es información de adentro. A un empleado le informa
// que le falta algo que no entiende y sobre lo que no puede hacer nada — y de paso le muestra
// una tubería que no le corresponde ver. En Administración es al revés: quien la abre es
// exactamente quien corre las migraciones, y sin el número tendría que ir a buscarlo.

/** Carpetas de pantallas donde el número SÍ está permitido, y por qué. */
const PERMITIDAS = [
  "src/features/admin",      // quien la abre es quien corre las migraciones
  "src/features/consultas/BandejaConsultas.tsx", // sólo la ve la cuenta de administración
];

function archivosTsx(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) archivosTsx(ruta, acc);
    else if (nombre.endsWith(".tsx") && !nombre.endsWith(".test.tsx")) acc.push(ruta);
  }
  return acc;
}

/** Quita comentarios: explicar el porqué en el código es justamente lo que queremos. */
function sinComentarios(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")   // {/* comentario JSX */}
    .replace(/\/\*[\s\S]*?\*\//g, "")             // /* bloque */
    .replace(/^\s*\/\/.*$/gm, "");                // // línea
}

describe("ninguna pantalla del empleado nombra un número de migración", () => {
  it("no aparece 'migración N' en texto visible fuera de Administración", () => {
    const permitida = (ruta: string) =>
      PERMITIDAS.some((p) => ruta.replace(/\\/g, "/").includes(p));

    const culpables: string[] = [];
    for (const ruta of archivosTsx("src/features")) {
      if (permitida(ruta)) continue;
      const src = sinComentarios(readFileSync(ruta, "utf8"));
      // "migración 28", "migracion 49" — con o sin tilde, cualquier número.
      if (/migraci[oó]n\s+\d+/i.test(src)) culpables.push(ruta.replace(/\\/g, "/"));
    }

    expect(culpables, [
      "Estas pantallas le nombran un número de migración a quien las mira.",
      "Usá `textoNoHabilitado(...)` de src/lib/disponibilidad.ts, que dice qué pasa y a quién",
      "avisarle sin exponer el número. Si de verdad es una pantalla de administración,",
      "agregala a PERMITIDAS acá arriba con el motivo escrito al lado.",
    ].join(" ")).toEqual([]);
  });
});
