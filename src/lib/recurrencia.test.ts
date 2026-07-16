import { describe, it, expect } from "vitest";
import { ocurrenciasDelMes, ocurrenciasFaltantes, occIdentity, occUpsertRow, OCC_CONFLICT } from "./recurrencia";

describe("ocurrenciasDelMes", () => {
  it("diaria: todos los días del mes", () =>
    expect(ocurrenciasDelMes({ tipo: "diaria" }, 2026, 2).length).toBe(28));
  it("semanal jueves (dia 4) de julio 2026", () => // jul 2026: jueves 2,9,16,23,30
    expect(ocurrenciasDelMes({ tipo: "semanal", dias: [4] }, 2026, 7)).toEqual(
      ["2026-07-02", "2026-07-09", "2026-07-16", "2026-07-23", "2026-07-30"]));
  it("mensual día 20", () =>
    expect(ocurrenciasDelMes({ tipo: "mensual", diaMes: 20 }, 2026, 7)).toEqual(["2026-07-20"]));
  it("semanal sin días definidos: vacío", () =>
    expect(ocurrenciasDelMes({ tipo: "semanal" }, 2026, 7)).toEqual([]));
  it("mensual día 31 en un mes de 30: se omite (no desborda al mes siguiente)", () =>
    expect(ocurrenciasDelMes({ tipo: "mensual", diaMes: 31 }, 2026, 6)).toEqual([]));
  it("diaria: no corre el día por zona horaria (primer día es 01)", () =>
    expect(ocurrenciasDelMes({ tipo: "diaria" }, 2026, 3)[0]).toBe("2026-03-01"));
});

describe("ocurrenciasFaltantes", () => {
  it("sin existentes: devuelve todas las de la regla", () =>
    expect(ocurrenciasFaltantes({ tipo: "mensual", diaMes: 20 }, 2026, 7, [])).toEqual(["2026-07-20"]));
  it("con la fecha ya materializada: no la repite (idempotente)", () =>
    expect(ocurrenciasFaltantes({ tipo: "semanal", dias: [4] }, 2026, 7, ["2026-07-02", "2026-07-09"]))
      .toEqual(["2026-07-16", "2026-07-23", "2026-07-30"]));
  it("todas presentes: vacío", () =>
    expect(ocurrenciasFaltantes({ tipo: "mensual", diaMes: 20 }, 2026, 7, ["2026-07-20"])).toEqual([]));
});

describe("fuente única: calendario y checklist tocan la misma fila (card_id+fecha)", () => {
  it("una ocurrencia existente y la fila que insertaría el otro camino comparten identidad", () => {
    const existente = { card_id: "card-1", fecha: "2026-07-02", done: false };
    const nueva = occUpsertRow("card-1", "owner-9", "2026-07-02");
    expect(occIdentity(nueva)).toBe(occIdentity(existente));
  });
  it("distinta fecha o card = distinta fila", () => {
    expect(occIdentity({ card_id: "a", fecha: "2026-07-02" }))
      .not.toBe(occIdentity({ card_id: "a", fecha: "2026-07-03" }));
    expect(occIdentity({ card_id: "a", fecha: "2026-07-02" }))
      .not.toBe(occIdentity({ card_id: "b", fecha: "2026-07-02" }));
  });
  it("el conflict target del upsert es la clave única de la tabla", () =>
    expect(OCC_CONFLICT).toBe("card_id,fecha"));
});
