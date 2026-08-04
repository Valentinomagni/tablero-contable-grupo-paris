import type { HistoryEntry } from "./types";
import { toARTDate } from "./metrics";

// Historial POR PERÍODO.
//
// EL PROBLEMA QUE ATACA. `cards.history` acumula desde que la tarea existe. Al abrir una
// tarea recurrente en agosto se veían ocho entradas mezclando julio y agosto, y no había
// forma de responder la pregunta que importa: "¿qué se hizo con esto en julio?".
//
// La migración 32 creó `card_periodos.history` justamente para esto y quedó sin usar. Pero
// no hace falta migrar los datos viejos: cada entrada YA trae su fecha, así que el período
// se puede derivar. Esta lib hace eso — es un cambio de lectura, no de escritura, y por lo
// tanto no puede perder nada.
//
// PURA: sin red, sin `new Date()` de "ahora" adentro.

/** El mes 'YYYY-MM' al que pertenece una marca de tiempo, en hora argentina. */
function periodoDe(at: string): string | null {
  if (typeof at !== "string" || !at) return null;
  const d = new Date(at);
  if (!isFinite(d.getTime())) return null;
  // `toARTDate` y no `slice(0,7)` del ISO: una entrada del 31/07 a las 22 hora argentina es
  // de julio, aunque en UTC ya sea el 1 de agosto. Un movimiento de fin de mes contado en el
  // mes siguiente ensucia justo el período que se está revisando.
  return toARTDate(at).slice(0, 7);
}

/**
 * ¿Esta entrada la escribió el reinicio mensual y no una persona?
 *
 * Importa porque en la captura que originó este trabajo aparecían "Marcó terminada" y
 * "Reabrió la tarea" en el MISMO minuto. Eso no es trabajo de nadie: es el reinicio dejando
 * rastro. Mezclado con el historial real hace que parezca que alguien hizo algo raro.
 *
 * No se BORRA —el rastro del reinicio es información legítima— pero se puede distinguir para
 * mostrarlo aparte y que no se confunda con lo que hizo una persona.
 */
export function esRuidoDeReinicio(entrada: HistoryEntry): boolean {
  if (!entrada || typeof entrada.txt !== "string") return false;
  return entrada.who === "Sistema" && /reinicio mensual/i.test(entrada.txt);
}

/** Las entradas de ese mes, de la más reciente a la más vieja. */
export function historialDePeriodo(historial: HistoryEntry[], periodo: string): HistoryEntry[] {
  if (!Array.isArray(historial)) return [];
  return historial
    .filter((e) => e && periodoDe(e.at) === periodo)
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}

/** Los meses que tienen algún movimiento, del más nuevo al más viejo. */
export function periodosConHistorial(historial: HistoryEntry[]): string[] {
  if (!Array.isArray(historial)) return [];
  const meses = new Set<string>();
  for (const e of historial) {
    const p = e && periodoDe(e.at);
    if (p) meses.add(p);
  }
  return [...meses].sort((a, b) => b.localeCompare(a));
}
