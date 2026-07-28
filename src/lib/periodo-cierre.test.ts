import { describe, it, expect } from "vitest";
import { periodoCerrado, periodosCerradosDe } from "./periodo-cierre";
import type { CierrePeriodo } from "./types";

const cierre = (owner: string, mes: string): CierrePeriodo =>
  ({ id: `${owner}-${mes}`, owner, mes, cerrado_at: "2026-08-01T10:00:00Z", nota: null });

describe("periodoCerrado", () => {
  it("true si esa persona cerró ese mes", () => {
    expect(periodoCerrado([cierre("u1", "2026-07")], "u1", "2026-07")).toBe(true);
  });
  it("el cierre es POR PERSONA: el de otro no cierra el mío", () => {
    expect(periodoCerrado([cierre("u2", "2026-07")], "u1", "2026-07")).toBe(false);
  });
  it("el cierre es POR MES: cerrar julio no cierra agosto", () => {
    expect(periodoCerrado([cierre("u1", "2026-07")], "u1", "2026-08")).toBe(false);
  });
  it("sin cierres, nada está cerrado", () => {
    expect(periodoCerrado([], "u1", "2026-07")).toBe(false);
  });
  it("es defensiva ante entradas no-array", () => {
    expect(periodoCerrado(null as unknown as CierrePeriodo[], "u1", "2026-07")).toBe(false);
  });
  it("sin owner o sin periodo no afirma que está cerrado", () => {
    expect(periodoCerrado([cierre("u1", "2026-07")], "", "2026-07")).toBe(false);
    expect(periodoCerrado([cierre("u1", "2026-07")], "u1", "")).toBe(false);
  });
});

describe("periodosCerradosDe", () => {
  it("lista los meses cerrados de una persona, ordenados desc", () => {
    const cs = [cierre("u1", "2026-06"), cierre("u1", "2026-08"), cierre("u2", "2026-07")];
    expect(periodosCerradosDe(cs, "u1")).toEqual(["2026-08", "2026-06"]);
  });
  it("sin cierres devuelve lista vacía", () => {
    expect(periodosCerradosDe([], "u1")).toEqual([]);
  });
  it("no mezcla los cierres de otras personas", () => {
    expect(periodosCerradosDe([cierre("u2", "2026-07")], "u1")).toEqual([]);
  });
  it("es defensiva ante entradas no-array", () => {
    expect(periodosCerradosDe(null as unknown as CierrePeriodo[], "u1")).toEqual([]);
  });
});
