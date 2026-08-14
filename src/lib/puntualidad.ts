import type { Card } from "./types";
import { toARTDate, entregadaATiempo } from "./metrics";

// Puntualidad (spec 26 item 10): de las tareas CERRADAS en los últimos 30 días
// respecto de hoyISO, qué % de las que tenían vencimiento se cerraron en fecha.
export function puntualidad(
  cards: Card[],
  hoyISO: string
): { pct: number | null; n: number; enFecha: number; sinFecha: number; muestraChica: boolean } {
  // Ventana por FECHA CALENDARIO en zona Argentina (no por instante epoch), para ser
  // consistente con el resto del proyecto (toARTDate) y con term30 en Reporte.tsx.
  // Convertimos hoyISO (fecha calendario, ya en criterio ART) a un timestamp UTC puro
  // sólo para hacer aritmética de días — nunca se reconstruye con medianoche LOCAL.
  const [hy, hm, hd] = hoyISO.split("-").map(Number);
  const hoyUTC = Date.UTC(hy, hm - 1, hd);
  const desdeUTC = hoyUTC - 30 * 86400000; // ventana: hoy - 30 días .. hoy (ambos límites de fecha calendario inclusive)

  const cerradas30 = cards.filter((c) => {
    if (c.status !== "term" || !c.done_at) return false;
    const fecha = toARTDate(c.done_at);
    const [y, m, d] = fecha.split("-").map(Number);
    const t = Date.UTC(y, m - 1, d);
    return t >= desdeUTC && t <= hoyUTC;
  });

  const conVto = cerradas30.filter((c) => c.due_date);
  const sinVto = cerradas30.filter((c) => !c.due_date);
  // Fuente única (hallazgo 8 de la auditoría del 05/08): esto tenía su propia copia del
  // criterio, armada con la medianoche del navegador. La ventana de arriba ya cuenta en días
  // calendario argentinos; que el corte de puntualidad usara otra zona hacía que el mismo
  // bloque del reporte mostrara más tareas "con vencimiento" que tareas cerradas.
  const enFecha = conVto.filter(entregadaATiempo).length;

  const n = conVto.length;
  const pct = n ? Math.round((enFecha / n) * 100) : null;

  return { pct, n, enFecha, sinFecha: sinVto.length, muestraChica: n > 0 && n < 3 };
}
