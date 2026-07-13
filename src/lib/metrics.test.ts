import { describe, it, expect } from "vitest";
import { kpiPct, kpiClass, toARTDate, saludScore, userMetrics30d } from "./metrics";
import type { Card, Objective, ActivityLog } from "./types";

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

const NOW = new Date("2020-03-01T12:00:00Z").getTime(); // fecha fija del pasado

function mkCard(p: Partial<Card>): Card {
  return {
    id: "c1", owner: "u1", title: "t", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2020-01-01T00:00:00Z", ...p,
  };
}
function mkObj(p: Partial<Objective>): Objective {
  return {
    id: "o1", owner: "u1", title: "obj", description: "", weight: 0,
    kpi_name: "", kpi_unit: "", kpi_target: null, kpi_current: 0, notes: "", ...p,
  };
}

describe("userMetrics30d", () => {
  it("cuenta cerradas 30d, esfuerzo y % a tiempo; excluye operativas y otros dueños", () => {
    const cards: Card[] = [
      mkCard({ id: "a", status: "term", done_at: "2020-02-20T10:00:00Z", due_date: "2020-02-21", effort: 3 }), // a tiempo
      mkCard({ id: "b", status: "term", done_at: "2020-02-25T10:00:00Z", due_date: "2020-02-20", effort: 2 }), // tarde
      mkCard({ id: "c", status: "term", done_at: "2019-12-01T10:00:00Z", effort: 5 }),                          // fuera de 30d
      mkCard({ id: "d", status: "term", done_at: "2020-02-22T10:00:00Z", card_type: "operativa" }),             // operativa: excluida
      mkCard({ id: "e", status: "term", done_at: "2020-02-22T10:00:00Z", owner: "u2" }),                        // otro dueño
      mkCard({ id: "f", status: "proc" }),                                                                       // abierta
    ];
    const m = userMetrics30d(cards, [], [], "u1", NOW);
    expect(m.done30).toBe(2);
    expect(m.effort30).toBe(5);
    expect(m.onTimePct).toBe(50);
    expect(m.openToday).toBe(1);
  });

  it("onTimePct es null sin cerradas con vencimiento", () => {
    const cards = [mkCard({ status: "term", done_at: "2020-02-20T10:00:00Z" })];
    expect(userMetrics30d(cards, [], [], "u1", NOW).onTimePct).toBeNull();
  });

  it("peso de objetivos y rendimiento ponderado con tope 120", () => {
    const objs: Objective[] = [
      mkObj({ id: "o1", weight: 60, kpi_target: 10, kpi_current: 15 }), // 150% → capea a 120
      mkObj({ id: "o2", weight: 40, kpi_target: 10, kpi_current: 5 }),  // 50%
      mkObj({ id: "o3", owner: "u2", weight: 100 }),                    // otro dueño
    ];
    const m = userMetrics30d([], objs, [], "u1", NOW);
    expect(m.objWeight).toBe(100);
    expect(m.kpiPerf).toBe(92); // (120*60 + 50*40) / 100
  });

  it("kpiPerf es null sin KPIs medibles", () => {
    expect(userMetrics30d([], [mkObj({ weight: 50 })], [], "u1", NOW).kpiPerf).toBeNull();
  });

  it("suma actividad operativa de 30d del dueño", () => {
    const act: ActivityLog[] = [
      { id: "1", card_id: "x", owner: "u1", who_name: "V", qty: 3, note: "", at: "2020-02-25T10:00:00Z" },
      { id: "2", card_id: "x", owner: "u1", who_name: "V", qty: 4, note: "", at: "2019-12-01T10:00:00Z" }, // vieja
      { id: "3", card_id: "x", owner: "u2", who_name: "O", qty: 9, note: "", at: "2020-02-25T10:00:00Z" }, // otro
    ];
    expect(userMetrics30d([], [], act, "u1", NOW).activity30).toBe(3);
  });
});
