import type { Card, Profile } from "./types";

export function reportesDirectos(managerId: string, profiles: Profile[]): Profile[] {
  return profiles.filter((p) => p.manager_id === managerId);
}

export function equipoDe(managerId: string, profiles: Profile[]): Profile[] {
  const out: Profile[] = [];
  const walk = (id: string) => reportesDirectos(id, profiles).forEach((r) => { out.push(r); walk(r.id); });
  walk(managerId);
  return out;
}

export function visiblesPara(me: Profile, profiles: Profile[]): Profile[] {
  if (me.role === "jefe") return profiles;
  if (me.role === "encargado") return [me, ...equipoDe(me.id, profiles)];
  return [me];
}

// Cards cuyo dueño pertenece al equipo visible (alcance de Resumen/Reporte por rol).
export function cardsDeEquipo(cards: Card[], team: Profile[]): Card[] {
  return cards.filter((c) => team.some((u) => u.id === c.owner));
}

export function porMarca(profiles: Profile[]): Record<string, Profile[]> {
  const m: Record<string, Profile[]> = {};
  for (const p of profiles) if (p.marca) (m[p.marca] ??= []).push(p);
  return m;
}

// Guard anti-ciclo: un candidato NO puede ser manager de un empleado si es el propio empleado
// o si ya forma parte del subárbol (equipo) del empleado (eso crearía un ciclo).
export function puedeSerManager(candidatoId: string, empleadoId: string, profiles: Profile[]): boolean {
  if (candidatoId === empleadoId) return false;
  const subordinados = equipoDe(empleadoId, profiles);
  return !subordinados.some((s) => s.id === candidatoId);
}
