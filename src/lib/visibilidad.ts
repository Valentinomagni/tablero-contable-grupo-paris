import type { Profile } from "./types";
import { esSinAsignar } from "./jerarquia";

// Administrador fantasma (spec 28, Fase A): un perfil marcado oculto (migración 29)
// no debe aparecer en listados ni métricas, salvo en el panel de Administración
// (donde el jefe lo ve con un chip "Oculto" para poder administrarlo).
export function esVisible(p: Pick<Profile, "id" | "email" | "oculto">): boolean {
  if (p.oculto === true) return false;
  return !esSinAsignar(p);
}

export function personasVisibles<T extends Pick<Profile, "id" | "email" | "oculto">>(ps: T[]): T[] {
  return ps.filter(esVisible);
}

// Cards que entran en métricas: excluye SOLO a los usuarios ocultos.
// El centinela "Sin asignar" SÍ debe seguir contando: sus tareas son huérfanas reales que hay que reasignar.
// Ojo: a diferencia de esVisible, acá NO se excluye a esSinAsignar — hacerlo rompería la
// detección de "tareas sin responsable" (alertasDeRiesgo) y el flujo de huérfanas.
export function cardsVisibles<C extends { owner: string }>(
  cards: C[],
  profiles: Pick<Profile, "id" | "email" | "oculto">[],
): C[] {
  const ocultos = new Set(profiles.filter((p) => p.oculto === true).map((p) => p.id));
  return cards.filter((c) => !ocultos.has(c.owner));
}
