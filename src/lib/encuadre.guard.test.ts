/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// La primera línea no se puede borrar: `tsconfig.app.json` fija `"types": ["vite/client"]`,
// así que sin ella `tsc` corta con TS2591 en el import de `node:fs`.
//
// ============================================================
// GUARDIÁN DEL ENCUADRE NO PUNITIVO
//
// La regla más dura del proyecto: las métricas describen situaciones y procesos, NUNCA juzgan
// personas. No hay podios, ni puestos, ni comparaciones entre gente.
//
// POR QUÉ EXISTE ESTE ARCHIVO. Durante meses se afirmó que esta regla estaba "verificada por
// tests". Era falso: los tests verificaban las libs de cálculo, no los textos de la interfaz.
// Mientras tanto, el Reporte tenía un panel llamado "Ranking de productividad" que ordenaba a
// las personas de mayor a menor y les ponía el número de puesto al lado — y se exportaba al
// PDF. Peor: el panel de al lado aclaraba "no mide productividad individual", así que la misma
// pantalla se contradecía a sí misma. Lo encontró una auditoría, no un test.
//
// Una regla que nadie verifica no es una regla, es una intención. Esto la verifica.
//
// POR QUÉ ES ANGOSTO. No se puede detectar "esto juzga a una persona" leyendo texto: haría
// falta entender el sentido. Lo que sí se puede es prohibir las pocas palabras que en ESTE
// proyecto no pueden significar otra cosa que un podio. Es una red de agujeros grandes que
// igual habría atajado el caso real, y eso ya la justifica.
//
// Lo que este test NO puede ver, y por lo tanto sigue siendo responsabilidad de quien escribe:
// ordenar personas de mayor a menor sin decir "ranking", poner un número de puesto sin
// nombrarlo, o comparar a alguien contra un promedio. Si estás haciendo eso, el test va a
// pasar y la regla igual está rota.
// ============================================================

/**
 * Palabras que en este proyecto sólo pueden significar un podio.
 *
 * "productividad" no está en la lista: aparece legítimamente en la aclaración "no mide
 * productividad individual", que es justamente la que hay que fomentar.
 */
const PROHIBIDAS = [
  /\branking\b/i,
  /\bpodio\b/i,
  /\bmás productiv[oa]s?\b/i,
  /\bmenos productiv[oa]s?\b/i,
  /\bmejor desempeñ[oa]\b/i,
  /\bpeor desempeñ[oa]\b/i,
  /\bmejor rendimiento\b/i,
  /\bpeor rendimiento\b/i,
  /\bel mejor del equipo\b/i,
];

/** Escape por línea, con el motivo escrito al lado. Igual criterio que `panel-guard-ok`. */
const MARCADOR = "encuadre-ok";
const VENTANA_MARCADOR = 8;

/**
 * Los COMENTARIOS quedan fuera, y es la decisión central de este archivo.
 *
 * La primera versión miraba el archivo crudo y encontró trece "culpables" — todos comentarios
 * que explicaban *por qué* ahí no hay ranking, del tipo "esta vista es carga de trabajo, no
 * ranking". Es decir: el guardián castigaba justamente la conducta que quiere fomentar.
 *
 * Un guardián que da falsos positivos se termina borrando, y ahí se pierde la protección
 * entera. Así que se scanean sólo las partes que puede ver un usuario. Los comentarios se
 * reemplazan por espacios en vez de borrarse, para que los números de línea sigan sirviendo
 * al reportar.
 *
 * Efecto colateral aceptado: esto también corta lo que venga después de un `//` dentro de un
 * texto (una URL, por ejemplo). El riesgo es dejar pasar algo, no acusar de más — y para un
 * guardián de este tipo ése es el lado correcto para equivocarse.
 */
function sinComentarios(texto: string): string {
  const aEspacios = (m: string) => m.replace(/[^\n]/g, " ");
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, aEspacios)  // bloques /* */ y {/* */} de JSX
    .replace(/\/\/[^\n]*/g, aEspacios);       // línea //
}

/** Este archivo se exenta solo: la lista de palabras prohibidas contiene las palabras. */
const EXCEPCIONES: string[] = ["encuadre.guard.test.ts"];

function archivosFuente(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) { out.push(...archivosFuente(ruta)); continue; }
    if (!/\.tsx?$/.test(nombre)) continue;
    // Los tests nombran lo prohibido para verificar que NO aparece: revisarlos es al revés.
    if (/\.test\.tsx?$/.test(nombre)) continue;
    if (EXCEPCIONES.includes(nombre)) continue;
    out.push(ruta);
  }
  return out;
}

describe("encuadre no punitivo", () => {
  // 30 segundos, no los 5 que da vitest por defecto. Este test no calcula nada: LEE TODO
  // `src` de disco, y eso crece con el proyecto y depende de cuán cargada esté la máquina.
  // Con la máquina ocupada se pasó de 5 s y salió en rojo sin que hubiera ninguna violación.
  //
  // Un guardián que falla al azar es peor que no tenerlo: la primera vez se investiga, la
  // segunda se ignora, y la tercera alguien lo borra por molesto — y ahí se pierde la
  // protección de verdad. El tiempo holgado es lo que lo mantiene creíble.
  it("ninguna pantalla arma un podio de personas", { timeout: 30_000 }, () => {
    const culpables: string[] = [];
    for (const ruta of archivosFuente("src")) {
      // DOS versiones del mismo archivo, y hacen falta las dos:
      //   - `visibles` (sin comentarios) es donde se buscan las palabras prohibidas.
      //   - `crudas` (con comentarios) es donde se busca el marcador, porque el marcador VIVE
      //     dentro de un comentario. Buscarlo en la versión limpia no lo encuentra nunca:
      //     así fue como este mismo test se rechazó una excepción legítima que ya estaba
      //     puesta, y por eso vale escribirlo.
      const crudas = readFileSync(ruta, "utf8").split("\n");
      const visibles = sinComentarios(crudas.join("\n")).split("\n");
      for (let i = 0; i < visibles.length; i++) {
        const rota = PROHIBIDAS.find((re) => re.test(visibles[i]));
        if (!rota) continue;
        const contexto = crudas.slice(Math.max(0, i - VENTANA_MARCADOR), i + 1).join("\n");
        if (contexto.includes(MARCADOR)) continue;
        culpables.push(`${ruta}:${i + 1}: ${visibles[i].trim().slice(0, 100)}`);
      }
    }
    expect(
      culpables,
      "Las métricas describen situaciones, no juzgan personas. Si el texto es una aclaración " +
      "legítima (del tipo \"esto no es un ranking\"), marcá la línea con `encuadre-ok` y el " +
      "motivo al lado.\n" + culpables.join("\n"),
    ).toEqual([]);
  });
});
