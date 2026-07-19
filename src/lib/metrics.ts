import type { Card, Objective, ActivityLog } from "./types";

// ---- fechas (Argentina UTC-3) ----
export function toARTDate(iso: string): string {
  // convierte un instante a la fecha calendario en zona Argentina
  const d = new Date(iso);
  const art = new Date(d.getTime() - 3 * 3600 * 1000);
  return art.toISOString().slice(0, 10);
}
export const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

// ---- vencimientos ----
export interface DueInfo { days: number; lbl: string; }
export function dueInfo(c: Pick<Card, "due_date">): DueInfo | null {
  if (!c.due_date) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(c.due_date + "T00:00:00");
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  const lbl = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  return { days, lbl };
}

// ---- KPIs ----
export function kpiPct(o: Pick<Objective, "kpi_current" | "kpi_target">): number | null {
  if (!o.kpi_target || Number(o.kpi_target) === 0) return null;
  return Math.round((Number(o.kpi_current) / Number(o.kpi_target)) * 100);
}
export function kpiClass(pct: number | null): string {
  if (pct === null) return "";
  if (pct > 100) return "kpi-azul";
  if (pct >= 80) return "kpi-verde";
  if (pct >= 50) return "kpi-amarillo";
  return "kpi-rojo";
}

// ---- salud del equipo (reporte ejecutivo) ----
export function saludScore(open: Card[], term30: Card[]): number {
  const vencidas = open.filter((c) => { const i = dueInfo(c); return i && i.days < 0; }).length;
  const conVto = term30.filter((c) => c.due_date);
  const aTiempo = conVto.filter((c) => c.done_at && new Date(c.done_at) <= new Date(c.due_date + "T23:59:59")).length;
  const pctTiempo = conVto.length ? Math.round((aTiempo / conVto.length) * 100) : null;
  return Math.max(0, Math.min(100, 100 - vencidas * 8 - (pctTiempo !== null ? (100 - pctTiempo) * 0.3 : 0)));
}

// ---- Kaizen: variación semana contra semana (mejora continua visible) ----
export interface Wow { curr: number; prev: number; delta: number; }
// suma de eventos en la última semana vs. la semana anterior. qty por defecto 1.
export function wow(entries: { t: number; qty?: number }[], now: number): Wow {
  const d = 86400000;
  const sum = (lo: number, hi: number) =>
    entries.filter((e) => e.t >= lo && e.t < hi).reduce((s, e) => s + (e.qty ?? 1), 0);
  const curr = sum(now - 7 * d, now + 1);
  const prev = sum(now - 14 * d, now - 7 * d);
  return { curr, prev, delta: curr - prev };
}

// ---- Shitsuke: adherencia (% de tareas con vencimiento cerradas en fecha, ventana móvil) ----
export function onTimeAdherence(cards: Card[], now: number, days = 30): number | null {
  const from = now - days * 86400000;
  const done = cards.filter((c) =>
    c.card_type !== "operativa" && c.status === "term" && c.done_at &&
    new Date(c.done_at).getTime() >= from && c.due_date);
  if (!done.length) return null;
  const onTime = done.filter((c) => new Date(c.done_at!) <= new Date(c.due_date + "T23:59:59")).length;
  return Math.round((onTime / done.length) * 100);
}

// ---- ficha por empleado (métricas 30 días) ----
export interface UserMetrics {
  done30: number; effort30: number; onTimePct: number | null;
  openToday: number; objWeight: number; kpiPerf: number | null; activity30: number;
}
export function userMetrics30d(
  cards: Card[], objectives: Objective[], activity: ActivityLog[],
  userId: string, now: number,
): UserMetrics {
  const mes = now - 30 * 86400000;
  const his = cards.filter((c) => c.owner === userId && c.card_type !== "operativa");
  const done30 = his.filter((c) => c.status === "term" && c.done_at && new Date(c.done_at).getTime() >= mes);
  const conVto = done30.filter((c) => c.due_date);
  const aTiempo = conVto.filter((c) => new Date(c.done_at!) <= new Date(c.due_date + "T23:59:59"));
  const objs = objectives.filter((o) => o.owner === userId);
  const conKpi = objs.filter((o) => kpiPct(o) !== null && o.weight > 0);
  const kpiPerf = conKpi.length
    ? Math.round(conKpi.reduce((s, o) => s + Math.min(kpiPct(o)!, 120) * o.weight, 0) /
                 conKpi.reduce((s, o) => s + o.weight, 0))
    : null;
  return {
    done30: done30.length,
    effort30: done30.reduce((s, c) => s + (c.effort ?? 1), 0),
    onTimePct: conVto.length ? Math.round((aTiempo.length / conVto.length) * 100) : null,
    openToday: his.filter((c) => c.status !== "term").length,
    objWeight: objs.reduce((s, o) => s + o.weight, 0),
    kpiPerf,
    activity30: activity
      .filter((a) => a.owner === userId && now - new Date(a.at).getTime() < 30 * 86400000)
      .reduce((s, a) => s + a.qty, 0),
  };
}
