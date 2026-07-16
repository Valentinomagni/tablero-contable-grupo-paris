import type { Card } from "./types";

// Detección fuzzy de duplicados (spec 21, item 12). Coeficiente de Dice sobre
// bigramas de caracteres: robusto para títulos cortos, tolera tildes y plurales.

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bigramas(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2);
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return m;
}

export function similitud(a: string, b: string): number {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (na.length < 2 || nb.length < 2) return na === nb ? 1 : 0;
  const ba = bigramas(na);
  const bb = bigramas(nb);
  let inter = 0;
  for (const [bg, n] of ba) inter += Math.min(n, bb.get(bg) ?? 0);
  const dice = (2 * inter) / (na.length - 1 + nb.length - 1);
  // Boost por palabras EXACTAS compartidas ("IVA julio" vs "IVA agosto"):
  // el Dice de bigramas castiga de más cuando difiere solo una palabra corta.
  const ta = na.split(" ");
  const tb = new Set(nb.split(" "));
  const comunes = ta.filter((t) => tb.has(t)).length;
  const solape = comunes / Math.min(ta.length, tb.size);
  return dice + (1 - dice) * 0.5 * solape;
}

// Cards ABIERTAS cuyo título supera el umbral, ordenadas por similitud desc.
export function similares(titulo: string, cards: Card[], umbral = 0.55): Card[] {
  return cards
    .filter((c) => c.status !== "term")
    .map((c) => ({ c, s: similitud(titulo, c.title) }))
    .filter((x) => x.s >= umbral)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}
