import { describe, it, expect } from "vitest";
import { sharedLinkId, isShared, siblingIds, participantes, filasCompartida, siblingSyncPatches, SHARED_PREFIX } from "./shared";
import type { Card } from "./types";

function mk(p: Partial<Card>): Card {
  return {
    id: "c1", owner: "u1", title: "t", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2026-07-01T00:00:00Z", ...p,
  };
}
const link = (id: string) => [{ who: "J", at: "2026-07-01T00:00:00Z", txt: SHARED_PREFIX + id }];

describe("sharedLinkId / isShared", () => {
  it("lee el vínculo del historial", () => {
    expect(sharedLinkId(mk({ history: link("abc") }))).toBe("abc");
    expect(isShared(mk({ history: link("abc") }))).toBe(true);
  });
  it("null si no es compartida", () => {
    expect(sharedLinkId(mk({}))).toBeNull();
    expect(isShared(mk({}))).toBe(false);
  });
});

describe("siblingIds", () => {
  it("devuelve las hermanas del mismo vínculo, sin la propia", () => {
    const cards = [
      mk({ id: "a", owner: "u1", history: link("L") }),
      mk({ id: "b", owner: "u2", history: link("L") }),
      mk({ id: "c", owner: "u3", history: link("OTRO") }),
      mk({ id: "d", owner: "u4" }),
    ];
    expect(siblingIds(cards[0], cards)).toEqual(["b"]);
  });
});

describe("participantes", () => {
  it("nombres de todos los dueños del vínculo", () => {
    const cards = [mk({ id: "a", owner: "u1", history: link("L") }), mk({ id: "b", owner: "u2", history: link("L") })];
    expect(participantes(cards[0], cards, (id) => (id === "u1" ? "Jefe" : "Valentino"))).toEqual(["Jefe", "Valentino"]);
  });
});

describe("filasCompartida", () => {
  it("una fila por participante, con marca de vínculo y nota de delegación", () => {
    const filas = filasCompartida({
      linkId: "L1", title: "  Analizar cuenta 4110  ", owners: ["u1", "u2"], delegador: "Jefe 1",
      due_date: "2026-07-20", effort: 3, priority: "alta", at: "2026-07-15T10:00:00Z",
      nameOf: (id) => (id === "u1" ? "Jefe 1" : "Valentino"),
    });
    expect(filas).toHaveLength(2);
    expect(filas[0].title).toBe("Analizar cuenta 4110");
    expect(filas[0].owner).toBe("u1");
    expect(filas[1].owner).toBe("u2");
    expect(filas[0].history[0].txt).toBe(SHARED_PREFIX + "L1");
    expect(filas[0].history[1].txt).toContain("delegada por Jefe 1");
    expect(filas[0].history[1].txt).toContain("Jefe 1, Valentino");
  });
  it("trazabilidad: cada fila lleva la marca y el timestamp de quién delegó (spec #4)", () => {
    const filas = filasCompartida({
      linkId: "L2", title: "Conciliar banco", owners: ["u1", "u2"], delegador: "Valentino",
      due_date: null, effort: 2, priority: "media", at: "2026-07-16T14:30:00Z",
      nameOf: () => "X",
    });
    for (const f of filas) {
      expect(f.history.some((h) => h.txt.startsWith(SHARED_PREFIX))).toBe(true);
      for (const h of f.history) {
        expect(h.who).toBe("Valentino");
        expect(h.at).toBe("2026-07-16T14:30:00Z"); // fecha y hora exactas de la delegación
      }
    }
  });
});

describe("siblingSyncPatches", () => {
  it("marca terminadas las hermanas que difieren, con done_at", () => {
    const cards = [
      mk({ id: "a", history: link("L"), status: "term" }),
      mk({ id: "b", history: link("L"), status: "pend" }),
      mk({ id: "c", history: link("L"), status: "term" }), // ya term: no se toca
    ];
    const patches = siblingSyncPatches(cards[0], cards, "term", "2026-07-15T10:00:00Z");
    expect(patches).toEqual([{ id: "b", patch: { status: "term", done_at: "2026-07-15T10:00:00Z" } }]);
  });
  it("reabrir pone done_at null en las hermanas", () => {
    const cards = [mk({ id: "a", history: link("L"), status: "proc" }), mk({ id: "b", history: link("L"), status: "term" })];
    expect(siblingSyncPatches(cards[0], cards, "proc", "x")).toEqual([{ id: "b", patch: { status: "proc", done_at: null } }]);
  });
  it("vacío si no es compartida", () => {
    expect(siblingSyncPatches(mk({ id: "a" }), [], "term", "x")).toEqual([]);
  });
});
