import { describe, it, expect } from "vitest";
import { kpiPct, kpiClass, toARTDate, saludScore } from "./metrics";
import type { Card } from "./types";

describe("kpiPct", () => {
  it("divide actual/meta a porcentaje", () =>
    expect(kpiPct({ kpi_current: 8, kpi_target: 10 })).toBe(80));
  it("null si meta 0 o nula", () =>
    expect(kpiPct({ kpi_current: 5, kpi_target: 0 })).toBeNull());
});

describe("kpiClass", () => {
  it("verde entre 80 y 100", () => expect(kpiClass(90)).toBe("kpi-verde"));
  it("rojo bajo 50", () => expect(kpiClass(30)).toBe("kpi-rojo"));
  it("azul si supera la meta", () => expect(kpiClass(120)).toBe("kpi-azul"));
});

describe("toARTDate (regresión bug timezone)", () => {
  it("un instante UTC de la noche cae en el día ART correcto (UTC-3)", () =>
    // 02:00 UTC del 11 = 23:00 ART del 10
    expect(toARTDate("2026-07-11T02:00:00Z")).toBe("2026-07-10"));
  it("mediodía UTC se mantiene el mismo día", () =>
    expect(toARTDate("2026-07-11T12:00:00Z")).toBe("2026-07-11"));
});

describe("saludScore", () => {
  it("100 sin tareas", () => expect(saludScore([], [])).toBe(100));
  it("penaliza vencidas", () => {
    // fecha claramente en el pasado (robusto ante zona horaria)
    const vencida = { due_date: "2020-01-01", done_at: null } as Card;
    expect(saludScore([vencida], [])).toBe(92); // 100 - 8
  });
});
