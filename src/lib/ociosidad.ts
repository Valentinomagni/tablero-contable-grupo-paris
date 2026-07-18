// Utilización del tiempo — métricas AGREGADAS de planificación de carga.
// NO mide presencia ni productividad individual: sólo si hubo alguna señal de
// actividad registrada por día hábil, para planificar reparto de tareas.
// Funciones puras sobre datos existentes (sin tracking nuevo).
import type { Card, ActivityLog, Snapshot, Profile } from "./types";

// getDay 1..5 = lun..vie. Fecha a mediodía para evitar corrimiento de zona.
export function esDiaHabil(fechaISO: string): boolean {
  const d = new Date(fechaISO + "T12:00:00").getDay();
  return d >= 1 && d <= 5;
}

// Lista de YYYY-MM-DD hábiles entre desde y hasta (inclusive).
export function diasHabilesDelRango(desdeISO: string, hastaISO: string): string[] {
  const out: string[] = [];
  const d = new Date(desdeISO + "T12:00:00");
  const fin = new Date(hastaISO + "T12:00:00");
  while (d.getTime() <= fin.getTime()) {
    const iso = d.toISOString().slice(0, 10);
    if (esDiaHabil(iso)) out.push(iso);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ¿Hubo alguna señal de actividad de esa persona ese día? (compara por prefijo YYYY-MM-DD)
export function tuvoActividad(
  persona: string, fechaISO: string,
  cards: Card[], activity: ActivityLog[], snaps: Snapshot[],
): boolean {
  const pref = fechaISO.slice(0, 10);
  const cierre = (cards ?? []).some((c) => c.owner === persona && !!c.done_at && c.done_at.slice(0, 10) === pref);
  if (cierre) return true;
  const reg = (activity ?? []).some((a) => a.owner === persona && !!a.at && a.at.slice(0, 10) === pref);
  if (reg) return true;
  const sn = (snaps ?? []).some((s) => s.owner === persona && s.day.slice(0, 10) === pref && ((s.done_count > 0) || (s.activity_qty > 0)));
  return sn;
}

export interface Utilizacion {
  diasHabiles: number; diasConActividad: number; diasSinActividad: number; indice: number;
}

export function utilizacion(
  ownerId: string,
  cards: Card[], activity: ActivityLog[], snaps: Snapshot[],
  desdeISO: string, hastaISO: string,
): Utilizacion {
  const habiles = diasHabilesDelRango(desdeISO, hastaISO);
  const diasHabiles = habiles.length;
  const diasConActividad = habiles.filter((d) => tuvoActividad(ownerId, d, cards, activity, snaps)).length;
  const diasSinActividad = diasHabiles - diasConActividad;
  const indice = diasHabiles === 0 ? 0 : Math.round((diasConActividad / diasHabiles) * 100) / 100;
  return { diasHabiles, diasConActividad, diasSinActividad, indice };
}

export interface UtilizacionPersona { id: string; name: string; indice: number; diasSinActividad: number; }

// Por persona, ordenado por indice ascendente (menor utilización primero: los relevantes para planificar).
export function utilizacionEquipo(
  team: Profile[],
  cards: Card[], activity: ActivityLog[], snaps: Snapshot[],
  desdeISO: string, hastaISO: string,
): UtilizacionPersona[] {
  return (team ?? []).map((u) => {
    const ut = utilizacion(u.id, cards, activity, snaps, desdeISO, hastaISO);
    return { id: u.id, name: u.name, indice: ut.indice, diasSinActividad: ut.diasSinActividad };
  }).sort((a, b) => a.indice - b.indice);
}
