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
