import type { Card, CardPeriodo } from "./types";
import { toARTDate } from "./metrics";

// Helpers PUROS de LECTURA para el modelo de períodos (propuesta de períodos, Fase 0 —
// ver docs/PROPUESTA-PERIODOS.md). No hacen fetch: la Fase 1 los va a consumir con los
// datos que ya trae la app (cards + card_periodos).
//
// Idea central (Alternativa C): `cards` es la DEFINICIÓN estable de la tarea (título,
// dueño, recurrencia, prioridad, esfuerzo, deps, categoría, etiquetas). El ESTADO de
// trabajo de cada mes (status/checklist/comments/history/tiempos) vive en su propia
// fila `card_periodos`. Estos helpers arman la "vista" de una card en un período
// combinando ambas cosas.
//
// DEFENSIVO: sin la migración 32 aplicada, `card_periodos` llega [] y todo cae al
// fallback (la card tal cual). Nunca lanza. La app funciona como hoy.

/** 'YYYY-MM' del mes de hoy en zona Argentina (ART). */
export function periodoVigente(hoyISO: string): string {
  return toARTDate(hoyISO).slice(0, 7);
}

/**
 * Vista de una card con el estado de su período. Si `cp` existe, el status/checklist/
 * comments/history/done_at/proc_at/due_date salen del período; si es null, la card tal
 * cual (fallback para períodos aún sin fila). Los campos de DEFINICIÓN (title, owner,
 * recur_rule, priority, effort, deps, categoria, etiquetas, ...) SIEMPRE de la card.
 */
export function mergeCardPeriodo(card: Card, cp: CardPeriodo | null): Card {
  if (!cp) return card;
  return {
    ...card,
    status: cp.status,
    checklist: cp.checklist ?? [],
    comments: cp.comments ?? [],
    history: cp.history ?? [],
    done_at: cp.done_at,
    proc_at: cp.proc_at,
    due_date: cp.due_date,
  };
}

/**
 * Board de un período: para cada card NO operativa, la mergea con su `card_periodos` de
 * ese período (o fallback a la card si no hay fila). Las cards operativas se devuelven
 * tal cual, sin tocar (no tienen instancia por período).
 */
export function cardsDelPeriodo(cards: Card[], periodos: CardPeriodo[], periodo: string): Card[] {
  if (!Array.isArray(cards)) return [];
  const porCard = new Map<string, CardPeriodo>();
  if (Array.isArray(periodos)) {
    for (const p of periodos) {
      if (p?.periodo === periodo && p?.card_id) porCard.set(p.card_id, p);
    }
  }
  return cards.map((c) =>
    c.card_type === "operativa" ? c : mergeCardPeriodo(c, porCard.get(c.id) ?? null),
  );
}

/**
 * Períodos ofrecibles en el selector: los que tienen datos en `card_periodos` más el
 * vigente, únicos y en orden descendente (el más reciente primero). Con `card_periodos`
 * vacío devuelve al menos el vigente, para que el selector nunca quede sin opciones.
 */
export function periodosDisponibles(periodos: CardPeriodo[], hoyISO: string): string[] {
  const set = new Set<string>();
  set.add(periodoVigente(hoyISO));
  if (Array.isArray(periodos)) {
    for (const p of periodos) {
      if (p?.periodo && /^\d{4}-\d{2}$/.test(p.periodo)) set.add(p.periodo);
    }
  }
  return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}
