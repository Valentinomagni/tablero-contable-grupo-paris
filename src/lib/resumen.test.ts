import { describe, it, expect } from "vitest";
import { csvCell, buildCsv, standupText, cicloDelMes, cargaPorFecha } from "./resumen";
import type { Card, Snapshot } from "./types";

function mkCard(p: Partial<Card>): Card {
  return {
    id: "c1", owner: "u1", title: "t", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2020-01-01T00:00:00Z", ...p,
  };
}
const NOW = new Date("2020-03-01T12:00:00Z").getTime();

describe("csvCell", () => {
  it("escapa comillas y neutraliza fórmulas de Excel", () => {
    expect(csvCell('di"jo')).toBe('"di""jo"');
    expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');
    expect(csvCell("+54 9")).toBe('"\'+54 9"');
    expect(csvCell(null)).toBe('""');
  });
});

describe("buildCsv", () => {
  it("BOM + header + una fila por card con ; como separador", () => {
    const csv = buildCsv([mkCard({ title: "Tarea X" })], [], () => "Ana");
    const lines = csv.split("\r\n");
    expect(lines[0].startsWith("﻿Persona;Tarea")).toBe(true);
    expect(lines[1]).toContain('"Ana";"Tarea X";"Pendiente"');
  });
});

describe("standupText", () => {
  it("lista terminadas de 24h y bloqueadas; vacíos con (ninguna)", () => {
    const cards = [
      mkCard({ id: "a", title: "Hecha", status: "term", done_at: "2020-03-01T08:00:00Z" }),
      mkCard({ id: "b", title: "Vieja", status: "term", done_at: "2020-02-20T08:00:00Z" }),
      mkCard({ id: "c", title: "Trabada" }),
    ];
    const txt = standupText(cards, [], () => "Ana", new Set(["c"]), NOW);
    expect(txt).toContain("• Hecha — Ana");
    expect(txt).not.toContain("Vieja");
    expect(txt).toContain("• Trabada — Ana");
    expect(txt).toContain("• (sin registros)");
  });
});

describe("cicloDelMes", () => {
  it("acumula esfuerzo por día del mes y detecta concentración en Q1", () => {
    const cards = [
      mkCard({ id: "a", done_at: "2020-01-05T10:00:00Z", effort: 5 }),
      mkCard({ id: "b", done_at: "2020-02-05T10:00:00Z", effort: 5 }),
      mkCard({ id: "c", done_at: "2020-02-25T10:00:00Z", effort: 2 }),
      mkCard({ id: "d", done_at: "2020-02-25T10:00:00Z", card_type: "operativa", effort: 9 }), // excluida
    ];
    const r = cicloDelMes(cards);
    expect(r.porDia[4]).toBe(10);
    expect(r.porDia[24]).toBe(2);
    expect(r.total).toBe(12);
    expect(r.pctQ1).toBe(83);
    expect(r.insight).toContain("primera quincena");
  });
  it("total 0 sin historial", () => {
    expect(cicloDelMes([]).total).toBe(0);
  });
});

describe("cargaPorFecha", () => {
  it("suma open_effort por día y ordena", () => {
    const snaps = [
      { day: "2020-02-02", owner: "u1", open_count: 1, open_effort: 3, done_count: 0, done_effort: 0, activity_qty: 0 },
      { day: "2020-02-01", owner: "u1", open_count: 1, open_effort: 2, done_count: 0, done_effort: 0, activity_qty: 0 },
      { day: "2020-02-01", owner: "u2", open_count: 1, open_effort: 4, done_count: 0, done_effort: 0, activity_qty: 0 },
    ] as Snapshot[];
    expect(cargaPorFecha(snaps)).toEqual([{ day: "2020-02-01", v: 6 }, { day: "2020-02-02", v: 3 }]);
  });
});
