import { describe, it, expect } from "vitest";
import { categoriasEnUso, pasaFiltroCategoria } from "./categorias";

describe("categoriasEnUso", () => {
  it("devuelve únicas y ordenadas, ignorando null/undefined/vacío", () => {
    const cards = [
      { categoria: "Impuestos" }, { categoria: "Bancos" }, { categoria: "Impuestos" },
      { categoria: null }, { categoria: undefined as unknown as null }, { categoria: "" as unknown as null },
    ];
    expect(categoriasEnUso(cards)).toEqual(["Bancos", "Impuestos"]);
  });
  it("lista vacía si nadie usa categorías", () => {
    expect(categoriasEnUso([{ categoria: null }, { categoria: null }])).toEqual([]);
  });
});

describe("pasaFiltroCategoria", () => {
  it("null (Todas) deja pasar todo", () => {
    expect(pasaFiltroCategoria({ categoria: "Bancos" }, null)).toBe(true);
    expect(pasaFiltroCategoria({ categoria: null }, null)).toBe(true);
  });
  it("'' (Sin categoría) deja pasar solo las sin categoría", () => {
    expect(pasaFiltroCategoria({ categoria: null }, "")).toBe(true);
    expect(pasaFiltroCategoria({ categoria: "Bancos" }, "")).toBe(false);
  });
  it("una categoría concreta filtra exacto", () => {
    expect(pasaFiltroCategoria({ categoria: "Bancos" }, "Bancos")).toBe(true);
    expect(pasaFiltroCategoria({ categoria: "Impuestos" }, "Bancos")).toBe(false);
    expect(pasaFiltroCategoria({ categoria: null }, "Bancos")).toBe(false);
  });
});
