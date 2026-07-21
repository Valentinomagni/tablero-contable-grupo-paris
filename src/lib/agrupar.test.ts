import { describe, it, expect } from "vitest";
import { agruparCards, carrilesPorGrupo } from "./agrupar";
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

const COLUMNAS = ["pend", "proc", "term"] as const;

describe("carrilesPorGrupo", () => {
  it("agrupa el conjunto completo y recién después reparte por estado", () => {
    const a = { ...card("a", "Bancos"), status: "term" } as Card;
    const b = { ...card("b", "Bancos"), status: "pend" } as Card;
    const c = { ...card("c", "Impuestos"), status: "proc" } as Card;
    const carriles = carrilesPorGrupo([a, b, c], "categoria", COLUMNAS, { profiles: [] });
    expect(carriles.map((x) => x.grupo)).toEqual(["Bancos", "Impuestos"]);
    expect(carriles[0].total).toBe(2);
    expect(carriles[0].porEstado.pend.map((x) => x.id)).toEqual(["b"]);
    expect(carriles[0].porEstado.term.map((x) => x.id)).toEqual(["a"]);
    expect(carriles[0].porEstado.proc).toEqual([]);
  });

  it("un grupo con todo terminado sigue existiendo, con pend y proc vacías", () => {
    const a = { ...card("a", "Bancos"), status: "term" } as Card;
    const carriles = carrilesPorGrupo([a], "categoria", COLUMNAS, { profiles: [] });
    expect(carriles).toHaveLength(1);
    expect(carriles[0].grupo).toBe("Bancos");
    expect(carriles[0].porEstado.pend).toEqual([]);
    expect(carriles[0].porEstado.proc).toEqual([]);
    expect(carriles[0].porEstado.term).toHaveLength(1);
  });

  it("el orden y la presencia de los carriles no cambian al mover una card de estado", () => {
    const cards = [card("a", "Bancos"), card("b", "Bancos"), card("c", "Impuestos")];
    const antes = carrilesPorGrupo(cards, "categoria", COLUMNAS, { profiles: [] });
    const movida = cards.map((c) => (c.id === "a" ? ({ ...c, status: "term" } as Card) : c));
    const despues = carrilesPorGrupo(movida, "categoria", COLUMNAS, { profiles: [] });
    expect(despues.map((x) => x.grupo)).toEqual(antes.map((x) => x.grupo));
    expect(despues.map((x) => x.total)).toEqual(antes.map((x) => x.total));
    expect(despues[0].porEstado.term.map((x) => x.id)).toEqual(["a"]);
  });

  it("no muta las cards ni les toca el estado", () => {
    const cards = [card("a", "Bancos"), card("b")];
    const copia = JSON.parse(JSON.stringify(cards));
    carrilesPorGrupo(cards, "categoria", COLUMNAS, { profiles: [] });
    expect(cards).toEqual(copia);
  });

  it("sin cards devuelve vacío", () => {
    expect(carrilesPorGrupo([], "categoria", COLUMNAS, { profiles: [] })).toEqual([]);
  });
});
