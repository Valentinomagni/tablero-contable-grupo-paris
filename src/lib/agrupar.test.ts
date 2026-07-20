import { describe, it, expect } from "vitest";
import { agruparCards } from "./agrupar";
import type { Card, Profile } from "./types";

const card = (title: string, categoria: string | null = null, priority: Card["priority"] = "media", marca: string | null = null, owner = "u1"): Card =>
  ({ id: title, owner, title, status: "pend", description: "", checklist: [], comments: [],
     history: [], done_at: null, due_date: null, recurring: false, priority,
     effort: 1, card_type: "normal", deps: [], created_at: "", categoria, marca } as Card);

const profile = (id: string, marca: string | null = null): Profile =>
  ({ id, name: id, role: "empleado", marca } as Profile);

describe("agruparCards", () => {
  it("modo ninguno devuelve un único grupo sin nombre con las cards tal cual", () => {
    const cards = [card("a"), card("b")];
    const g = agruparCards(cards, "ninguno", { profiles: [] });
    expect(g).toEqual([{ grupo: "", cards }]);
  });

  it("cards vacías devuelve vacío en cualquier modo", () => {
    expect(agruparCards([], "ninguno", { profiles: [] })).toEqual([]);
    expect(agruparCards([], "categoria", { profiles: [] })).toEqual([]);
    expect(agruparCards([], "prioridad", { profiles: [] })).toEqual([]);
    expect(agruparCards([], "marca", { profiles: [] })).toEqual([]);
  });

  it("modo categoría agrupa por categoría, más tareas primero, Sin categoría al final", () => {
    const cards = [
      card("a", "Impuestos"), card("b", "Bancos"), card("c", "Bancos"),
      card("d"), card("e", "Bancos"),
    ];
    const g = agruparCards(cards, "categoria", { profiles: [] });
    expect(g.map((x) => x.grupo)).toEqual(["Bancos", "Impuestos", "Sin categoría"]);
    expect(g[0].cards.map((c) => c.title)).toEqual(["b", "c", "e"]);
    expect(g[2].cards.map((c) => c.title)).toEqual(["d"]);
  });

  it("modo prioridad agrupa siempre Alta/Media/Baja, aunque haya categorías", () => {
    const cards = [card("a", "Impuestos", "baja"), card("b", null, "alta"), card("c", null, "media")];
    const g = agruparCards(cards, "prioridad", { profiles: [] });
    expect(g.map((x) => x.grupo)).toEqual(["Alta", "Media", "Baja"]);
    expect(g[0].cards[0].title).toBe("b");
  });

  it("modo prioridad omite grupos vacíos", () => {
    const g = agruparCards([card("a", null, "alta")], "prioridad", { profiles: [] });
    expect(g.map((x) => x.grupo)).toEqual(["Alta"]);
  });

  it("modo marca usa la marca propia de la card si existe", () => {
    const cards = [card("a", null, "media", "ParisA"), card("b", null, "media", "ParisB")];
    const g = agruparCards(cards, "marca", { profiles: [] });
    expect(g.map((x) => x.grupo).sort()).toEqual(["ParisA", "ParisB"]);
  });

  it("modo marca hereda la marca del dueño cuando la card no tiene marca propia", () => {
    const cards = [card("a", null, "media", null, "u1"), card("b", null, "media", null, "u2")];
    const profiles = [profile("u1", "ParisA"), profile("u2", "ParisB")];
    const g = agruparCards(cards, "marca", { profiles });
    expect(g.map((x) => x.grupo).sort()).toEqual(["ParisA", "ParisB"]);
  });

  it("modo marca agrupa cards sin marca (propia ni heredada) en 'Sin marca' al final", () => {
    const cards = [card("a", null, "media", "ParisA", "u1"), card("b", null, "media", null, "u2")];
    const profiles = [profile("u2", null)];
    const g = agruparCards(cards, "marca", { profiles });
    expect(g.map((x) => x.grupo)).toEqual(["ParisA", "Sin marca"]);
    expect(g[1].cards.map((c) => c.title)).toEqual(["b"]);
  });
});
