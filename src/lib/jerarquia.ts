import type { Card, Profile } from "./types";

// Perfil centinela "Sin asignar" (migración 17): dueño de las cards huérfanas tras
// eliminar un empleado. Se excluye de los listados de equipo/métricas.
export const SIN_ASIGNAR_ID = "00000000-0000-0000-0000-000000000000";

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
  // El centinela "Sin asignar" nunca aparece en listados de equipo/métricas.
  const reales = profiles.filter((p) => p.id !== SIN_ASIGNAR_ID);
  if (me.role === "jefe") return reales;
  if (me.role === "encargado") return [me, ...equipoDe(me.id, reales)];
  return [me];
}

// Cards cuyo dueño pertenece al equipo visible (alcance de Resumen/Reporte por rol).
export function cardsDeEquipo(cards: Card[], team: Profile[]): Card[] {
  return cards.filter((c) => team.some((u) => u.id === c.owner));
}

// ¿Puede `me` reasignar una card de `cardOwner` hacia `destino`?
// Jefe: siempre (salvo mismo origen/destino). Encargado: origen y destino deben estar en SU equipo. Empleado: nunca.
export function puedeReasignar(me: Profile, cardOwner: string, destino: string, profiles: Profile[]): boolean {
  if (cardOwner === destino) return false;
  if (me.role === "jefe") return true;
  if (me.role !== "encargado") return false;
  const equipo = equipoDe(me.id, profiles).map((p) => p.id);
  return equipo.includes(cardOwner) && equipo.includes(destino);
}

export function porMarca(profiles: Profile[]): Record<string, Profile[]> {
  const m: Record<string, Profile[]> = {};
  for (const p of profiles) if (p.marca) (m[p.marca] ??= []).push(p);
  return m;
}

// Árbol jerárquico para el organigrama. Las raíces son quienes no tienen manager
// o cuyo manager no está en el set visible (subárbol de un encargado, o Plan 02 sin cargar).
export interface NodoOrg { profile: Profile; hijos: NodoOrg[]; }
export function construirArbol(profiles: Profile[]): NodoOrg[] {
  const idset = new Set(profiles.map((p) => p.id));
  const esRaiz = (p: Profile) => p.manager_id === null || !idset.has(p.manager_id);
  const hijosDe = (id: string): NodoOrg[] =>
    profiles.filter((p) => !esRaiz(p) && p.manager_id === id)
      .map((p) => ({ profile: p, hijos: hijosDe(p.id) }));
  return profiles.filter(esRaiz).map((p) => ({ profile: p, hijos: hijosDe(p.id) }));
}

// Guard anti-ciclo: un candidato NO puede ser manager de un empleado si es el propio empleado
// o si ya forma parte del subárbol (equipo) del empleado (eso crearía un ciclo).
export function puedeSerManager(candidatoId: string, empleadoId: string, profiles: Profile[]): boolean {
  if (candidatoId === empleadoId) return false;
  const subordinados = equipoDe(empleadoId, profiles);
  return !subordinados.some((s) => s.id === candidatoId);
}
