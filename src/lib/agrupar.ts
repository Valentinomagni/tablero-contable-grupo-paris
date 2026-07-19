import type { Card } from "./types";

const SIN_CATEGORIA = "Sin categoría";

// Agrupación del tablero (spec 21, item 13). Por categoría (las de más tareas
// primero, "Sin categoría" al final); si NINGUNA card tiene categoría, por prioridad.
export function agruparCards(cards: Card[], _categorias: string[]): { grupo: string; cards: Card[] }[] {
  if (cards.length === 0) return [];
  const hayCategorias = cards.some((c) => c.categoria);
  if (!hayCategorias) {
    const orden: [Card["priority"], string][] = [["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]];
    return orden
      .map(([p, grupo]) => ({ grupo, cards: cards.filter((c) => c.priority === p) }))
      .filter((g) => g.cards.length > 0);
  }
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
