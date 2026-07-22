import type { Card, Profile } from "./types";

// Perfil centinela "Sin asignar": dueño de las cards huérfanas tras eliminar un empleado.
// Lo crea la edge function eliminar-usuario como auth user REAL (un uuid inventado viola
// cards_owner_fkey), así que se lo identifica por EMAIL, no por un id fijo.
// SIN_ASIGNAR_ID queda por compatibilidad con bases donde la migración 17 sí insertó.
const SIN_ASIGNAR_ID = "00000000-0000-0000-0000-000000000000";
export const SIN_ASIGNAR_EMAIL = "sin-asignar@grupoparis.com";
export const esSinAsignar = (p: Pick<Profile, "id" | "email">): boolean =>
  p.email === SIN_ASIGNAR_EMAIL || p.id === SIN_ASIGNAR_ID;

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
  const reales = profiles.filter((p) => !esSinAsignar(p));
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

// Árbol jerárquico con filtro OPCIONAL por marca que nunca corta la cadena de mando.
// Bug real (spec 28 Fase D): Organigrama.tsx armaba porMarca(team) y RECIÉN DESPUÉS
// construirArbol(gente) por cada marca. Al construir el árbol sobre un subconjunto,
// esRaiz() se dispara para cualquiera cuyo manager quedó afuera del grupo — así,
// Juan (Gerente General, marca "General") desaparecía de la sección "Peugeot"/"Honda"
// porque su propio manager_id (null) SÍ es raíz legítima, pero sus REPORTES en esas
// marcas perdían a Juan como padre y quedaban como raíces sueltas.
// La solución: un solo árbol armado sobre TODOS los profiles; el filtro por marca sólo
// decide qué hojas mostrar, arrastrando siempre la cadena completa de superiores
// (aunque sean de otra marca) para que la jerarquía nunca se corte.
export function arbolConAncestros(profiles: Profile[], filtroMarca: string | null): NodoOrg[] {
  if (!filtroMarca) return construirArbol(profiles);

  const byId = new Map(profiles.map((p) => [p.id, p]));
  // Conjunto de ids a conservar: las personas de la marca + toda su cadena de ancestros.
  const incluidos = new Set<string>();
  for (const p of profiles) {
    if (p.marca !== filtroMarca) continue;
    let actual: Profile | undefined = p;
    // Guard anti-ciclo defensivo: un manager_id mal cargado que cicle nunca debería
    // darse (puedeSerManager lo evita al asignar), pero si igual ocurriera, el Set ya
    // marcado corta el walk en vez de loopear infinito.
    while (actual && !incluidos.has(actual.id)) {
      incluidos.add(actual.id);
      actual = actual.manager_id ? byId.get(actual.manager_id) : undefined;
    }
  }
  const subset = profiles.filter((p) => incluidos.has(p.id));
  return construirArbol(subset);
}

// Guard anti-ciclo: un candidato NO puede ser manager de un empleado si es el propio empleado
// o si ya forma parte del subárbol (equipo) del empleado (eso crearía un ciclo).
export function puedeSerManager(candidatoId: string, empleadoId: string, profiles: Profile[]): boolean {
  if (candidatoId === empleadoId) return false;
  const subordinados = equipoDe(empleadoId, profiles);
  return !subordinados.some((s) => s.id === candidatoId);
}
