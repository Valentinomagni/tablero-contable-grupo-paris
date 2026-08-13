import { describe, it, expect } from "vitest";
import { avanceDelMes } from "./arqueo-mensual";
import type { TaskOccurrence } from "./types";

/** Una ocurrencia con lo mínimo que mira la función. */
function occ(fecha: string, done: boolean): TaskOccurrence {
  return { id: fecha, card_id: "c1", owner: "u1", fecha, done, done_at: done ? `${fecha}T12:00:00Z` : null };
}

describe("avance del arqueo del mes", () => {
  it("cuenta sobre los días hábiles, no sobre los días corridos", () => {
    // Lo que pidió Patricia: "X de 24", no "6 de 31".
    const habiles = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"];
    const occs = [occ("2026-08-03", true), occ("2026-08-04", true)];
    expect(avanceDelMes(occs, habiles)).toEqual({ hechos: 2, total: 4, pct: 50 });
  });

  it("un arqueo cargado un domingo no infla el avance", () => {
    // El domingo no está en la lista de hábiles, así que no suma ni al numerador ni al
    // denominador. Si sumara al numerador, el avance podría pasar del 100%.
    const habiles = ["2026-08-03", "2026-08-04"];
    const occs = [occ("2026-08-02", true), occ("2026-08-03", true)];
    expect(avanceDelMes(occs, habiles)).toEqual({ hechos: 1, total: 2, pct: 50 });
  });

  it("los días sin tildar no cuentan", () => {
    const habiles = ["2026-08-03", "2026-08-04", "2026-08-05"];
    const occs = [occ("2026-08-03", true), occ("2026-08-04", false)];
    expect(avanceDelMes(occs, habiles)).toEqual({ hechos: 1, total: 3, pct: 33 });
  });

  it("un día repetido se cuenta una sola vez", () => {
    // `task_occurrences` tiene índice único por (card_id, fecha), pero esta función puede
    // recibir las ocurrencias de VARIAS tarjetas de arqueo. Contar dos veces el mismo día
    // daría más de 100%.
    const habiles = ["2026-08-03", "2026-08-04"];
    const occs = [occ("2026-08-03", true), occ("2026-08-03", true)];
    expect(avanceDelMes(occs, habiles)).toEqual({ hechos: 1, total: 2, pct: 50 });
  });

  it("el mes completo da 100", () => {
    const habiles = ["2026-08-03", "2026-08-04"];
    expect(avanceDelMes([occ("2026-08-03", true), occ("2026-08-04", true)], habiles))
      .toEqual({ hechos: 2, total: 2, pct: 100 });
  });

  it("sin días hábiles no divide por cero", () => {
    expect(avanceDelMes([], [])).toEqual({ hechos: 0, total: 0, pct: 0 });
  });

  it("sin ocurrencias da 0, no NaN", () => {
    expect(avanceDelMes([], ["2026-08-03"])).toEqual({ hechos: 0, total: 1, pct: 0 });
  });

  it("aguanta datos rotos sin explotar", () => {
    // `task_occurrences` llega de la base: puede venir null o con filas incompletas. Que una
    // fila mal formada tumbe el tablero de Patricia sería mucho peor que mostrar 0.
    expect(avanceDelMes(null as never, ["2026-08-03"])).toEqual({ hechos: 0, total: 1, pct: 0 });
    expect(avanceDelMes([{} as never], ["2026-08-03"])).toEqual({ hechos: 0, total: 1, pct: 0 });
    expect(avanceDelMes([occ("2026-08-03", true)], null as never)).toEqual({ hechos: 0, total: 0, pct: 0 });
  });

  it("el porcentaje se redondea, no se trunca", () => {
    // 2 de 3 es 66,67. Truncar daría 66 y el mes cerrado con todo hecho podría mostrar 99.
    const habiles = ["a", "b", "c"];
    const occs = [occ("a", true), occ("b", true)];
    expect(avanceDelMes(occs, habiles).pct).toBe(67);
  });
});
