import type { Card, ChecklistItem, Comment, HistoryEntry, Status } from "./types";
import { tienePeriodos } from "./esquema";

// Helpers PUROS de ESCRITURA para el modelo de períodos (propuesta de períodos, Fase 2 —
// ver docs/PROPUESTA-PERIODOS.md). Deciden A DÓNDE va cada parte de un patch y arman la
// fila para `card_periodos`. No hacen fetch ni tocan react-query: eso vive en el hook
// useEscribirPeriodo (src/hooks/useData.ts).
//
// ENFOQUE CONSERVADOR (decisión del propietario, Fase 2): el mes VIGENTE sigue escribiendo
// en `cards` EXACTAMENTE como hasta ahora — cero cambio en el reset mensual (migración 24),
// el análisis del mes, las notificaciones de finalización o la sincronización de tareas
// compartidas. Sólo los meses ADELANTADOS (p.ej. agosto trabajado en julio) se guardan
// aparte, en `card_periodos`, como estado independiente. El jubilar el reset viejo y
// repuntar el análisis quedan para una Fase 2b.

/**
 * Los 7 campos de ESTADO de trabajo. Viven en `card_periodos` por mes; todo lo demás de
 * `Card` es DEFINICIÓN estable (title, priority, effort, deps, categoria, etiquetas,
 * recur_rule, description, ...) y vive en `cards`. Debe coincidir con lo que lee
 * mergeCardPeriodo() en periodo-instancias.ts.
 */
export const CAMPOS_ESTADO = [
  "status", "checklist", "comments", "history", "done_at", "proc_at", "due_date",
] as const;

/** Sólo la parte de estado que puede llevar un patch (las 7 claves de CAMPOS_ESTADO). */
export type EstadoPatch = Partial<Pick<Card, (typeof CAMPOS_ESTADO)[number]>>;

/** Fila lista para upsert en `card_periodos` (onConflict card_id,periodo). */
export interface FilaPeriodo {
  card_id: string; owner: string; periodo: string; status: Status;
  checklist: ChecklistItem[]; comments: Comment[]; history: HistoryEntry[];
  done_at: string | null; proc_at: string | null; due_date: string | null;
}

/**
 * ¿Este patch debe escribirse en `card_periodos` en vez de en `cards`? Sí sólo cuando:
 * la migración 32 está aplicada, el período elegido NO es el vigente, y la card no es
 * operativa. En cualquier otro caso se escribe en `cards` como siempre (gate seguro:
 * ante la duda, comportamiento de hoy).
 */
export function escribeEnPeriodo(
  migracionesAplicadas: number[] | null | undefined,
  periodoSel: string,
  vigente: string,
  cardType: Card["card_type"],
): boolean {
  if (!tienePeriodos(migracionesAplicadas)) return false;
  if (cardType === "operativa") return false;
  return periodoSel !== vigente;
}

/** Quita del patch los campos de estado; deja sólo los de definición (los que van a `cards`). */
export function soloDefinicion(patch: Partial<Card>): Partial<Card> {
  const out = { ...patch } as Record<string, unknown>;
  for (const k of CAMPOS_ESTADO) delete out[k];
  return out as Partial<Card>;
}

/**
 * Fila para upsert en `card_periodos`: parte del ESTADO ACTUAL de la card (que ya viene
 * mergeada con su período, ver cardsDelPeriodo) y le aplica encima el patch de estado.
 * Incluye SIEMPRE los 7 campos (upsert idempotente, sin `undefined`) y nunca arrastra
 * campos de definición del patch.
 */
export function filaPeriodo(card: Card, periodo: string, patch: Partial<Card>): FilaPeriodo {
  const p = patch as EstadoPatch;
  return {
    card_id: card.id,
    owner: card.owner,
    periodo,
    status: p.status ?? card.status,
    checklist: p.checklist ?? card.checklist ?? [],
    comments: p.comments ?? card.comments ?? [],
    history: p.history ?? card.history ?? [],
    done_at: p.done_at !== undefined ? p.done_at : card.done_at,
    proc_at: p.proc_at !== undefined ? p.proc_at : card.proc_at ?? null,
    due_date: p.due_date !== undefined ? p.due_date : card.due_date,
  };
}
