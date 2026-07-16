import { describe, it, expect } from "vitest";
import { agruparCards } from "./agrupar";
import type { Card } from "./types";

const card = (title: string, categoria: string | null = null, priority: Card["priority"] = "media"): Card =>
  ({ id: title, owner: "u1", title, status: "pend", description: "", checklist: [], comments: [],
     history: [], done_at: null, due_date: null, recurring: false, priority,
     effort: 1, card_type: "normal", deps: [], created_at: "", categoria } as Card);

describe("agruparCards", () => {
  it("agrupa por categoría, más tareas primero, Sin categoría al final", () => {
    const cards = [
      card("a", "Impuestos"), card("b", "Bancos"), card("c", "Bancos"),
      card("d"), card("e", "Bancos"),
    ];
    const g = agruparCards(cards, ["Bancos", "Impuestos"]);
    expect(g.map((x) => x.grupo)).toEqual(["Bancos", "Impuestos", "Sin categoría"]);
    expect(g[0].cards.map((c) => c.title)).toEqual(["b", "c", "e"]);
    expect(g[2].cards.map((c) => c.title)).toEqual(["d"]);
  });
  it("sin ninguna categoría agrupa por prioridad alta/media/baja", () => {
    const cards = [card("a", null, "baja"), card("b", null, "alta"), card("c", null, "media")];
    const g = agruparCards(cards, []);
    expect(g.map((x) => x.grupo)).toEqual(["Alta", "Media", "Baja"]);
    expect(g[0].cards[0].title).toBe("b");
  });
  it("omite grupos de prioridad vacíos", () => {
    const g = agruparCards([card("a", null, "alta")], []);
    expect(g.map((x) => x.grupo)).toEqual(["Alta"]);
  });
  it("cards vacías devuelve vacío", () => {
    expect(agruparCards([], [])).toEqual([]);
  });
});
