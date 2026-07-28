import type { Card } from "./types";

// Salud operativa: tres señales baratas que salen de una sola pasada sobre las cards.
//
// LO QUE MIDE, Y POR QUÉ ESTAS TRES:
//  - Espera hasta comenzar: NO cuánto tardó el trabajo, sino cuánto tardó en arrancar. Una
//    tarea que espera 7 días antes de que alguien la tome no es un problema de velocidad: es
//    un problema de asignación o de capacidad.
//  - Edad por estado: tareas que envejecen en una columna. Sirve para ver dónde se estanca el
//    flujo, no para apurar a nadie.
//  - Multitarea: cuántas tareas tiene abiertas cada persona a la vez. Demasiadas en paralelo
//    hacen que todo avance despacio; la lectura correcta es "hay que repartir", nunca
//    "esta persona no rinde".
//
// ENCUADRE: las tres describen el ESTADO DEL FLUJO. Los textos que las acompañen en la UI
// deben proponer repartir o desbloquear, jamás calificar a una persona.
//
// PURA: la fecha entra por `hoyISO`; sin `new Date()` adentro.

export interface SaludOperativa {
  /** Días promedio entre crear la tarea y empezarla. null si ninguna arrancó. */
  esperaPromedioDias: number | null;
  /** Días promedio que llevan abiertas las pendientes. null si no hay ninguna. */
  edadPend: number | null;
  /** Días promedio que llevan abiertas las que están en proceso. null si no hay ninguna. */
  edadProc: number | null;
  /** Tareas abiertas por persona, de mayor a menor. */
  multitarea: { owner: string; abiertas: number }[];
}

const DIA_MS = 86400000;

/** Promedio redondeado a 1 decimal; null si no hay muestra (null ≠ 0: "no hay" no es "cero"). */
function promedioDias(ms: number[]): number | null {
  if (ms.length === 0) return null;
  const media = ms.reduce((s, n) => s + n, 0) / ms.length / DIA_MS;
  return Math.round(media * 10) / 10;
}

export function saludOperativa(cards: Card[], hoyISO: string): SaludOperativa {
  const lista = Array.isArray(cards) ? cards : [];
  const ahora = new Date(hoyISO).getTime();

  const esperas: number[] = [];
  const edadesPend: number[] = [];
  const edadesProc: number[] = [];
  const abiertasPorOwner = new Map<string, number>();

  for (const c of lista) {
    if (!c) continue;

    // Espera hasta comenzar: sólo cuenta si efectivamente arrancó.
    if (c.proc_at && c.created_at) {
      const espera = new Date(c.proc_at).getTime() - new Date(c.created_at).getTime();
      if (isFinite(espera) && espera >= 0) esperas.push(espera);
    }

    if (c.status === "term") continue; // lo cerrado ya no envejece ni ocupa a nadie

    if (c.created_at) {
      const edad = ahora - new Date(c.created_at).getTime();
      if (isFinite(edad) && edad >= 0) {
        if (c.status === "pend") edadesPend.push(edad);
        else if (c.status === "proc") edadesProc.push(edad);
      }
    }

    if (c.owner) abiertasPorOwner.set(c.owner, (abiertasPorOwner.get(c.owner) ?? 0) + 1);
  }

  return {
    esperaPromedioDias: promedioDias(esperas),
    edadPend: promedioDias(edadesPend),
    edadProc: promedioDias(edadesProc),
    multitarea: [...abiertasPorOwner.entries()]
      .map(([owner, abiertas]) => ({ owner, abiertas }))
      .sort((a, b) => b.abiertas - a.abiertas || a.owner.localeCompare(b.owner)),
  };
}
