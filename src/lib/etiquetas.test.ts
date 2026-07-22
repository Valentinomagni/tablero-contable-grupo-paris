import { describe, it, expect } from "vitest";
import { normalizarEtiqueta, etiquetasEnUso, pasaFiltroEtiquetas, agregarEtiqueta } from "./etiquetas";

describe("normalizarEtiqueta", () => {
  it("trimea espacios en los extremos", () => {
    expect(normalizarEtiqueta("  Peugeot  ")).toBe("Peugeot");
  });
  it("colapsa espacios internos múltiples", () => {
    expect(normalizarEtiqueta("Auto   city")).toBe("Auto city");
  });
  it("NO cambia mayúsculas: los nombres propios importan", () => {
    expect(normalizarEtiqueta("Autocity")).toBe("Autocity");
    expect(normalizarEtiqueta("AUTOCITY")).toBe("AUTOCITY");
  });
  it("cadena vacía o sólo espacios → cadena vacía", () => {
    expect(normalizarEtiqueta("   ")).toBe("");
    expect(normalizarEtiqueta("")).toBe("");
  });
});

describe("etiquetasEnUso", () => {
  it("devuelve únicas (sin duplicar por mayúsculas) y ordenadas es-AR", () => {
    const cards = [
      { etiquetas: ["Peugeot", "Autocity"] },
      { etiquetas: ["autocity"] }, // mismo tag, distinta mayúscula → no duplica
      { etiquetas: ["Empresa X"] },
    ];
    expect(etiquetasEnUso(cards)).toEqual(["Autocity", "Empresa X", "Peugeot"]);
  });
  it("ignora cards sin etiquetas o con array vacío", () => {
    expect(etiquetasEnUso([{ etiquetas: [] }, { etiquetas: undefined }, {}])).toEqual([]);
  });
  it("lista vacía si no hay cards", () => {
    expect(etiquetasEnUso([])).toEqual([]);
  });
  it("conserva la primera capitalización vista para el duplicado case-insensitive", () => {
    const cards = [{ etiquetas: ["autocity"] }, { etiquetas: ["Autocity"] }];
    expect(etiquetasEnUso(cards)).toEqual(["autocity"]);
  });
});

describe("pasaFiltroEtiquetas", () => {
  it("filtro vacío deja pasar todo", () => {
    expect(pasaFiltroEtiquetas({ etiquetas: [] }, [])).toBe(true);
    expect(pasaFiltroEtiquetas({ etiquetas: ["Peugeot"] }, [])).toBe(true);
    expect(pasaFiltroEtiquetas({}, [])).toBe(true);
  });
  it("AND: la card debe tener TODAS las del filtro", () => {
    const c = { etiquetas: ["Peugeot", "DDJJ IIBB"] };
    expect(pasaFiltroEtiquetas(c, ["Peugeot"])).toBe(true);
    expect(pasaFiltroEtiquetas(c, ["Peugeot", "DDJJ IIBB"])).toBe(true);
    expect(pasaFiltroEtiquetas(c, ["Peugeot", "Autocity"])).toBe(false);
  });
  it("comparación case-insensitive", () => {
    expect(pasaFiltroEtiquetas({ etiquetas: ["Peugeot"] }, ["peugeot"])).toBe(true);
    expect(pasaFiltroEtiquetas({ etiquetas: ["PEUGEOT"] }, ["Peugeot"])).toBe(true);
  });
  it("card sin etiquetas no pasa un filtro no vacío", () => {
    expect(pasaFiltroEtiquetas({ etiquetas: [] }, ["Peugeot"])).toBe(false);
    expect(pasaFiltroEtiquetas({}, ["Peugeot"])).toBe(false);
  });
});

describe("agregarEtiqueta", () => {
  it("agrega una etiqueta nueva", () => {
    expect(agregarEtiqueta(["Peugeot"], "Autocity")).toEqual(["Peugeot", "Autocity"]);
  });
  it("no duplica (case-insensitive)", () => {
    expect(agregarEtiqueta(["Peugeot"], "peugeot")).toEqual(["Peugeot"]);
    expect(agregarEtiqueta(["Peugeot"], "PEUGEOT")).toEqual(["Peugeot"]);
  });
  it("ignora vacías o sólo espacios", () => {
    expect(agregarEtiqueta(["Peugeot"], "   ")).toEqual(["Peugeot"]);
    expect(agregarEtiqueta(["Peugeot"], "")).toEqual(["Peugeot"]);
  });
  it("normaliza (trim/colapsa espacios) antes de agregar", () => {
    expect(agregarEtiqueta([], "  Auto   city  ")).toEqual(["Auto city"]);
  });
  it("no muta el array original", () => {
    const orig = ["Peugeot"];
    agregarEtiqueta(orig, "Autocity");
    expect(orig).toEqual(["Peugeot"]);
  });
  it("lista vacía inicial", () => {
    expect(agregarEtiqueta([], "Peugeot")).toEqual(["Peugeot"]);
  });
});
