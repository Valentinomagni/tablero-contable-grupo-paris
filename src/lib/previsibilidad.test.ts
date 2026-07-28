import { describe, it, expect } from "vitest";
import { previsibilidad } from "./previsibilidad";
import type { Card } from "./types";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "T", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: "2026-07-20",
    recurring: false, priority: "media", effort: 2, card_type: "normal", deps: [],
    created_at: "2026-06-15T00:00:00Z", ...over,
  };
}

describe("previsibilidad", () => {
  it("creada ANTES del mes que vence → planificada", () => {
    const r = previsibilidad([card({ created_at: "2026-06-15T00:00:00Z", due_date: "2026-07-20" })], "2026-07");
    expect(r.planificadas).toBe(1);
    expect(r.imprevistas).toBe(0);
  });
  it("creada DENTRO del mes que vence → imprevista", () => {
    const r = previsibilidad([card({ created_at: "2026-07-18T00:00:00Z", due_date: "2026-07-20" })], "2026-07");
    expect(r.imprevistas).toBe(1);
  });
  it("calcula el porcentaje planificado", () => {
    const r = previsibilidad([
      card({ created_at: "2026-06-01T00:00:00Z" }),
      card({ created_at: "2026-06-01T00:00:00Z" }),
      card({ created_at: "2026-07-10T00:00:00Z" }),
      card({ created_at: "2026-07-10T00:00:00Z" }),
    ], "2026-07");
    expect(r.total).toBe(4);
    expect(r.pctPlanificado).toBe(50);
  });
  it("avisa cuando las urgencias superan a lo planificado", () => {
    const r = previsibilidad([
      card({ created_at: "2026-07-10T00:00:00Z" }),
      card({ created_at: "2026-07-11T00:00:00Z" }),
      card({ created_at: "2026-06-01T00:00:00Z" }),
    ], "2026-07");
    expect(r.alerta).toBe(true);
  });
  it("no avisa cuando la mayoría estaba planificada", () => {
    const r = previsibilidad([
      card({ created_at: "2026-06-01T00:00:00Z" }),
      card({ created_at: "2026-06-02T00:00:00Z" }),
      card({ created_at: "2026-07-10T00:00:00Z" }),
    ], "2026-07");
    expect(r.alerta).toBe(false);
  });
  it("ignora las tareas sin vencimiento (no se pueden planificar)", () => {
    expect(previsibilidad([card({ due_date: null })], "2026-07").total).toBe(0);
  });
  it("ignora las operativas (son a demanda por definición)", () => {
    expect(previsibilidad([card({ card_type: "operativa" })], "2026-07").total).toBe(0);
  });
  it("sin datos devuelve ceros sin dividir por cero", () => {
    const r = previsibilidad([], "2026-07");
    expect(r).toEqual({ planificadas: 0, imprevistas: 0, total: 0, pctPlanificado: 0, alerta: false });
  });
  it("es defensiva ante entradas no-array", () => {
    expect(previsibilidad(null as unknown as Card[], "2026-07").total).toBe(0);
  });
});
