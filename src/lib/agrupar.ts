import type { Card, Profile, Status } from "./types";
import { marcaDe } from "./segmento";

const SIN_CATEGORIA = "Sin categoría";
const SIN_MARCA = "Sin marca";

export type ModoAgrupar = "ninguno" | "categoria" | "prioridad" | "marca";

// Agrupación del tablero (spec 21 item 13 / spec 26): preferencia pura de vista,
// nunca modifica status ni ningún dato de la card.
export function agruparCards(
  cards: Card[],
  modo: ModoAgrupar,
  ctx: { profiles: Profile[] },
): { grupo: string; cards: Card[] }[] {
  if (cards.length === 0) return [];

  if (modo === "ninguno") return [{ grupo: "", cards }];

  if (modo === "prioridad") {
    const orden: [Card["priority"], string][] = [["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]];
    return orden
      .map(([p, grupo]) => ({ grupo, cards: cards.filter((c) => c.priority === p) }))
      .filter((g) => g.cards.length > 0);
  }

  if (modo === "marca") {
    const byId = new Map(ctx.profiles.map((p) => [p.id, p]));
    const mapa = new Map<string, Card[]>();
    for (const c of cards) {
      const g = marcaDe(c, byId) || SIN_MARCA;
      if (!mapa.has(g)) mapa.set(g, []);
      mapa.get(g)!.push(c);
    }
    return [...mapa.entries()]
      .map(([grupo, cs]) => ({ grupo, cards: cs }))
      .sort((a, b) => {
        if (a.grupo === SIN_MARCA) return 1;
        if (b.grupo === SIN_MARCA) return -1;
        return b.cards.length - a.cards.length || a.grupo.localeCompare(b.grupo, "es");
      });
  }

  // modo === "categoria"
  const mapa = new Map<string, Card[]>();
  for (const c of cards) {
    const g = c.categoria || SIN_CATEGORIA;
    if (!mapa.has(g)) mapa.set(g, []);
    mapa.get(g)!.push(c);
  }
  return [...mapa.entries()]
    .map(([grupo, cs]) => ({ grupo, cards: cs }))
    .sort((a, b) => {
      if (a.grupo === SIN_CATEGORIA) return 1;
      if (b.grupo === SIN_CATEGORIA) return -1;
      return b.cards.length - a.cards.length || a.grupo.localeCompare(b.grupo, "es");
    });
}

export type Carril = { grupo: string; total: number; porEstado: Record<Status, Card[]> };

// Carriles del tablero (spec 28, Task 8): la agrupación NO depende del estado.
// Primero se agrupa el conjunto COMPLETO de cards y recién después, dentro de cada
// grupo, se reparte por estado. Consecuencias buscadas:
//  - el orden y la presencia de los carriles salen de agruparCards sobre el total,
//    nunca de cuántas cards tenga cada columna;
//  - un grupo con todas las tareas terminadas SIGUE existiendo, con sus columnas
//    pendiente/en proceso vacías;
//  - mover una card de estado la cambia de columna sin sacarla de su carril ni
//    reordenar los carriles.
export function carrilesPorGrupo(
  cards: Card[],
  modo: ModoAgrupar,
  columnas: readonly Status[],
  ctx: { profiles: Profile[]; estadoDe?: (c: Card) => Status },
): Carril[] {
  const estadoDe = ctx.estadoDe ?? ((c: Card) => c.status);
  return agruparCards(cards, modo, { profiles: ctx.profiles }).map((g) => {
    const porEstado = Object.fromEntries(columnas.map((k) => [k, [] as Card[]])) as Record<Status, Card[]>;
    for (const c of g.cards) {
      const k = estadoDe(c);
      if (porEstado[k]) porEstado[k].push(c);
    }
    return { grupo: g.grupo, total: g.cards.length, porEstado };
  });
}
