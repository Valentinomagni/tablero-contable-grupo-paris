import type { Card } from "./types";
import { toARTDate } from "./metrics";

// Qué conviene hacer primero, con criterio ESCRITO y configurable.
//
// EL PROBLEMA. Hoy cada tarea tiene prioridad y esfuerzo, pero el criterio de qué va primero
// vive en la cabeza de cada uno. Dos personas con el mismo tablero lo ordenan distinto, y
// cuando alguien cubre a otro no sabe por dónde empezar.
//
// LA DECISIÓN DE DISEÑO. El puntaje se acompaña SIEMPRE de sus motivos en texto
// (`porQueVaPrimero`). Un número que ordena sin explicar por qué se ignora la segunda vez que
// se equivoca — y con razón. El motor de recomendaciones del Director sigue el mismo criterio.
//
// PURO: `hoyISO` entra por parámetro.

export interface PesosPrioridad {
  /** Cuánto pesa que esté vencida o por vencer. */
  vencimiento: number;
  /** Cuánto pesa la prioridad declarada. */
  prioridad: number;
  /** Cuánto pesa que sea rápida de sacar. */
  esfuerzo: number;
  /** Cuánto pesa que otras tareas la estén esperando. */
  bloquea: number;
}

/**
 * Los pesos por defecto. El vencimiento manda porque es lo único con consecuencia externa: una
 * DDJJ fuera de término tiene multa; una tarea "importante" que se hace mañana, no.
 */
export const PESOS_POR_DEFECTO: PesosPrioridad = {
  vencimiento: 40,
  prioridad: 25,
  bloquea: 25,
  esfuerzo: 10,
};

const PESO_PRIORIDAD: Record<string, number> = { alta: 1, media: 0.5, baja: 0 };

/** Días hasta el vencimiento. `null` si no tiene o no se puede leer. */
function diasParaVencer(c: Card, hoyISO: string): number | null {
  if (!c?.due_date || typeof c.due_date !== "string") return null;
  const hoy = Date.parse(toARTDate(hoyISO) + "T00:00:00Z");
  const vence = Date.parse(c.due_date + "T00:00:00Z");
  if (!isFinite(hoy) || !isFinite(vence)) return null;
  return Math.round((vence - hoy) / 86400000);
}

/** Cuántas tareas sin terminar dependen de ésta. */
function cuantasEsperan(c: Card, todas: Card[]): number {
  if (!Array.isArray(todas) || !c?.id) return 0;
  return todas.filter((x) => x && x.status !== "term" && (x.deps ?? []).includes(c.id)).length;
}

/** Más alto = va antes. Nunca NaN. */
export function puntajeDeOrden(c: Card, todas: Card[], pesos: PesosPrioridad, hoyISO: string): number {
  if (!c) return 0;
  const p = pesos ?? PESOS_POR_DEFECTO;

  // Vencimiento: 1 si está vencida, y baja suavemente hasta 0 a los 30 días.
  const d = diasParaVencer(c, hoyISO);
  const fVenc = d === null ? 0 : d < 0 ? 1 : Math.max(0, 1 - d / 30);

  const fPrio = PESO_PRIORIDAD[c.priority] ?? 0.5;

  // Esfuerzo invertido: lo rápido suma. Sacar lo corto libera la lista y da aire.
  const esf = Number(c.effort);
  const fEsf = Number.isFinite(esf) && esf > 0 ? 1 / esf : 1;

  // Bloqueo: satura a las 3 tareas esperando. Más allá de eso ya es "urgente" igual.
  const fBloq = Math.min(1, cuantasEsperan(c, todas) / 3);

  const total = fVenc * (p.vencimiento ?? 0) + fPrio * (p.prioridad ?? 0)
    + fEsf * (p.esfuerzo ?? 0) + fBloq * (p.bloquea ?? 0);
  return Number.isFinite(total) ? Math.round(total * 100) / 100 : 0;
}

/** Los motivos, en lenguaje de usuario. Vacío si no hay nada para destacar. */
export function porQueVaPrimero(c: Card, todas: Card[], pesos: PesosPrioridad, hoyISO: string): string[] {
  if (!c) return [];
  const out: string[] = [];
  const d = diasParaVencer(c, hoyISO);
  if (d !== null && d < 0) out.push("Está vencida");
  else if (d !== null && d <= 3) out.push(d === 0 ? "Vence hoy" : `Vence en ${d} día${d === 1 ? "" : "s"}`);

  if (c.priority === "alta") out.push("Prioridad alta");

  const esperan = cuantasEsperan(c, todas);
  if (esperan > 0) out.push(`${esperan} tarea${esperan === 1 ? "" : "s"} espera${esperan === 1 ? "" : "n"} por ésta`);

  const esf = Number(c.effort);
  if (Number.isFinite(esf) && esf === 1 && (pesos ?? PESOS_POR_DEFECTO).esfuerzo > 0) out.push("Es rápida de sacar");

  return out;
}
