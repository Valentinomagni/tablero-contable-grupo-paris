import { describe, it, expect } from "vitest";
import { reportesDirectos, equipoDe, visiblesPara, porMarca, puedeSerManager, cardsDeEquipo, puedeReasignar } from "./jerarquia";
import type { Card, Profile } from "./types";
const p = (id: string, role: Profile["role"], manager_id: string | null = null, marca: string | null = null): Profile =>
  ({ id, name: id, role, email: "", puesto: "", ficha: "", manager_id, marca });
const team = [
  p("jefe", "jefe"), p("enc", "encargado", "jefe", "Peugeot"),
  p("e1", "empleado", "enc", "Peugeot"), p("e2", "empleado", "enc", "Peugeot"),
  p("enc2", "encargado", "jefe", "Honda"), p("e3", "empleado", "enc2", "Honda"),
];
describe("reportesDirectos", () => {
  it("solo los reportes directos", () =>
    expect(reportesDirectos("enc", team).map(x => x.id)).toEqual(["e1", "e2"]));
});
describe("equipoDe", () => {
  it("incluye subárbol", () =>
    expect(equipoDe("jefe", team).map(x => x.id).sort()).toEqual(["e1", "e2", "e3", "enc", "enc2"]));
});
describe("visiblesPara", () => {
  it("empleado ve solo a sí mismo", () =>
    expect(visiblesPara(team[2], team).map(x => x.id)).toEqual(["e1"]));
  it("encargado ve a sí y su equipo", () =>
    expect(visiblesPara(team[1], team).map(x => x.id).sort()).toEqual(["e1", "e2", "enc"]));
  it("jefe ve a todos", () =>
    expect(visiblesPara(team[0], team).length).toBe(6));
});
describe("porMarca", () => {
  it("agrupa por marca", () =>
    expect(Object.keys(porMarca(team)).sort()).toEqual(["Honda", "Peugeot"]));
});
describe("puedeSerManager", () => {
  it("no puede ser su propio manager", () =>
    expect(puedeSerManager("enc", "enc", team)).toBe(false));
  it("no puede asignar un subordinado como manager (anti-ciclo)", () =>
    expect(puedeSerManager("e1", "enc", team)).toBe(false));
  it("no puede asignar un subordinado indirecto como manager", () =>
    expect(puedeSerManager("e3", "jefe", team)).toBe(false));
  it("puede asignar un manager válido fuera de su subárbol", () =>
    expect(puedeSerManager("enc2", "enc", team)).toBe(true));
  it("el jefe puede ser manager de cualquiera", () =>
    expect(puedeSerManager("jefe", "enc", team)).toBe(true));
});

const card = (id: string, owner: string): Card => ({
  id, owner, title: "t", status: "pend", description: "", checklist: [], comments: [], history: [],
  done_at: null, due_date: null, recurring: false, priority: "media", effort: 1,
  card_type: "normal", deps: [], created_at: "2026-07-01T00:00:00Z",
});
describe("cardsDeEquipo", () => {
  const cards = [card("a", "e1"), card("b", "e2"), card("c", "e3")];
  it("deja solo las cards cuyo dueño está en el equipo visible", () =>
    expect(cardsDeEquipo(cards, visiblesPara(team[1], team)).map(c => c.id).sort()).toEqual(["a", "b"]));
  it("team vacío => sin cards", () =>
    expect(cardsDeEquipo(cards, [])).toEqual([]));
  it("no muta el array original", () => {
    const n = cards.length; cardsDeEquipo(cards, team); expect(cards.length).toBe(n);
  });
});

describe("puedeReasignar", () => {
  const enc = team[1]; // encargado de Peugeot (e1, e2)
  const jefe = team[0];
  it("encargado reasigna entre miembros de su equipo", () =>
    expect(puedeReasignar(enc, "e1", "e2", team)).toBe(true));
  it("encargado NO reasigna hacia alguien fuera de su equipo", () =>
    expect(puedeReasignar(enc, "e1", "e3", team)).toBe(false));
  it("encargado NO reasigna una card de fuera de su equipo", () =>
    expect(puedeReasignar(enc, "e3", "e1", team)).toBe(false));
  it("origen y destino iguales => false", () =>
    expect(puedeReasignar(enc, "e1", "e1", team)).toBe(false));
  it("empleado nunca puede reasignar", () =>
    expect(puedeReasignar(team[2], "e1", "e2", team)).toBe(false));
  it("jefe puede reasignar entre cualesquiera", () =>
    expect(puedeReasignar(jefe, "e1", "e3", team)).toBe(true));
});
