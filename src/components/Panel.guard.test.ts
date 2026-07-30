/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// La primera línea no se puede borrar: `tsconfig.app.json` fija `"types": ["vite/client"]`,
// así que sin ella `tsc` corta con TS2591 en el import de `node:fs`. Mismo motivo que en
// `src/lib/tipografia.guard.test.ts`.
//
// GUARDIÁN. `Panel` ya existía y se usaba en 2 archivos mientras otros tenían la misma tarjeta
// copiada a mano. Así es como se deshace un sistema de diseño: nadie decide cambiarlo,
// simplemente cada copia se va separando un poco. Este test hace que la próxima copia a mano
// no compile en verde.
//
// POR QUÉ ES ANGOSTO — y esto es a propósito, no una omisión:
//
// Al medirlo, sólo 17 de las 41 superficies con `rounded-2xl` del proyecto son la tarjeta
// canónica (`bg-surface` + `p-[18px]`), la única que `Panel` reproduce exactamente y de la que
// `Panel.test.tsx` prueba que la migración es visualmente neutra. Las otras 24 son 4 o 5
// superficies genuinamente distintas: fichas de estadística con `p-4`, bloques con `p-5`,
// `p-8` o `px-5 py-4`, y shells con `overflow-hidden` sin padding propio porque el padding lo
// ponen los hijos. Meterlas a la fuerza en `Panel` sería un cambio visual que no se puede
// verificar sin mirar la pantalla, así que este test NO las persigue.
//
// Ensancharlo requiere primero decidir qué variantes nuevas merece `Panel` (mirando la
// pantalla, no el diff). Ver la sección "Hallazgo: Panel cubre el 40% de las superficies" en
// `docs/superpowers/plans/2026-07-29-solidez-y-sistema-visual.md`.
//
// La alternativa era un chequeo amplio con ~15 excepciones, y eso es peor que no tener
// guardián: aparenta una cobertura que no existe. Un guardián que declara su alcance es
// honesto; uno que finge cubrir todo, no.

/** Único archivo autorizado a definir el aspecto de una tarjeta. */
const EXCEPCIONES = ["Panel.tsx"];

/**
 * Escape POR LÍNEA, al estilo `eslint-disable-next-line`. Se pone en la línea marcada o en la
 * inmediatamente anterior, y **tiene que traer su motivo escrito al lado**.
 *
 * Por qué así y no una lista de archivos exentos: exentar un archivo entero deja pasar
 * cualquier copia futura dentro de él, y esconde la razón en un array que nadie va a leer.
 * Con el marcador, la excepción está a la vista justo donde está el código que la necesita.
 *
 * REGLA: si algún día hay varios marcadores, eso NO significa agregar más marcadores —
 * significa que a `Panel` le falta una variante. Un escape con nombre y motivo es honesto;
 * el problema son los escapes anónimos y los que se multiplican.
 */
const MARCADOR = "panel-guard-ok";
/** Cuántas líneas hacia arriba se busca el marcador (el motivo suele ocupar varias). */
const VENTANA_MARCADOR = 8;

function archivosFuente(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) { out.push(...archivosFuente(ruta)); continue; }
    if (!/\.tsx$/.test(nombre) || /\.test\.tsx$/.test(nombre)) continue;
    if (EXCEPCIONES.includes(nombre)) continue;
    out.push(ruta);
  }
  return out;
}

describe("Panel es la única superficie de tarjeta", () => {
  it("nadie vuelve a dibujar la tarjeta canónica a mano", () => {
    const culpables: string[] = [];
    for (const ruta of archivosFuente("src")) {
      // La firma de la tarjeta canónica: fondo de superficie + el padding exacto de `Panel`.
      // Se pide `p-[18px]` y no `rounded-2xl` justamente para no barrer las otras superficies.
      const lineas = readFileSync(ruta, "utf8").split("\n");
      for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i];
        if (!/className=/.test(linea) || !/bg-surface\b/.test(linea) || !/p-\[18px\]/.test(linea)) continue;
        // El marcador vale en la línea misma o en las de arriba: en JSX el comentario va
        // arriba del elemento, y el motivo escrito casi siempre ocupa varias líneas. La
        // ventana es corta para que un marcador no cubra código lejano por accidente.
        const contexto = lineas.slice(Math.max(0, i - VENTANA_MARCADOR), i + 1).join("\n");
        if (contexto.includes(MARCADOR)) continue;
        culpables.push(`${ruta}:${i + 1}: ${linea.trim().slice(0, 90)}`);
      }
    }
    expect(culpables, `Usá <Panel> en vez de dibujar la tarjeta a mano:\n${culpables.join("\n")}`).toEqual([]);
  });

  // Este chequeo prohíbe la sombra INVÁLIDA, no la correcta. `--ring` es `var(--accent)`, un
  // color pelado (ver `src/index.css`), así que `box-shadow: var(--ring),var(--shadow)` es CSS
  // inválido y el navegador descarta la declaración entera: cinco pantallas —entre ellas el
  // tablero y el reporte— venían renderizando SIN NINGUNA sombra desde que se escribió, y
  // nadie lo notó en meses. Repetir la sombra correcta (`--ring-sh`) en un botón o en otro
  // elemento es legítimo y no se persigue acá; escribir la inválida, no.
  it("nadie usa --ring como si fuera una sombra", () => {
    const culpables: string[] = [];
    for (const ruta of archivosFuente("src")) {
      if (/var\(--ring\),\s*var\(--shadow\)/.test(readFileSync(ruta, "utf8"))) culpables.push(ruta);
    }
    expect(culpables, `--ring es un color, no una sombra: usá var(--ring-sh).\n${culpables.join("\n")}`).toEqual([]);
  });
});
