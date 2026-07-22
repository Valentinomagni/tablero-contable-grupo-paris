import { describe, it, expect } from "vitest";
import { nuevaCantidad, progresoCarga, extraerMetaCarga, conMetaCarga, descripcionSinMeta } from "./operativas";

describe("nuevaCantidad", () => {
  it("resta respetando el piso", () => {
    expect(nuevaCantidad(3, -1)).toBe(2);
    expect(nuevaCantidad(0, -1)).toBe(0);
  });
  it("suma", () => {
    expect(nuevaCantidad(2, 5)).toBe(7);
  });
});

describe("progresoCarga", () => {
  it("sin meta devuelve pct null y texto con solo el actual", () => {
    expect(progresoCarga(23, null)).toEqual({ pct: null, texto: "23" });
  });
  it("con meta arma el texto '23 de 30' y el pct redondeado", () => {
    expect(progresoCarga(23, 30)).toEqual({ pct: 77, texto: "23 de 30" });
  });
  it("actual en 0 con meta da pct 0", () => {
    expect(progresoCarga(0, 10)).toEqual({ pct: 0, texto: "0 de 10" });
  });
  it("actual == meta da pct 100", () => {
    expect(progresoCarga(30, 30)).toEqual({ pct: 100, texto: "30 de 30" });
  });
  it("actual > meta topea el pct en 100 pero el texto muestra el real", () => {
    expect(progresoCarga(35, 30)).toEqual({ pct: 100, texto: "35 de 30" });
  });
  it("meta 0 o negativa no rompe (nunca divide por cero): se trata como sin meta", () => {
    expect(progresoCarga(5, 0)).toEqual({ pct: null, texto: "5" });
    expect(progresoCarga(5, -3)).toEqual({ pct: null, texto: "5" });
  });
});

describe("extraerMetaCarga / conMetaCarga / descripcionSinMeta (spec 28, Task 3)", () => {
  // Decisión: sin columna nueva en `cards` (ya hay 4 migraciones sin aplicar). La meta
  // se guarda como una marca estructurada al final de `description`, ej. "[[meta:30]]".
  it("extrae null si no hay marca", () => {
    expect(extraerMetaCarga("Cargar remitos del mes")).toBeNull();
  });
  it("extrae la meta de la marca", () => {
    expect(extraerMetaCarga("Cargar remitos del mes\n\n[[meta:30]]")).toBe(30);
  });
  it("ignora marcas mal formadas o no numéricas", () => {
    expect(extraerMetaCarga("texto [[meta:abc]]")).toBeNull();
    expect(extraerMetaCarga("texto [[meta:]]")).toBeNull();
  });
  it("conMetaCarga agrega la marca a una descripción sin marca previa", () => {
    expect(conMetaCarga("Cargar remitos", 30)).toBe("Cargar remitos\n\n[[meta:30]]");
  });
  it("conMetaCarga reemplaza una marca previa en vez de duplicarla", () => {
    expect(conMetaCarga("Cargar remitos\n\n[[meta:20]]", 30)).toBe("Cargar remitos\n\n[[meta:30]]");
  });
  it("conMetaCarga con meta null saca la marca (borrar meta)", () => {
    expect(conMetaCarga("Cargar remitos\n\n[[meta:30]]", null)).toBe("Cargar remitos");
  });
  it("conMetaCarga con meta null y sin marca previa no cambia nada", () => {
    expect(conMetaCarga("Cargar remitos", null)).toBe("Cargar remitos");
  });
  it("descripcionSinMeta devuelve el texto visible sin la marca, para mostrar en el textarea", () => {
    expect(descripcionSinMeta("Cargar remitos\n\n[[meta:30]]")).toBe("Cargar remitos");
    expect(descripcionSinMeta("Cargar remitos")).toBe("Cargar remitos");
  });
});
