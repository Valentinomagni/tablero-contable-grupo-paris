import { describe, it, expect } from "vitest";
import { curvaPersona, tendencia } from "./evolucion";
import type { CardArchive, Card } from "./types";

function card(over: Partial<Card>): Card {
  return {
    id: over.id ?? "c1", owner: over.owner ?? "u1", title: "t", status: over.status ?? "term",
    description: "", checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: over.card_type ?? "normal",
    deps: [], created_at: "",
  };
}

function archivo(mes: string, owner: string, c: Partial<Card>, id = `${mes}-${owner}-${Math.random()}`): CardArchive {
  return { id, owner, mes, card: card({ owner, ...c }), archived_at: "" };
}

describe("curvaPersona", () => {
  it("sin archives → curva vacía", () => {
    expect(curvaPersona([], "u1", 6)).toEqual([]);
  });

  it("solo cuenta archives de esa persona", () => {
    const archives = [
      archivo("2026-06", "u1", { status: "term" }),
      archivo("2026-06", "u2", { status: "pend" }),
    ];
    const r = curvaPersona(archives, "u1", 6);
    expect(r).toEqual([{ mes: "2026-06", cumplimiento: 100 }]);
  });

  it("excluye cards operativas", () => {
    const archives = [
      archivo("2026-06", "u1", { status: "term" }),
      archivo("2026-06", "u1", { status: "pend", card_type: "operativa" }),
    ];
    const r = curvaPersona(archives, "u1", 6);
    expect(r).toEqual([{ mes: "2026-06", cumplimiento: 100 }]);
  });

  it("orden ascendente por mes", () => {
    const archives = [
      archivo("2026-04", "u1", { status: "term" }),
      archivo("2026-02", "u1", { status: "term" }),
      archivo("2026-03", "u1", { status: "term" }),
    ];
    const r = curvaPersona(archives, "u1", 6);
    expect(r.map((x) => x.mes)).toEqual(["2026-02", "2026-03", "2026-04"]);
  });

  it("respeta la ventana de meses, anclada en el mes más reciente con datos", () => {
    const archives = [
      archivo("2026-01", "u1", { status: "term" }),
      archivo("2026-02", "u1", { status: "term" }),
      archivo("2026-03", "u1", { status: "term" }),
      archivo("2026-04", "u1", { status: "term" }),
    ];
    const r = curvaPersona(archives, "u1", 2);
    expect(r.map((x) => x.mes)).toEqual(["2026-03", "2026-04"]);
  });

  it("calcula el % de cumplimiento por mes", () => {
    const archives = [
      archivo("2026-06", "u1", { status: "term" }),
      archivo("2026-06", "u1", { status: "term" }),
      archivo("2026-06", "u1", { status: "pend" }),
      archivo("2026-06", "u1", { status: "proc" }),
    ];
    const r = curvaPersona(archives, "u1", 6);
    expect(r[0].cumplimiento).toBe(50);
  });
});

describe("tendencia", () => {
  it("sin datos → estable", () => {
    expect(tendencia([])).toBe("estable");
  });

  it("un solo mes → estable", () => {
    expect(tendencia([{ mes: "2026-06", cumplimiento: 80 }])).toBe("estable");
  });

  it("curva claramente ascendente → sube", () => {
    const curva = [
      { mes: "2026-01", cumplimiento: 40 },
      { mes: "2026-02", cumplimiento: 45 },
      { mes: "2026-03", cumplimiento: 80 },
      { mes: "2026-04", cumplimiento: 90 },
    ];
    expect(tendencia(curva)).toBe("sube");
  });

  it("curva claramente descendente → baja", () => {
    const curva = [
      { mes: "2026-01", cumplimiento: 90 },
      { mes: "2026-02", cumplimiento: 85 },
      { mes: "2026-03", cumplimiento: 45 },
      { mes: "2026-04", cumplimiento: 40 },
    ];
    expect(tendencia(curva)).toBe("baja");
  });

  it("variación de 3 puntos (dentro del umbral ±5) → estable", () => {
    const curva = [
      { mes: "2026-01", cumplimiento: 80 },
      { mes: "2026-02", cumplimiento: 81 },
      { mes: "2026-03", cumplimiento: 82 },
      { mes: "2026-04", cumplimiento: 83 },
    ];
    expect(tendencia(curva)).toBe("estable");
  });
});
