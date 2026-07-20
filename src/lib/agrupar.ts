import type { Card, Profile } from "./types";
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
