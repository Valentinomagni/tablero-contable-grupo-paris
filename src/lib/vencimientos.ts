import type { Announcement } from "./types";

// Lógica compartida de vencimientos (Kaizen H4 — Seiton): Tablón y Calendario
// muestran los mismos anuncios kind="vencimiento"; el filtrado, orden y
// semáforo de urgencia viven acá, en un solo lugar.

export type TonoVencimiento = "danger" | "warn" | "neutral";

// Clases del semáforo (mismo chip en Tablón y Calendario).
export const CLS_TONO: Record<TonoVencimiento, string> = {
  danger: "bg-danger-soft text-danger",
  warn: "bg-warn-soft text-warn",
  neutral: "bg-chip text-ink2",
};

// Días calendario entre hoy (medianoche de `now`) y la fecha ISO `due` (YYYY-MM-DD).
export function diasHasta(due: string, now: Date): number {
  const hoy = new Date(now); hoy.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  return Math.round((d.getTime() - hoy.getTime()) / 86400000);
}

export interface EstadoVencimiento { dias: number; tono: TonoVencimiento; txt: string; }

// Countdown + tono para el badge. null si el anuncio no tiene fecha.
export function estadoVencimiento(due: string | null, now: Date): EstadoVencimiento | null {
  if (!due) return null;
  const dias = diasHasta(due, now);
  const lbl = new Date(due + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  const tono: TonoVencimiento = dias < 0 ? "danger" : dias <= 5 ? "warn" : "neutral";
  const txt = dias < 0 ? `Venció ${lbl}` : dias === 0 ? "Vence HOY" : `Vence ${lbl} · ${dias} d`;
  return { dias, tono, txt };
}

// Todos los vencimientos ordenados por fecha (sin fecha al final). Lo usa el Tablón.
export function ordenarVencimientos(annos: Announcement[]): Announcement[] {
  return annos
    .filter((a) => a.kind === "vencimiento")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
}

// Vencimientos futuros o de hoy dentro de la ventana `dias` (default 30), ordenados.
export function proximosVencimientos(annos: Announcement[], now: Date, dias = 30): Announcement[] {
  return ordenarVencimientos(annos).filter((a) => {
    if (!a.due_date) return false;
    const d = diasHasta(a.due_date, now);
    return d >= 0 && d <= dias;
  });
}
