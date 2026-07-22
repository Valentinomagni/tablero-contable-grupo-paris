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

  it("mantiene Libro IVA Digital", () => {
    const items = [it0({ titulo: "Libro IVA Digital" })];
    expect(relevantes(items)).toHaveLength(1);
  });

  it("matchea sin tildes ni mayúsculas", () => {
    const items = [it0({ titulo: "IVA", sub: "presentacion mensual" })];
    expect(relevantes(items)).toHaveLength(1);
  });

  it("matchea por el detalle (sub) además del título", () => {
    const items = [it0({ titulo: "Régimen general", sub: "IVA mensual" })];
    expect(relevantes(items)).toHaveLength(1);
  });

  it("descarta rubros no-IVA (autónomos, monotributo, ganancias, bienes personales)", () => {
    const items = [
      it0({ titulo: "Autónomos" }),
      it0({ titulo: "Monotributo" }),
      it0({ titulo: "Ganancias" }),
      it0({ titulo: "Bienes Personales" }),
      it0({ titulo: "Aportes Seguridad Social (931)" }),
      it0({ titulo: "Retenciones SICORE" }),
    ];
    expect(relevantes(items)).toHaveLength(0);
  });

  it("descarta ruido no contable (tabaco, seguros, combustibles)", () => {
    const items = [
      it0({ titulo: "Impuestos internos - Tabaco" }),
      it0({ titulo: "Seguros de vida" }),
      it0({ titulo: "Impuesto a los combustibles" }),
    ];
    expect(relevantes(items)).toHaveLength(0);
  });

  it("filtra una lista mixta dejando solo IVA y Libro IVA Digital", () => {
    const items = [
      it0({ titulo: "IVA" }),
      it0({ titulo: "Libro IVA Digital" }),
      it0({ titulo: "Combustibles líquidos" }),
      it0({ titulo: "Monotributo" }),
      it0({ titulo: "Bienes Personales" }),
      it0({ titulo: "Tabaco" }),
    ];
    expect(relevantes(items).map((x) => x.titulo)).toEqual(["IVA", "Libro IVA Digital"]);
  });

  it("no rompe con lista vacía (caso local)", () => {
    expect(relevantes([])).toEqual([]);
  });

  it("expone la keyword de IVA", () => {
    expect(KEYWORDS_CONTABLES).toEqual(["iva"]);
  });
});

describe("aEventosVirtuales", () => {
  it("mapea items relevantes a eventos con fecha YYYY-MM-DD del mes visible", () => {
    const items = [
      it0({ num: 15, titulo: "IVA", sub: "Presentación y pago" }),
      it0({ num: 7, titulo: "Combustibles" }), // se descarta
      it0({ num: 22, titulo: "Libro IVA Digital", sub: "" }),
    ];
    const ev = aEventosVirtuales(items, 2026, 7);
    expect(ev).toEqual([
      { date: "2026-07-15", title: "IVA", detail: "Presentación y pago" },
      { date: "2026-07-22", title: "Libro IVA Digital", detail: "" },
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
