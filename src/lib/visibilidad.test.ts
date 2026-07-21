import { describe, it, expect } from "vitest";
import { esVisible, personasVisibles } from "./visibilidad";
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
