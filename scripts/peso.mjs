#!/usr/bin/env node
// Presupuesto de peso del arranque, verificado en cada push.
//
// POR QUÉ. Vite avisa "some chunks are larger than 500 kB" y ese aviso se viene ignorando
// hace meses. Un aviso que nadie mira no existe. Esto falla el CI, que sí se mira.
//
// Se mide SÓLO lo que se baja al abrir la app: el chunk de entrada, el CSS y los vendor que
// no son diferidos. Lo que se carga a demanda (xlsx al exportar, cada vista con su chunk) no
// cuenta, porque no lo paga quien sólo abre el tablero.

import { readdirSync, statSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

/** Techo del arranque, en kB comprimidos. */
const PRESUPUESTO_KB = 240;

/** Lo que se baja siempre al abrir. Todo lo demás es a demanda y no cuenta. */
const ES_DE_ARRANQUE = (n) => /^(index|vendor-)/.test(n);

const dir = "dist/assets";
let entradas;
try {
  entradas = readdirSync(dir);
} catch {
  console.error(`No existe ${dir}. Corré el build antes de medir.`);
  process.exitCode = 1;
  entradas = [];
}

let total = 0;
const filas = [];
for (const nombre of entradas) {
  if (!/\.(js|css)$/.test(nombre)) continue;
  if (!ES_DE_ARRANQUE(nombre)) continue;
  const ruta = join(dir, nombre);
  if (!statSync(ruta).isFile()) continue;
  const kb = gzipSync(readFileSync(ruta)).length / 1024;
  total += kb;
  filas.push({ nombre, kb });
}

filas.sort((a, b) => b.kb - a.kb);
for (const f of filas) console.log(`${f.kb.toFixed(1).padStart(7)} kB  ${f.nombre}`);
console.log(`${total.toFixed(1).padStart(7)} kB  TOTAL de arranque (comprimido)`);
console.log(`${String(PRESUPUESTO_KB).padStart(7)} kB  presupuesto`);

if (total > PRESUPUESTO_KB) {
  console.error(
    `\nEl arranque se pasó por ${(total - PRESUPUESTO_KB).toFixed(1)} kB.\n` +
    `Antes de subir el presupuesto, mirá si lo que engordó puede cargarse a demanda:\n` +
    `una vista con lazy(), o un import dinámico como el de xlsx en lib/excel.ts.`,
  );
  process.exitCode = 1;
} else {
  console.log(`\nEntra, con ${(PRESUPUESTO_KB - total).toFixed(1)} kB de margen.`);
}
