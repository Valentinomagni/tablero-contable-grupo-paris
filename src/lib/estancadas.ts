import type { Card } from "./types";
import { esCobertura } from "./vacaciones";

/**
 * P1 — Confirmación de tarea estancada ("¿seguimos con esto?").
 *
 * Es la única señal del proyecto que corrige datos VIEJOS de forma retroactiva: rescata la
 * tarea que ya se hizo pero que nadie marcó terminada. Por eso vive en la vista PERSONAL
 * (Mi día): la misma pregunta en la vista del jefe deja de ser ayuda y pasa a ser control.
 *
 * La calibración de abajo NO es refinamiento. Mal calibrada, la pregunta aparece todos los
 * días, la gente aprende a apretar "sigo con esto" sin leer, y el dato queda igual de falso
 * que antes CON la molestia agregada (ver docs/PROPUESTAS-ADOPCION.md, sección 3(b)).
 */

// 5 días corridos desde la última señal. Umbral holgado a propósito: en contable hay
// conciliaciones y cierres que legítimamente duran una semana, y preguntar cada 48 h por
// algo que es largo por diseño se lee como desconfianza.
export const DIAS_PARA_PREGUNTAR = 5;

const DIA = 86400000;

export interface Estancada { card: Card; diasSinMover: number }

// Última señal de movimiento: última entrada de `history` por `at`; si no hay historial,
// `created_at`. Mismo criterio que `alertas.ts` — que la misma tarea se vea "quieta" en el
// resumen del jefe y en Mi día no puede depender de dos definiciones distintas.
function ultimaSenalMs(c: Card): number {
  const hist = Array.isArray(c.history) ? c.history : [];
  let ultima: string | null = null;
  for (const h of hist) {
    if (!h?.at) continue;
    if (ultima === null || h.at > ultima) ultima = h.at;
  }
  return new Date(ultima ?? c.created_at).getTime();
}

// Una tarea cubierta por vacaciones está en manos de otra persona: preguntarle al titular
// "¿seguís con esto?" mientras está de licencia es ruido puro. `esCobertura` (vacaciones.ts)
// es la ÚNICA fuente de verdad de esto: lee el historial y respeta la devolución al titular.
// No duplicar el criterio acá — si mañana cambia la convención, cambia en un solo lugar.
function cubierta(c: Card): boolean {
  return esCobertura(c).activa;
}

/**
 * Devuelve UNA sola tarea para preguntar (la más estancada), o `null`.
 *
 * Nunca una lista: preguntar por cinco cosas a la vez garantiza que se ignoren las cinco.
 *
 * @param cards  tareas de la persona (ya filtradas por owner por quien llama).
 * @param hoyISO fecha/hora de referencia en ISO.
 * @param pospuestas ids que la persona ya contestó "ahora no" — respetar el snooze es lo
 *   que separa un recordatorio de un acoso; sin él, se aprende a ignorar el aviso.
 */
export function tareaParaPreguntar(
  cards: Card[], hoyISO: string, pospuestas: string[],
): Estancada | null {
  // Defensiva: cualquier entrada rara (undefined mientras carga la query) no rompe Mi día.
  if (!Array.isArray(cards)) return null;
  const snooze = new Set(Array.isArray(pospuestas) ? pospuestas : []);
  const hoyMs = new Date(hoyISO).getTime();
  if (Number.isNaN(hoyMs)) return null;

  let mejor: Estancada | null = null;
  for (const c of cards) {
    if (!c) continue;
    if (snooze.has(c.id)) continue;              // ya dijo "ahora no": no se insiste.
    if (c.status === "term") continue;           // sólo tareas abiertas.
    if (c.card_type === "operativa") continue;   // las operativas son a demanda por diseño.
    if (cubierta(c)) continue;                   // cubierta por vacaciones: no está abandonada.

    const dias = Math.floor((hoyMs - ultimaSenalMs(c)) / DIA);
    if (!Number.isFinite(dias) || dias < DIAS_PARA_PREGUNTAR) continue;

    if (!mejor || dias > mejor.diasSinMover) mejor = { card: c, diasSinMover: dias };
  }
  return mejor;
}
