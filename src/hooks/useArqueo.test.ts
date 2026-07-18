import { describe, it, expect } from "vitest";
import { computeArqueoStats, cardsDeControl } from "./useArqueo";
import type { Card, TaskOccurrence } from "../lib/types";

const card = (id: string, requiere_resultado?: boolean): Card => ({
  id, owner: "u1", title: `Card ${id}`, status: "pend", description: "",
  checklist: [], comments: [], history: [], done_at: null, due_date: null,
  recurring: false, priority: "media", effort: 1, card_type: "normal",
  deps: [], created_at: "2026-07-01", requiere_resultado,
});

const occ = (card_id: string, resultado: "ok" | "dif", fecha = "2026-07-01"): TaskOccurrence => ({
  id: `${card_id}-${fecha}`, card_id, owner: "u1", fecha, done: true, done_at: "x", resultado,
});

describe("cardsDeControl", () => {
  it("solo cards con requiere_resultado === true", () => {
    expect(cardsDeControl([card("a", true), card("b"), card("c", false)]).map((c) => c.id)).toEqual(["a"]);
  });
  it("defensivo: sin migración 23 (undefined) → []", () => {
    expect(cardsDeControl([card("a"), card("b")])).toEqual([]);
  });
  it("acepta null/undefined", () => {
    expect(cardsDeControl(undefined as unknown as Card[])).toEqual([]);
  });
});

describe("computeArqueoStats", () => {
  it("arma { card, stats } por card de control, filtrando por card_id", () => {
    const cards = [card("caja1", true), card("normal"), card("caja2", true)];
    const occs = [
      occ("caja1", "ok"), occ("caja1", "ok", "2026-07-02"), occ("caja1", "dif", "2026-07-03"),
      occ("caja2", "ok"),
      occ("otra", "dif"), // de una card que no existe / no es control → ignorada
    ];
    const rows = computeArqueoStats(cards, occs, "2026-07");
    expect(rows.map((r) => r.card.id)).toEqual(["caja1", "caja2"]);
    expect(rows[0].stats.total).toBe(3);
    expect(rows[0].stats.ok).toBe(2);
    expect(rows[0].stats.dif).toBe(1);
    expect(rows[1].stats.total).toBe(1);
    expect(rows[1].stats.pctOk).toBe(100);
  });

  it("sin cards de control → []", () => {
    expect(computeArqueoStats([card("a"), card("b")], [], "2026-07")).toEqual([]);
  });

  it("defensivo: occs undefined no rompe", () => {
    const rows = computeArqueoStats([card("a", true)], undefined as unknown as TaskOccurrence[], "2026-07");
    expect(rows[0].stats.total).toBe(0);
  });
});
