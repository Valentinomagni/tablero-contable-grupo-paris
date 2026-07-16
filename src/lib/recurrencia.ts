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
