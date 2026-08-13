import type { TaskOccurrence } from "./types";

// El avance del arqueo del mes: "6 de 24".
//
// EL PROBLEMA QUE RESUELVE, como lo reportó Patricia: el tablero genera una tarea por cada día
// hábil y la lista es interminable. Una persona con arqueo diario abre su tablero y ve veinte
// tarjetas idénticas donde debería ver una cosa: cómo viene el mes.
//
// LO QUE YA EXISTÍA, Y POR ESO ESTO ES CHICO. `task_occurrences` guarda una fila por (tarea, día)
// desde la migración 23, y la 34 le dio checklist propio a cada día. El dato por día ya estaba
// bien guardado. Lo único que faltaba era **mostrarlo junto**: una tarjeta madre con la barra de
// avance, y los días adentro.
//
// PURA: las ocurrencias y la lista de días hábiles entran por parámetro. La lista sale de
// `habilesDelMes` en `dias-habiles.ts`, que es la que sabe de feriados.

/**
 * Cuántos días del mes se arquearon, sobre cuántos había que arquear.
 *
 * EL DENOMINADOR SON LOS DÍAS HÁBILES, no los días del mes. Eso es lo que pidió Patricia
 * textualmente ("ej. 24 días hábiles") y es lo único que da un número que significa algo: sobre
 * 31 el avance nunca llegaría al 100% aunque se trabajara todos los días.
 *
 * Ante cualquier dato roto devuelve ceros en vez de tirar. Que una fila mal formada tumbe el
 * tablero de alguien es mucho peor que mostrar un cero que se nota y se pregunta.
 */
export function avanceDelMes(
  occs: TaskOccurrence[],
  habiles: string[],
): { hechos: number; total: number; pct: number } {
  const dias = Array.isArray(habiles) ? habiles : [];
  const total = dias.length;
  if (total === 0) return { hechos: 0, total: 0, pct: 0 };

  const esHabil = new Set(dias);
  // Un Set y no un contador: esta función puede recibir las ocurrencias de VARIAS tarjetas de
  // arqueo (por ejemplo, dos cajas distintas). Sin deduplicar por fecha, un mismo día contaría
  // dos veces y el avance pasaría del 100%.
  const hechas = new Set<string>();
  for (const o of Array.isArray(occs) ? occs : []) {
    if (!o || o.done !== true || typeof o.fecha !== "string") continue;
    // Un arqueo cargado un domingo no suma: ese día no estaba en la cuenta.
    if (esHabil.has(o.fecha)) hechas.add(o.fecha);
  }

  const hechos = hechas.size;
  // Redondear y no truncar: 2 de 3 es 66,67 y truncando daría 66. Con truncado, un mes con todo
  // hecho podría mostrar 99 y alguien iría a buscar el día que falta.
  return { hechos, total, pct: Math.round((hechos / total) * 100) };
}
