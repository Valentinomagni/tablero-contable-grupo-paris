import { describe, it, expect } from "vitest";
import { relevantes, aEventosVirtuales, KEYWORDS_CONTABLES } from "./arca-filtro";
import type { ArcaItem } from "../features/tablon/arca";

const it0 = (over: Partial<ArcaItem>): ArcaItem => ({
  num: 15, dia: "LUN", titulo: "", sub: "", rows: [], ...over,
});

describe("relevantes", () => {
  it("mantiene un vencimiento de IVA", () => {
    const items = [it0({ titulo: "IVA - Presentación" })];
    expect(relevantes(items)).toHaveLength(1);
  });

  it("descarta impuesto a los combustibles", () => {
    const items = [it0({ titulo: "Impuesto a los combustibles" })];
    expect(relevantes(items)).toHaveLength(0);
  });

  it("mantiene Aportes Seguridad Social (931)", () => {
    const items = [it0({ titulo: "Aportes Seguridad Social (931)" })];
    expect(relevantes(items)).toHaveLength(1);
  });

  it("matchea sin tildes ni mayúsculas (Autónomos)", () => {
    const items = [it0({ titulo: "AUTONOMOS", sub: "pago mensual" })];
    expect(relevantes(items)).toHaveLength(1);
  });

  it("matchea por el detalle (sub) además del título", () => {
    const items = [it0({ titulo: "Régimen general", sub: "Retenciones SICORE" })];
    expect(relevantes(items)).toHaveLength(1);
  });

  it("descarta ruido no contable (tabaco, seguros)", () => {
    const items = [
      it0({ titulo: "Impuestos internos - Tabaco" }),
      it0({ titulo: "Seguros de vida" }),
    ];
    expect(relevantes(items)).toHaveLength(0);
  });

  it("filtra una lista mixta dejando solo las contables", () => {
    const items = [
      it0({ titulo: "IVA" }),
      it0({ titulo: "Combustibles líquidos" }),
      it0({ titulo: "Monotributo" }),
      it0({ titulo: "Bienes Personales" }),
      it0({ titulo: "Tabaco" }),
    ];
    expect(relevantes(items).map((x) => x.titulo)).toEqual(["IVA", "Monotributo", "Bienes Personales"]);
  });

  it("no rompe con lista vacía (caso local)", () => {
    expect(relevantes([])).toEqual([]);
  });

  it("expone la constante de keywords", () => {
    expect(KEYWORDS_CONTABLES.length).toBeGreaterThan(5);
    expect(KEYWORDS_CONTABLES).toContain("iva");
  });
});

describe("aEventosVirtuales", () => {
  it("mapea items relevantes a eventos con fecha YYYY-MM-DD del mes visible", () => {
    const items = [
      it0({ num: 15, titulo: "IVA", sub: "Presentación y pago" }),
      it0({ num: 7, titulo: "Combustibles" }), // se descarta
      it0({ num: 22, titulo: "Monotributo", sub: "" }),
    ];
    const ev = aEventosVirtuales(items, 2026, 7);
    expect(ev).toEqual([
      { date: "2026-07-15", title: "IVA", detail: "Presentación y pago" },
      { date: "2026-07-22", title: "Monotributo", detail: "" },
    ]);
  });

  it("descarta num fuera de rango del mes", () => {
    const items = [it0({ num: 0, titulo: "IVA" }), it0({ num: 31, titulo: "IVA" })];
    // febrero 2026 no tiene 31
    expect(aEventosVirtuales(items, 2026, 2)).toEqual([]);
  });

  it("no rompe con lista vacía", () => {
    expect(aEventosVirtuales([], 2026, 7)).toEqual([]);
  });
});
