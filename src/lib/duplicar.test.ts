import { describe, it, expect } from "vitest";
import { filaDuplicada } from "./duplicar";
import type { Card } from "./types";

const base: Card = {
  id: "c1", owner: "u1", title: "Conciliación bancaria", status: "term",
  description: "Banco Nación", checklist: [
    { txt: "Bajar extracto", done: true, done_at: "2026-07-01T10:00:00Z" },
    { txt: "Cruzar movimientos", done: false, done_at: null },
  ],
  comments: [{ who: "Ana", when: "2026-07-02T09:00:00Z", txt: "falta el extracto" }],
  history: [{ who: "Ana", at: "2026-06-01T09:00:00Z", txt: "Creó la tarea" }],
  done_at: "2026-07-03T12:00:00Z", due_date: "2026-07-10", recurring: false,
  priority: "alta", effort: 3, card_type: "normal", deps: ["otra-card"],
  created_at: "2026-06-01T09:00:00Z", categoria: "Bancos",
};

describe("filaDuplicada", () => {
  const fila = filaDuplicada(base, "Vale", "2026-07-16T10:00:00Z");

  it("agrega el sufijo (copia) al título y nace pendiente", () => {
    expect(fila.title).toBe("Conciliación bancaria (copia)");
    expect(fila.status).toBe("pend");
  });

  it("resetea el done del checklist conservando los ítems", () => {
    expect(fila.checklist).toHaveLength(2);
    expect(fila.checklist.every((i) => !i.done && i.done_at === null)).toBe(true);
    expect(fila.checklist.map((i) => i.txt)).toEqual(["Bajar extracto", "Cruzar movimientos"]);
  });

  it("no copia comments ni deps", () => {
    expect(fila.comments).toEqual([]);
    expect(fila.deps).toEqual([]);
  });

  it("conserva atributos y arranca el historial con la traza de duplicado", () => {
    expect(fila.owner).toBe("u1");
    expect(fila.priority).toBe("alta");
    expect(fila.effort).toBe(3);
    expect(fila.categoria).toBe("Bancos");
    expect(fila.history).toEqual([{ who: "Vale", at: "2026-07-16T10:00:00Z", txt: 'Creada duplicando "Conciliación bancaria"' }]);
  });

  it("es defensiva con checklist ausente y categoria/recur_rule undefined", () => {
    const f = filaDuplicada({ ...base, checklist: undefined as unknown as Card["checklist"], categoria: undefined, recur_rule: undefined }, "Vale", "2026-07-16T10:00:00Z");
    expect(f.checklist).toEqual([]);
    expect(f.categoria).toBeNull();
    expect(f.recur_rule).toBeNull();
  });
});
