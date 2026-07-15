import { describe, it, expect } from "vitest";
import { closingCards, cierreStats, ordenarCierre, shiftMonth } from "./cierre";
import { marcaPlantilla } from "./plantilla";
import type { Card } from "./types";

function mk(p: Partial<Card>): Card {
  return {
    id: "c1", owner: "u1", title: "t", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2026-07-01T00:00:00Z", ...p,
  };
}
const marca = (y: number, m: number) => [{ who: "V", at: "2026-07-01T00:00:00Z", txt: marcaPlantilla(y, m) }];

describe("closingCards", () => {
  it("junta solo las tareas con la marca del mes pedido", () => {
    const cards = [
      mk({ id: "a", history: marca(2026, 7) }),
      mk({ id: "b", history: marca(2026, 7) }),
      mk({ id: "c", history: marca(2026, 6) }),   // otro mes
      mk({ id: "d" }),                             // sin marca
    ];
    expect(closingCards(cards, 2026, 7).map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("cierreStats", () => {
  it("cuenta estados, vencidas y % completado", () => {
    const closing = [
      mk({ status: "term", done_at: "2026-07-10T10:00:00Z", due_date: "2026-07-12" }), // a tiempo
      mk({ status: "term", done_at: "2026-07-15T10:00:00Z", due_date: "2026-07-10" }), // tarde
      mk({ status: "proc" }),
      mk({ status: "pend", due_date: "2020-01-01" }),                                   // vencida (pasado)
    ];
    const s = cierreStats(closing);
    expect(s.total).toBe(4);
    expect(s.done).toBe(2);
    expect(s.proc).toBe(1);
    expect(s.pend).toBe(1);
    expect(s.overdue).toBe(1);
    expect(s.pct).toBe(50);
    expect(s.onTimePct).toBe(50);
  });
  it("vacío da ceros y onTimePct null", () => {
    const s = cierreStats([]);
    expect(s.pct).toBe(0);
    expect(s.onTimePct).toBeNull();
  });
});

describe("ordenarCierre", () => {
  it("cerradas al final; abiertas por vencimiento ascendente", () => {
    const cards = [
      mk({ id: "term", status: "term" }),
      mk({ id: "sinFecha", status: "pend" }),
      mk({ id: "vieja", status: "pend", due_date: "2020-01-01" }),
    ];
    expect(ordenarCierre(cards).map((c) => c.id)).toEqual(["vieja", "sinFecha", "term"]);
  });
});

describe("shiftMonth", () => {
  it("avanza y retrocede cruzando el año", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 7, 0)).toEqual({ year: 2026, month: 7 });
  });
});
