import { describe, it, expect } from "vitest";
import { tiempoMaxDe, estadoTiempo, incumplimientos, registrarIncumplimiento } from "./tiempos";
import type { Card, HistoryEntry } from "./types";

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

  it("done_at anterior a proc_at -> horas clampeadas a 0, no negativas", () => {
    const c = baseCard({ status: "term", proc_at: "2026-01-01T02:00:00.000Z", done_at: "2026-01-01T00:00:00.000Z", tiempo_max_horas: 3 });
    const est = estadoTiempo(c, {}, "2026-01-01T09:00:00.000Z");
    expect(est.horas).toBe(0);
    expect(est.excedido).toBe(false);
  });
});

describe("incumplimientos", () => {
  it("ninguna excedida -> lista vacía", () => {
    const cards = [
      baseCard({ id: "1", status: "proc", proc_at: "2026-01-01T00:00:00.000Z", tiempo_max_horas: 5 }),
      baseCard({ id: "2", status: "pend" }),
    ];
    expect(incumplimientos(cards, {}, "2026-01-01T02:00:00.000Z")).toEqual([]);
  });

  it("algunas excedidas -> devuelve solo esas", () => {
    const excedida = baseCard({ id: "1", status: "proc", proc_at: "2026-01-01T00:00:00.000Z", tiempo_max_horas: 1 });
    const enRango = baseCard({ id: "2", status: "proc", proc_at: "2026-01-01T00:00:00.000Z", tiempo_max_horas: 5 });
    const cards = [excedida, enRango];
    const result = incumplimientos(cards, {}, "2026-01-01T02:00:00.000Z");
    expect(result.map((c) => c.id)).toEqual(["1"]);
  });

  it("lista vacía -> lista vacía", () => {
    expect(incumplimientos([], {}, "2026-01-01T02:00:00.000Z")).toEqual([]);
  });
});

describe("registrarIncumplimiento", () => {
  const procAt = "2026-01-01T00:00:00.000Z";

  it("no excedido -> no agrega entrada", () => {
    const est = estadoTiempo(baseCard({ status: "term", proc_at: procAt, done_at: "2026-01-01T01:00:00.000Z", tiempo_max_horas: 5 }), {}, "2026-01-01T01:00:00.000Z");
    const h = registrarIncumplimiento([], est, "u1", "2026-01-01T01:00:00.000Z", procAt);
    expect(h).toEqual([]);
  });

  it("excedido sin registro previo -> agrega la entrada", () => {
    const est = estadoTiempo(baseCard({ status: "term", proc_at: procAt, done_at: "2026-01-01T04:00:00.000Z", tiempo_max_horas: 1 }), {}, "2026-01-01T04:00:00.000Z");
    const h = registrarIncumplimiento([], est, "u1", "2026-01-01T04:00:00.000Z", procAt);
    expect(h).toHaveLength(1);
    expect(h[0].txt).toMatch(/^Superó el tiempo máximo/);
  });

  it("ya hay un registro posterior a proc_at -> no duplica", () => {
    const est = estadoTiempo(baseCard({ status: "term", proc_at: procAt, done_at: "2026-01-01T04:00:00.000Z", tiempo_max_horas: 1 }), {}, "2026-01-01T04:00:00.000Z");
    const previa: HistoryEntry[] = [{ who: "u1", at: "2026-01-01T03:00:00.000Z", txt: "Superó el tiempo máximo (3.0h de 1h)" }];
    const h = registrarIncumplimiento(previa, est, "u1", "2026-01-01T04:00:00.000Z", procAt);
    expect(h).toEqual(previa);
  });

  it("reabierta con nuevo proc_at posterior al registro viejo -> agrega de nuevo", () => {
    const nuevoProcAt = "2026-01-02T00:00:00.000Z";
    const est = estadoTiempo(baseCard({ status: "term", proc_at: nuevoProcAt, done_at: "2026-01-02T04:00:00.000Z", tiempo_max_horas: 1 }), {}, "2026-01-02T04:00:00.000Z");
    const previa: HistoryEntry[] = [{ who: "u1", at: "2026-01-01T04:00:00.000Z", txt: "Superó el tiempo máximo (3.0h de 1h)" }];
    const h = registrarIncumplimiento(previa, est, "u1", "2026-01-02T04:00:00.000Z", nuevoProcAt);
    expect(h).toHaveLength(2);
  });
});
