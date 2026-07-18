import { describe, it, expect } from "vitest";
import { detectarMenciones } from "./menciones";

const team = [
  { id: "1", name: "Valentino Magni" },
  { id: "2", name: "Carolina Bruni" },
  { id: "3", name: "José Pérez" },
];

describe("detectarMenciones", () => {
  it("detecta por primer nombre", () => {
    expect(detectarMenciones("revisá esto @Valentino y @Carolina", team)).toEqual(["1", "2"]);
  });

  it("detecta por nombre completo", () => {
    expect(detectarMenciones("aviso a @Valentino Magni", team)).toEqual(["1"]);
  });

  it("es case-insensitive y sin tildes", () => {
    expect(detectarMenciones("hola @jose y @CAROLINA", team)).toEqual(["3", "2"]);
  });

  it("ignora un @Nadie que no matchea", () => {
    expect(detectarMenciones("che @Nadie mirá", team)).toEqual([]);
  });

  it("no duplica si se menciona dos veces", () => {
    expect(detectarMenciones("@Valentino @valentino @Valentino Magni", team)).toEqual(["1"]);
  });

  it("sin menciones devuelve vacío", () => {
    expect(detectarMenciones("comentario normal sin arrobas", team)).toEqual([]);
    expect(detectarMenciones("", team)).toEqual([]);
  });

  it("no matchea texto pegado que no arranca en @", () => {
    expect(detectarMenciones("email valentino@x.com", team)).toEqual([]);
  });
});
