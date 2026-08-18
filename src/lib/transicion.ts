import type { Card, Status } from "./types";

// Las dos reglas de estado del tablero, en UN solo lugar.
//
// POR QUÉ ACÁ Y NO EN CADA PANTALLA. Hay SEIS caminos que ponen una tarea en "Terminado":
// arrastrarla, el selector del modal, el botón "Marcar terminada", completar el último ítem del
// checklist, el aviso de tarea estancada y el cierre rápido de Mi día. Antes sólo dos miraban el
// checklist. Un gate en un lugar es un gate en ninguno: alcanza con usar otro camino para
// saltearlo, y nadie lo hace a propósito — simplemente cierran desde donde les queda más cómodo.

/** Orden del tablero. `pend` -> `proc` -> `term`. */
const ORDEN: Record<Status, number> = { pend: 0, proc: 1, term: 2 };

function items(c: Card): { done?: boolean }[] {
  return Array.isArray(c?.checklist) ? c.checklist : [];
}

/**
 * ¿Cuántos pasos del checklist faltan? `0` si no hay checklist o está completo.
 */
export function pasosQueFaltan(c: Card): number {
  const lista = items(c);
  if (lista.length === 0) return 0;
  return lista.filter((i) => i?.done !== true).length;
}

/**
 * `null` si la tarea puede pasar a `hasta`; si no, el motivo en lenguaje de usuario.
 *
 * REGLA 1 — NO SE SALTA "EN PROCESO". Pasar de Pendiente a Terminado significa que la tarea
 * nunca estuvo en proceso, y ahí `proc_at` queda en null: el tiempo de ciclo del equipo se
 * calcula sobre una ficción y la tarea figura resuelta en cero horas. Además borra la única
 * señal de que alguien la estaba haciendo, que es lo que mira el resumen del jefe.
 *
 * REGLA 2 — EL CHECKLIST VA COMPLETO. Sin flag y sin excepciones: si alguien se tomó el trabajo
 * de escribir los pasos, es porque esos pasos hay que hacerlos. Antes esto dependía de
 * `exige_checklist`, que arranca en `false` y sólo se podía prender al crear la tarea — ninguna
 * tarea existente lo tenía, así que la regla no existía en la práctica.
 *
 * VOLVER ATRÁS NUNCA SE BLOQUEA. Reabrir es legítimo, ya queda registrado como reapertura y se
 * mide en el índice de retrabajo. Bloquearlo empujaría a crear una tarea nueva, y ahí se pierde
 * el rastro de que era la misma.
 */
export function bloqueoDeTransicion(c: Card, hasta: Status): string | null {
  if (!c || !hasta) return null;
  const desde = c.status;
  if (desde === hasta) return null;
  // Sólo se controla ir hacia adelante. Todo lo que retrocede pasa.
  if (ORDEN[hasta] < ORDEN[desde]) return null;

  if (hasta === "term" && desde === "pend") {
    return "Antes de terminarla, pasala a En proceso.";
  }

  if (hasta === "term") {
    const faltan = pasosQueFaltan(c);
    if (faltan === 1) return "Falta 1 paso del checklist.";
    if (faltan > 1) return `Faltan ${faltan} pasos del checklist.`;
  }

  return null;
}

/** Atajo para deshabilitar un botón de cerrar. */
export function puedeCerrar(c: Card): boolean {
  return bloqueoDeTransicion(c, "term") === null;
}
