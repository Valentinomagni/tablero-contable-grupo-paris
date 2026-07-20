import type { Card } from "./types";

// Puntualidad (spec 26 item 10): de las tareas CERRADAS en los últimos 30 días
// respecto de hoyISO, qué % de las que tenían vencimiento se cerraron en fecha.
export function puntualidad(
  cards: Card[],
  hoyISO: string
): { pct: number | null; n: number; enFecha: number; sinFecha: number; muestraChica: boolean } {
  const hoy = new Date(hoyISO + "T00:00:00").getTime();
  const desde = hoy - 30 * 86400000;

  const cerradas30 = cards.filter((c) => {
    if (c.status !== "term" || !c.done_at) return false;
    const t = new Date(c.done_at).getTime();
    return t >= desde && t <= hoy + 86400000 - 1; // incluye hoy
  });

  const conVto = cerradas30.filter((c) => c.due_date);
  const sinVto = cerradas30.filter((c) => !c.due_date);
  const enFecha = conVto.filter(
    (c) => c.done_at && new Date(c.done_at) <= new Date(c.due_date + "T23:59:59")
  ).length;

  const n = conVto.length;
  const pct = n ? Math.round((enFecha / n) * 100) : null;

  return { pct, n, enFecha, sinFecha: sinVto.length, muestraChica: n > 0 && n < 3 };
}
