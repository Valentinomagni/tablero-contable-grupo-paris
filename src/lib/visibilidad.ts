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
  const ocultos = ocultosDe(profiles);
  return cards.filter((c) => !ocultos.has(c.owner));
}

function ocultosDe(profiles: Pick<Profile, "id" | "email" | "oculto">[]): Set<string> {
  return new Set(profiles.filter((p) => p.oculto === true).map((p) => p.id));
}

// CRITERIO ÚNICO de exclusión para TODA métrica que lee cards_archive.
//
// Excluye a los usuarios ocultos (administrador fantasma) y a cualquier owner que no
// pertenezca al alcance del llamador. El centinela "Sin asignar" SÍ cuenta, igual que en
// cardsVisibles(): sus tareas son trabajo real del equipo que quedó huérfano, y sacarlo de
// las métricas hace desaparecer del porcentaje justo lo que hay que mirar.
//
// FILTRO POSITIVO (no exclusión por Set de ocultos): `profiles` acá NO es "todos los
// perfiles de la empresa" — es la lista YA acotada por rol/segmento que recibe cada
// consumidor (`equipoVisible`, `teamSeg`, etc.), y esas listas ya sacaron al oculto antes
// de llegar. Si filtráramos por "está en el Set de ocultos", el fantasma —que nunca está
// en esas listas— nunca entraría al Set y sus archivos volverían a contar. Por eso acá se
// invierte la lógica: un archivo cuenta si su owner ESTÁ en `profiles` (y no es oculto) o
// es el centinela; cualquier owner que no aparezca en la lista y no sea el centinela está
// fuera del alcance del llamador y se descarta. Esto además hace que `concentracion` y el
// bus factor respeten el segmento que les pasaron, en vez de ignorarlo.
//
// POR QUÉ EXISTE: antes cada métrica histórica elegía por su cuenta. `analizarMes` no
// excluía a nadie, mientras que `comparativaMensual` y `concentracion` usaban esVisible(),
// que además del oculto se llevaba puesto al centinela. Resultado: el MISMO mes mostraba
// dos porcentajes distintos en la misma pantalla. Cualquier métrica nueva sobre
// cards_archive usa este helper — no esVisible(), que es para LISTADOS de personas.
export function archivesParaMetricas<A extends { owner: string }>(
  archives: A[],
  profiles: Pick<Profile, "id" | "email" | "oculto">[],
): A[] {
  const conocidos = new Map(profiles.map((p) => [p.id, p]));
  return archives.filter((a) => {
    const p = conocidos.get(a.owner);
    if (p) return p.oculto !== true;
    return esSinAsignar({ id: a.owner, email: "" });
  });
}
