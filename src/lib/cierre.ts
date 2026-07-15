import type { Card } from "./types";
import { marcaPlantilla } from "./plantilla";
import { dueInfo } from "./metrics";

// Cierre mensual (5S — Seiketsu: proceso estandarizado; Kaizen: se mide su avance).
// Las tareas del cierre de un mes son las generadas desde la plantilla, ancladas por
// la marca de historial de ESE mes (misma clave de idempotencia que usa la plantilla).

export function closingCards(cards: Card[], year: number, month1a12: number): Card[] {
  const marca = marcaPlantilla(year, month1a12);
  return cards.filter((c) => (c.history ?? []).some((h) => h.txt === marca));
}

export interface CierreStats {
  total: number; done: number; proc: number; pend: number; overdue: number;
  pct: number;                 // % completado (terminadas / total)
  onTimePct: number | null;    // Shitsuke: de las cerradas con vencimiento, cuántas en fecha
}

export function cierreStats(closing: Card[]): CierreStats {
  const total = closing.length;
  const done = closing.filter((c) => c.status === "term").length;
  const proc = closing.filter((c) => c.status === "proc").length;
  const pend = closing.filter((c) => c.status === "pend").length;
  const overdue = closing.filter((c) => {
    if (c.status === "term") return false;
    const i = dueInfo(c);
    return !!i && i.days < 0;
  }).length;
  const doneWithDue = closing.filter((c) => c.status === "term" && c.done_at && c.due_date);
  const onTime = doneWithDue.filter((c) => new Date(c.done_at!) <= new Date(c.due_date + "T23:59:59")).length;
  return {
    total, done, proc, pend, overdue,
    pct: total ? Math.round((done / total) * 100) : 0,
    onTimePct: doneWithDue.length ? Math.round((onTime / doneWithDue.length) * 100) : null,
  };
}

// orden de trabajo: primero lo urgente (vencido) y con vencimiento próximo, luego sin fecha, cerradas al final.
export function ordenarCierre(closing: Card[]): Card[] {
  const rank = (c: Card) => (c.status === "term" ? 2 : 0);
  const dueVal = (c: Card) => {
    const i = dueInfo(c);
    return i ? i.days : Number.POSITIVE_INFINITY;
  };
  return [...closing].sort((a, b) => rank(a) - rank(b) || dueVal(a) - dueVal(b));
}

export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// navegación de meses: devuelve {year, month} desplazado por delta meses
export function shiftMonth(year: number, month1a12: number, delta: number): { year: number; month: number } {
  const idx = (year * 12 + (month1a12 - 1)) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}
