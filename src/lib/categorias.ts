import type { Card } from "./types";

// Categorías realmente usadas en un conjunto de cards (únicas, orden alfabético es-AR).
export function categoriasEnUso(cards: Pick<Card, "categoria">[]): string[] {
  const set = new Set<string>();
  for (const c of cards) if (c.categoria) set.add(c.categoria);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

// Filtro de tablero: null = todas; "" = sin categoría; string = esa categoría.
export function pasaFiltroCategoria(c: Pick<Card, "categoria">, filtro: string | null): boolean {
  if (filtro === null) return true;
  if (filtro === "") return !c.categoria;
  return c.categoria === filtro;
}
