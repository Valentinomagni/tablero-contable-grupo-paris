import type { RecurRule } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
const claveLocal = (year: number, month1a12: number, dia: number) =>
  `${year}-${pad(month1a12)}-${pad(dia)}`;

// Genera las fechas ISO (YYYY-MM-DD) de un mes que cumplen una regla de recurrencia.
// month1a12 = 1..12. Construye fechas LOCALES (new Date(y, m-1, d)) para no correr el día
// por zona horaria; formatea con pad manual (nunca toISOString).
export function ocurrenciasDelMes(rule: RecurRule, year: number, month1a12: number): string[] {
  const diasEnMes = new Date(year, month1a12, 0).getDate();
  const out: string[] = [];

  if (rule.tipo === "diaria") {
    for (let d = 1; d <= diasEnMes; d++) out.push(claveLocal(year, month1a12, d));
    return out;
  }

  if (rule.tipo === "semanal") {
    const dias = rule.dias ?? [];
    if (dias.length === 0) return out;
    for (let d = 1; d <= diasEnMes; d++) {
      const dow = new Date(year, month1a12 - 1, d).getDay(); // 0=dom..6=sáb (4=jueves)
      if (dias.includes(dow)) out.push(claveLocal(year, month1a12, d));
    }
    return out;
  }

  if (rule.tipo === "mensual") {
    const dm = rule.diaMes;
    if (dm && dm >= 1 && dm <= diasEnMes) out.push(claveLocal(year, month1a12, dm));
    return out;
  }

  return out;
}

// Dado el conjunto de fechas ya materializadas en task_occurrences, devuelve las fechas
// del mes que faltan insertar según la regla. Idempotente: si ya están todas, devuelve [].
export function ocurrenciasFaltantes(
  rule: RecurRule,
  year: number,
  month1a12: number,
  fechasExistentes: string[],
): string[] {
  const yaHay = new Set(fechasExistentes);
  return ocurrenciasDelMes(rule, year, month1a12).filter((f) => !yaHay.has(f));
}

// Fuente única (spec #4): la identidad de una ocurrencia es (card_id, fecha) — la misma clave
// única de la tabla. El calendario y el checklist operan sobre la MISMA fila. Estos helpers
// garantizan que ambos caminos apuntan a la misma identidad.
export const OCC_CONFLICT = "card_id,fecha";
export const occIdentity = (o: { card_id: string; fecha: string }) => `${o.card_id}|${o.fecha}`;
export function occUpsertRow(cardId: string, owner: string, fecha: string, done = false) {
  return { card_id: cardId, owner, fecha, done, done_at: done ? new Date().toISOString() : null };
}
