import type { Card } from "./types";
import { claveDeNombre } from "./catalogo";

// Cuánto del trabajo del mes sale del catálogo, y qué títulos deberían estar en él.
//
// EL PROBLEMA, con las palabras del dueño: "Juan hace las conciliaciones de Chevrolet, pero su
// descripción no es como la de Valentino. Si son las mismas tareas, diferente empresa o marca,
// deberíamos tenerlo igual para que mi jefe pueda comparar y además para que nos sirva de dato
// general."
//
// El catálogo (migración 55) da la herramienta. Esto responde la pregunta que sigue: **¿se está
// usando, y qué falta meterle?**
//
// ── LA REGLA QUE MÁS CUIDADO NECESITA ACÁ ────────────────────────────────────────
//
// El dato va POR TÍTULO REPETIDO, NUNCA POR PERSONA.
//
// "Juan tiene 8 tareas sin estandarizar" es un ranking encubierto: convierte un problema de
// proceso en una lista de responsables, y el equipo lo lee así aunque nadie lo diga. "Hay 6
// tareas llamadas 'Conciliación' que no salen del catálogo" describe exactamente el mismo hecho
// y no acusa a nadie — además de ser más útil, porque dice qué definición falta escribir.
//
// Hay un test que verifica que la salida no contenga ids ni nombres de persona.
//
// ── POR QUÉ SE AGRUPA NORMALIZANDO ───────────────────────────────────────────────
//
// Con `claveDeNombre` —sin mayúsculas, sin acentos, sin espacios de sobra—, que es la misma
// función con la que el catálogo decide si dos definiciones son la misma. Si acá se agrupara con
// otro criterio, el informe marcaría como repetido algo que el catálogo dejó entrar como único, y
// las dos pantallas se contradirían.
//
// Y sin normalizar no serviría para nada: "Conciliación" y "conciliacion " son el caso típico de
// una oficina donde media gente escribe con acento y la otra mitad no. Justo lo que hay que
// encontrar.

export interface CoberturaEstandar {
  /** Tareas del mes que salieron del catálogo. */
  conEstandar: number;
  /** Total de tareas del mes que se miraron. */
  total: number;
  /** 0-100. `0` si no hay tareas, para no dividir por cero. */
  pct: number;
  /** Títulos repetidos SIN vínculo al catálogo, del más repetido al menos. */
  candidatas: { titulo: string; veces: number }[];
}

/** Desde cuántas repeticiones un título vale la pena estandarizar. */
const MINIMO_REPETIDO = 2;

/** Cuántas candidatas se listan. Más que esto deja de ser una sugerencia y pasa a ser un informe. */
const MAX_CANDIDATAS = 8;

/**
 * `cards` tiene que venir YA ACOTADO al mes (usar `cardsDelMes` de `analisis.ts`): esta función
 * no filtra por fecha a propósito, para no tener dos criterios de "del mes" que puedan divergir —
 * que es exactamente el hallazgo 2 de la auditoría del 05/08.
 *
 * Las operativas quedan afuera: son a demanda y de volumen alto, así que inflarían el
 * denominador y taparían el dato real.
 */
export function coberturaEstandar(cards: Card[]): CoberturaEstandar {
  const vacio: CoberturaEstandar = { conEstandar: 0, total: 0, pct: 0, candidatas: [] };
  if (!Array.isArray(cards)) return vacio;

  const vivas = cards.filter((c) => c && c.card_type !== "operativa");
  if (vivas.length === 0) return vacio;

  const conEstandar = vivas.filter((c) => !!c.estandar_id).length;

  // Los títulos sin vínculo, agrupados por su clave normalizada. Se guarda además el título tal
  // como lo escribió la primera persona: mostrar la clave ("conciliacion bancaria", sin acento y
  // en minúscula) se leería como un error de la app.
  const grupos = new Map<string, { titulo: string; veces: number }>();
  for (const c of vivas) {
    if (c.estandar_id) continue;
    const clave = claveDeNombre(c.title ?? "");
    if (!clave) continue;
    const previo = grupos.get(clave);
    if (previo) previo.veces += 1;
    else grupos.set(clave, { titulo: (c.title ?? "").trim(), veces: 1 });
  }

  const candidatas = [...grupos.values()]
    .filter((g) => g.veces >= MINIMO_REPETIDO)
    .sort((a, b) => b.veces - a.veces || a.titulo.localeCompare(b.titulo, "es"))
    .slice(0, MAX_CANDIDATAS);

  return {
    conEstandar,
    total: vivas.length,
    pct: Math.round((conEstandar / vivas.length) * 100),
    candidatas,
  };
}
