import { describe, it, expect } from "vitest";
import { esVisible, personasVisibles, cardsVisibles } from "./visibilidad";
import type { Profile } from "./types";

const p = (id: string, email: string, oculto?: boolean): Profile =>
  ({ id, name: id, role: "empleado", email, username: null, puesto: "", ficha: "", manager_id: null, marca: null, oculto });

describe("esVisible", () => {
  it("perfil normal es visible", () => {
    expect(esVisible(p("u1", "u1@grupoparis.com"))).toBe(true);
  });
  it("oculto: true no es visible", () => {
    expect(esVisible(p("u1", "u1@grupoparis.com", true))).toBe(false);
  });
  it("el centinela sin-asignar no es visible", () => {
    expect(esVisible(p("sin-asignar", "sin-asignar@grupoparis.com"))).toBe(false);
  });
  it("oculto undefined (base sin migración 29) es visible", () => {
    expect(esVisible(p("u1", "u1@grupoparis.com", undefined))).toBe(true);
  });
  it("oculto: false explícito (valor real tras la migración 29) es visible", () => {
    expect(esVisible(p("u1", "u1@grupoparis.com", false))).toBe(true);
  });
});

describe("personasVisibles", () => {
  it("filtra ocultos y sin-asignar conservando el orden", () => {
    const ps = [
      p("u1", "u1@grupoparis.com"),
      p("u2", "u2@grupoparis.com", true),
      p("sin-asignar", "sin-asignar@grupoparis.com"),
      p("u3", "u3@grupoparis.com"),
    ];
    expect(personasVisibles(ps).map((x) => x.id)).toEqual(["u1", "u3"]);
  });
});

describe("cardsVisibles", () => {
  const c = (id: string, owner: string) => ({ id, owner });
  const profiles = [
    p("u1", "u1@grupoparis.com"),
    p("u2", "u2@grupoparis.com", true),
    p("sin-asignar", "sin-asignar@grupoparis.com"),
  ];

  it("excluye solo las cards del owner oculto", () => {
    const cards = [c("c1", "u1"), c("c2", "u2"), c("c3", "sin-asignar")];
    expect(cardsVisibles(cards, profiles).map((x) => x.id)).toEqual(["c1", "c3"]);
  });

  it("conserva las cards de 'Sin asignar' (huérfanas reales, no ocultarlas)", () => {
    const cards = [c("c1", "sin-asignar")];
    expect(cardsVisibles(cards, profiles).map((x) => x.id)).toEqual(["c1"]);
  });

  it("sin perfiles ocultos, no filtra nada", () => {
    const cards = [c("c1", "u1"), c("c2", "u3")];
    expect(cardsVisibles(cards, [p("u1", "u1@grupoparis.com")]).map((x) => x.id)).toEqual(["c1", "c2"]);
  });
});
