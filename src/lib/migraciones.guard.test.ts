/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { MIGRACIONES_ESPERADAS } from "./migraciones";

// La primera línea no se puede borrar: `tsconfig.app.json` fija `"types": ["vite/client"]`,
// así que sin ella `tsc` corta con TS2591 en el import de `node:fs`.
//
// ============================================================
// GUARDIÁN DEL CHIP DE MIGRACIONES
//
// POR QUÉ EXISTE. `MIGRACIONES_ESPERADAS` se quedó en la 28 mientras se escribían nueve
// migraciones más (29 a 37). El chip de Admin, que es el único aviso de "te falta correr algo
// en la base", mostraba el escudo verde y "Base de datos al día" sin haber mirado ninguna de
// esas nueve. Entre ellas está la 35, que es la que cierra la escalada de privilegios.
//
// Es la peor clase de defecto: no rompe nada, no da error, y justamente por eso puede quedarse
// años. Un indicador de seguridad que sólo sabe decir que sí es peor que no tener indicador,
// porque ocupa el lugar donde uno iría a mirar.
//
// POR QUÉ EL TEST QUE HABÍA NO PODÍA AGARRARLO. `migraciones.test.ts` prueba la función con
// `MIGRACIONES_ESPERADAS` como entrada: `estadoMigraciones(MIGRACIONES_ESPERADAS)` da ok por
// construcción, diga lo que diga la lista. Verificaba la aritmética, no el dato. Este guardián
// compara contra el disco, que es la única fuente que no puede mentir: los archivos .sql que
// están en el repo son las migraciones que existen.
//
// CÓMO SE ARREGLA CUANDO FALLA. Escribiste una migración nueva: agregá su número a la lista de
// `migraciones.ts` y asegurate de que el .sql se registre solo en `schema_migrations` (mirá el
// final de cualquier migración de la 29 en adelante). Si no se registra, el chip la va a dar
// por faltante para siempre — y una alarma que no se puede apagar se termina ignorando.
// ============================================================

/** Los números de migración que existen como archivo en el repo. */
function migracionesEnDisco(): number[] {
  const nums = new Set<number>();
  for (const nombre of readdirSync(".")) {
    // `migraciones-pendientes.sql` NO entra: es un compilado de otras, no una migración con
    // número propio. El patrón pide `migracion-<n>-`, que es como se nombran las de verdad.
    const m = /^migracion-(\d+)-.*\.sql$/.exec(nombre);
    if (m) nums.add(Number(m[1]));
  }
  // La 14 tiene dos archivos (`-jerarquia` y `-FIX-URGENTE-recursion`): es un número, no dos.
  return [...nums].sort((a, b) => a - b);
}

describe("el chip de migraciones no puede quedarse viejo", () => {
  it("la lista esperada cubre todas las migraciones que existen en el repo", () => {
    const enDisco = migracionesEnDisco();
    const enLista = new Set(MIGRACIONES_ESPERADAS);
    const sinVigilar = enDisco.filter((n) => !enLista.has(n));

    expect(
      sinVigilar,
      "Estas migraciones existen como archivo pero el chip de Admin no las mira, así que va a " +
      "decir \"Base de datos al día\" aunque falten. Agregalas a MIGRACIONES_ESPERADAS en " +
      "src/lib/migraciones.ts:\n" + sinVigilar.join(", "),
    ).toEqual([]);
  });

  it("la lista esperada no inventa migraciones que no existen", () => {
    const enDisco = new Set(migracionesEnDisco());
    const fantasmas = MIGRACIONES_ESPERADAS.filter((n) => !enDisco.has(n));

    // El daño acá es el inverso y también es grave: el chip pediría correr una migración que
    // no existe, y eso no se puede satisfacer. Una alarma imposible de apagar se ignora, y la
    // próxima vez que sea real tampoco se le va a creer.
    expect(
      fantasmas,
      "MIGRACIONES_ESPERADAS nombra migraciones sin archivo en el repo: " + fantasmas.join(", "),
    ).toEqual([]);
  });

  it("toda migración vigilada se registra sola en schema_migrations", () => {
    const mudas: string[] = [];
    for (const nombre of readdirSync(".")) {
      const m = /^migracion-(\d+)-.*\.sql$/.exec(nombre);
      if (!m) continue;
      const numero = Number(m[1]);
      if (!MIGRACIONES_ESPERADAS.includes(numero)) continue;
      // La 13 a la 25 no se registran solas y está bien: las da de alta el backfill de la 28,
      // que se escribió justamente para eso. De la 26 en adelante, cada una se anota sola.
      if (numero <= 25) continue;
      const sql = readFileSync(nombre, "utf8");
      if (!/insert\s+into\s+public\.schema_migrations/i.test(sql)) mudas.push(nombre);
    }

    expect(
      mudas,
      "Estas migraciones no se anotan en schema_migrations, así que el chip las va a dar por " +
      "faltantes aunque se corran — una alarma que no se puede apagar. Agregales el insert " +
      "del final (copiá el de cualquier migración de la 29 en adelante):\n" + mudas.join("\n"),
    ).toEqual([]);
  });
});
