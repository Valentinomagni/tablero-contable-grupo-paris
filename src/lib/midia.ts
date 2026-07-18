import type { Card } from "./types";

// "Mi día" (propuesta P4): agenda personal priorizada para HOY.
// Fechas en formato ISO "YYYY-MM-DD" — la comparación lexicográfica coincide con la cronológica.

export type MotivoDia = "vencida" | "vence-hoy" | "alta";
export interface ItemDia { card: Card; motivo: MotivoDia; }

// Peso de urgencia: menor = más arriba. Define orden y desempate entre motivos de una card.
const PESO: Record<MotivoDia, number> = { vencida: 0, "vence-hoy": 1, alta: 2 };

// Items del día para las cards NO terminadas del owner:
// - due_date < hoy      → "vencida"
// - due_date === hoy    → "vence-hoy"
// - priority === "alta" → "alta"
// Una card aparece una sola vez, con el motivo más urgente (vencida > vence-hoy > alta).
// Ordena por urgencia: vencidas, luego vencen-hoy, luego alta.
export function itemsDelDia(cards: Card[], hoyISO: string): ItemDia[] {
  const items: ItemDia[] = [];
  for (const card of cards) {
    if (card.status === "term" || card.card_type === "operativa") continue;
    let motivo: MotivoDia | null = null;
    if (card.due_date && card.due_date < hoyISO) motivo = "vencida";
    else if (card.due_date && card.due_date === hoyISO) motivo = "vence-hoy";
    else if (card.priority === "alta") motivo = "alta";
    if (motivo) items.push({ card, motivo });
  }
  return items.sort((a, b) => PESO[a.motivo] - PESO[b.motivo]);
}
