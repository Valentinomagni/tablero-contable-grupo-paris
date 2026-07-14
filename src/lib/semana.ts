import type { Card } from "./types";

// Semana laboral (Lun-Sáb) de la fecha dada. Planificar = asignar due_date arrastrando.
export interface Dia { date: string; lbl: string; esHoy: boolean; }

export function semanaDe(now: number): Dia[] {
  const d = new Date(now);
  const dow = d.getDay(); // 0=Dom
  const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((dow + 6) % 7));
  const hoyKey = new Date(now).toDateString();
  return Array.from({ length: 6 }, (_, i) => {
    const day = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i);
    return {
      date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
      lbl: day.toLocaleDateString("es-AR", { weekday: "short", day: "numeric" }),
      esHoy: day.toDateString() === hoyKey,
    };
  });
}

const abiertaDe = (c: Card, ownerId: string) =>
  c.owner === ownerId && c.status !== "term" && c.card_type !== "operativa";

// tareas abiertas del dueño que vencen ese día
export function tareasDelDia(cards: Card[], ownerId: string, date: string): Card[] {
  return cards.filter((c) => abiertaDe(c, ownerId) && c.due_date === date);
}

// pool "para planificar": abiertas sin fecha, o vencidas antes de esta semana (hay que reprogramarlas)
export function poolSinPlan(cards: Card[], ownerId: string, lunes: string): Card[] {
  return cards.filter((c) => abiertaDe(c, ownerId) && (!c.due_date || c.due_date < lunes));
}
