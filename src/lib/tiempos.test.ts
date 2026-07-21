import { describe, it, expect } from "vitest";
import { tiempoMaxDe, estadoTiempo } from "./tiempos";
import type { Card } from "./types";

function baseCard(over: Partial<Card> = {}): Card {
  return {
    id: "1", owner: "u1", title: "t", status: "pend", description: "",
    checklist: [], comments: [], history: [],
    done_at: null, due_date: null, recurring: false,
    priority: "media", effort: 1, card_type: "normal", deps: [],
    created_at: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("tiempoMaxDe", () => {
  it("sin config ni campo propio -> null", () => {
    const c = baseCard();
    expect(tiempoMaxDe(c, {})).toBeNull();
  });

  it("config por categoría aplicada", () => {
    const c = baseCard({ categoria: "Facturación" });
    expect(tiempoMaxDe(c, { "Facturación": 4 })).toBe(4);
  });

  it("campo por tarea pisa la config", () => {
    const c = baseCard({ categoria: "Facturación", tiempo_max_horas: 2 });
    expect(tiempoMaxDe(c, { "Facturación": 4 })).toBe(2);
  });
});

describe("estadoTiempo", () => {
  it("en proceso dentro del límite", () => {
    const c = baseCard({ status: "proc", proc_at: "2026-01-01T00:00:00.000Z", tiempo_max_horas: 5 });
    const est = estadoTiempo(c, {}, "2026-01-01T02:00:00.000Z");
    expect(est.excedido).toBe(false);
    expect(est.horas).toBe(2);
    expect(est.maxHoras).toBe(5);
  });

  it("en proceso excedido", () => {
    const c = baseCard({ status: "proc", proc_at: "2026-01-01T00:00:00.000Z", tiempo_max_horas: 1 });
    const est = estadoTiempo(c, {}, "2026-01-01T02:00:00.000Z");
    expect(est.excedido).toBe(true);
    expect(est.horas).toBe(2);
  });

  it("terminada dentro del límite", () => {
    const c = baseCard({ status: "term", proc_at: "2026-01-01T00:00:00.000Z", done_at: "2026-01-01T01:00:00.000Z", tiempo_max_horas: 3 });
    const est = estadoTiempo(c, {}, "2026-01-01T05:00:00.000Z");
    expect(est.excedido).toBe(false);
    expect(est.horas).toBe(1);
  });

  it("terminada excedida", () => {
    const c = baseCard({ status: "term", proc_at: "2026-01-01T00:00:00.000Z", done_at: "2026-01-01T04:00:00.000Z", tiempo_max_horas: 3 });
    const est = estadoTiempo(c, {}, "2026-01-01T09:00:00.000Z");
    expect(est.excedido).toBe(true);
    expect(est.horas).toBe(4);
  });

  it("pendiente -> todo null", () => {
    const c = baseCard({ status: "pend", tiempo_max_horas: 3 });
    const est = estadoTiempo(c, {}, "2026-01-01T09:00:00.000Z");
    expect(est.horas).toBeNull();
    expect(est.excedido).toBe(false);
    expect(est.restanteHoras).toBeNull();
  });

  it("proc_at ausente en card proc (base vieja) -> null sin crashear", () => {
    const c = baseCard({ status: "proc", tiempo_max_horas: 3 });
    const est = estadoTiempo(c, {}, "2026-01-01T09:00:00.000Z");
    expect(est.horas).toBeNull();
    expect(est.excedido).toBe(false);
  });

  it("sin config ni campo -> maxHoras null y nunca excedido", () => {
    const c = baseCard({ status: "proc", proc_at: "2026-01-01T00:00:00.000Z" });
    const est = estadoTiempo(c, {}, "2026-01-01T09:00:00.000Z");
    expect(est.maxHoras).toBeNull();
    expect(est.excedido).toBe(false);
  });
});
