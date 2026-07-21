import type { Card, HistoryEntry } from "./types";

// Prefijo del texto de historial que marca un incumplimiento de tiempo máximo
// (ver registrarIncumplimiento más abajo).
const TXT_INCUMPLIMIENTO = "Superó el tiempo máximo";

// Tiempo máximo de ejecución por tarea (migración 29 / spec 28 Fase A, Task 4).
// El SLA se mide desde que la tarea pasa a "En proceso" (proc_at) hasta que
// termina (done_at) o hasta ahora si sigue en curso.

export interface EstadoTiempo {
  maxHoras: number | null;
  horas: number | null;
  excedido: boolean;
  restanteHoras: number | null;
}

// Prioridad: campo propio de la tarea > config por categoría > sin límite.
export function tiempoMaxDe(c: Card, config: Record<string, number>): number | null {
  if (c.tiempo_max_horas != null) return c.tiempo_max_horas;
  const porCategoria = config[c.categoria ?? ""];
  return porCategoria != null ? porCategoria : null;
}

export function estadoTiempo(c: Card, config: Record<string, number>, ahoraISO: string): EstadoTiempo {
  const maxHoras = tiempoMaxDe(c, config);
  const sinDatos: EstadoTiempo = { maxHoras, horas: null, excedido: false, restanteHoras: null };
  if (c.status === "pend" || !c.proc_at) return sinDatos;

  const fin = c.status === "term" ? c.done_at : ahoraISO;
  if (!fin) return sinDatos;

  const desde = new Date(c.proc_at).getTime();
  const hasta = new Date(fin).getTime();
  if (Number.isNaN(desde) || Number.isNaN(hasta)) return sinDatos;

  const horasCrudas = (hasta - desde) / 3_600_000;
  // Clamp a 0: done_at < proc_at (reloj desincronizado, corrección manual, etc.) no debe
  // mostrar horas negativas en el chip.
  const horas = Math.max(0, horasCrudas);
  const excedido = maxHoras != null && horas > maxHoras;
  const restanteHoras = maxHoras != null ? maxHoras - horas : null;
  return { maxHoras, horas, excedido, restanteHoras };
}

export function incumplimientos(cards: Card[], config: Record<string, number>, ahoraISO: string): Card[] {
  return cards.filter((c) => estadoTiempo(c, config, ahoraISO).excedido);
}

// Agrega al historial la entrada de "Superó el tiempo máximo" al terminar una tarea,
// salvo que ya exista una para el ciclo proc_at→done_at actual (evita duplicados cuando
// la tarea se reabre a "proc" y se vuelve a terminar sin haber cambiado proc_at).
export function registrarIncumplimiento(
  history: HistoryEntry[],
  est: EstadoTiempo,
  who: string,
  at: string,
  procAt: string | null,
): HistoryEntry[] {
  if (!est.excedido || est.horas == null || est.maxHoras == null) return history;
  const procAtMs = procAt ? new Date(procAt).getTime() : NaN;
  const yaRegistrado = history.some((h) => {
    if (!h.txt.startsWith(TXT_INCUMPLIMIENTO)) return false;
    if (Number.isNaN(procAtMs)) return true; // sin proc_at para comparar: no dupliques igual
    const hAtMs = new Date(h.at).getTime();
    return !Number.isNaN(hAtMs) && hAtMs > procAtMs;
  });
  if (yaRegistrado) return history;
  return [...history, { who, at, txt: `${TXT_INCUMPLIMIENTO} (${est.horas.toFixed(1)}h de ${est.maxHoras}h)` }];
}
