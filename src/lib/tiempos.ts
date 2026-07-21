import type { Card } from "./types";

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

  const horas = (hasta - desde) / 3_600_000;
  const excedido = maxHoras != null && horas > maxHoras;
  const restanteHoras = maxHoras != null ? maxHoras - horas : null;
  return { maxHoras, horas, excedido, restanteHoras };
}

export function incumplimientos(cards: Card[], config: Record<string, number>, ahoraISO: string): Card[] {
  return cards.filter((c) => estadoTiempo(c, config, ahoraISO).excedido);
}
