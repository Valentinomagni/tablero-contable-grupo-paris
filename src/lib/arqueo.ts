import type { TaskOccurrence } from "./types";

// Seguimiento de Arqueo de Caja (spec24 item 9). Sobre las ocurrencias (task_occurrences)
// de una card de control, calcula el cumplimiento del mes: cuántas se hicieron sin diferencias
// ('ok') vs con diferencias ('dif'). Puro y determinístico → testeable (TDD).

export interface StatsArqueo {
  total: number;       // ocurrencias done del mes
  ok: number;          // resultado === "ok"
  dif: number;         // resultado === "dif"
  pctOk: number;       // ok/total * 100, 2 decimales
  pctDif: number;      // dif/total * 100, 2 decimales
  diasCorrectos: number; // = ok
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Filtra ocurrencias del mes (fecha empieza con mesPrefix "YYYY-MM") que estén done,
// y computa el cumplimiento. Si no hay done → pcts 0.
export function statsArqueo(occs: TaskOccurrence[], mesPrefix: string): StatsArqueo {
  const done = occs.filter((o) => o.done && o.fecha.startsWith(mesPrefix));
  const total = done.length;
  const ok = done.filter((o) => o.resultado === "ok").length;
  const dif = done.filter((o) => o.resultado === "dif").length;
  const pctOk = total === 0 ? 0 : round2((ok / total) * 100);
  const pctDif = total === 0 ? 0 : round2((dif / total) * 100);
  return { total, ok, dif, pctOk, pctDif, diasCorrectos: ok };
}

// Prefijo "YYYY-MM" del mes anterior a un prefijo dado.
function mesAnterior(mesPrefix: string): string {
  const [y, m] = mesPrefix.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// Últimos n meses hasta hastaMesPrefix (inclusive), de más viejo a más nuevo,
// con el pctOk de cada uno según sus ocurrencias done.
export function evolucionMensual(
  occs: TaskOccurrence[],
  hastaMesPrefix: string,
  n = 6,
): { mes: string; pctOk: number }[] {
  const meses: string[] = [];
  let cur = hastaMesPrefix;
  for (let i = 0; i < n; i++) {
    meses.unshift(cur);
    cur = mesAnterior(cur);
  }
  return meses.map((mes) => ({ mes, pctOk: statsArqueo(occs, mes).pctOk }));
}
