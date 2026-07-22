import { describe, it, expect } from "vitest";
import { funcionNoExiste, combinarResultadosCards, idsDelServidor } from "./buscador";
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

describe("idsDelServidor (marca lo que ya filtró el full-text)", () => {
  it("marca TODO lo que devolvió el RPC, no sólo lo que no estaba en memoria", () => {
    // Una card ya cargada localmente puede haber matcheado por su DESCRIPCIÓN. Si no se
    // marcara, el filtro de substring del CommandPalette (que sólo mira título y sub) la
    // descartaría y el aporte del full-text se perdería.
    const ids = idsDelServidor([card("c1"), card("c9")]);
    expect(ids.has("c1")).toBe(true);
    expect(ids.has("c9")).toBe(true);
  });

  it("no marca lo que el servidor no devolvió", () => {
    expect(idsDelServidor([card("c1")]).has("c2")).toBe(false);
  });

  it("sin resultados del servidor no marca nada", () => {
    expect(idsDelServidor([]).size).toBe(0);
  });

  it("reproduce el bug: filtrar por substring descartaría un match por descripción", () => {
    // El RPC devuelve c9 porque el término aparece en su descripción; su título no lo tiene.
    const enMemoria = [card("c1")];
    const delServidor = [card("c9")];
    const combinadas = combinarResultadosCards(enMemoria, delServidor);
    const ids = idsDelServidor(delServidor);
    const needle = "monotributo";
    const items = combinadas
      .map((c) => ({ t: c.title, servidor: ids.has(c.id) }))
      .filter((i) => i.servidor || i.t.toLowerCase().includes(needle));
    expect(items.map((i) => i.t)).toEqual(["c9"]);
  });
});
