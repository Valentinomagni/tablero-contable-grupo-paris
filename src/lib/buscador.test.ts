import { describe, it, expect } from "vitest";
import { funcionNoExiste, combinarResultadosCards } from "./buscador";
import type { Card } from "./types";

const card = (id: string): Card => ({ id, title: id } as Card);

describe("funcionNoExiste", () => {
  it("detecta PGRST202 (RPC no expuesta)", () => {
    expect(funcionNoExiste({ code: "PGRST202" })).toBe(true);
  });
  it("detecta 42883 (función no existe en Postgres)", () => {
    expect(funcionNoExiste({ code: "42883" })).toBe(true);
  });
  it("no confunde con PGRST205 (tabla inexistente)", () => {
    expect(funcionNoExiste({ code: "PGRST205" })).toBe(false);
  });
  it("null/undefined -> false", () => {
    expect(funcionNoExiste(null)).toBe(false);
    expect(funcionNoExiste(undefined)).toBe(false);
  });
});

describe("combinarResultadosCards", () => {
  it("mantiene el orden de memoria y agrega las nuevas del servidor al final", () => {
    const memoria = [card("a"), card("b")];
    const servidor = [card("c"), card("b"), card("a")];
    expect(combinarResultadosCards(memoria, servidor).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("sin resultados del servidor devuelve la memoria intacta", () => {
    const memoria = [card("a")];
    expect(combinarResultadosCards(memoria, [])).toEqual(memoria);
  });

  it("sin nada en memoria devuelve todo lo del servidor", () => {
    const servidor = [card("x"), card("y")];
    expect(combinarResultadosCards([], servidor)).toEqual(servidor);
  });

  it("no duplica por id aunque el servidor traiga todo repetido", () => {
    const memoria = [card("a"), card("b")];
    const servidor = [card("a"), card("b")];
    expect(combinarResultadosCards(memoria, servidor)).toEqual(memoria);
  });
});
