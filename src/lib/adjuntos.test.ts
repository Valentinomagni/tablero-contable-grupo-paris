import { describe, it, expect } from "vitest";
import { nombreSeguro, validarAdjunto, EXTENSIONES_PERMITIDAS } from "./adjuntos";

describe("nombreSeguro", () => {
  it("pasa a minúsculas, quita espacios y paréntesis, preserva extensión", () => {
    const r = nombreSeguro("Balance Julio (v2).PDF", 1000);
    expect(r.endsWith(".pdf")).toBe(true);
    expect(r).not.toMatch(/\s/);
    expect(r).not.toMatch(/[()]/);
  });

  it("es determinístico con timestamp fijo", () => {
    expect(nombreSeguro("Archivo.txt", 12345)).toBe(nombreSeguro("Archivo.txt", 12345));
  });

  it("prefija el timestamp para unicidad", () => {
    expect(nombreSeguro("archivo.pdf", 999)).toMatch(/^999-/);
  });

  it("colapsa guiones múltiples", () => {
    const r = nombreSeguro("a   b---c.csv", 1);
    expect(r).not.toMatch(/-{2,}/);
  });

  it("preserva la extensión en minúsculas aunque venga en mayúsculas", () => {
    expect(nombreSeguro("informe.XLSX", 1)).toMatch(/\.xlsx$/);
  });

  it("usa Date.now() por defecto si no se pasa timestamp", () => {
    const r = nombreSeguro("archivo.pdf");
    expect(r).toMatch(/^\d+-archivo\.pdf$/);
  });
});

describe("validarAdjunto", () => {
  it("rechaza archivos de más de 10 MB", () => {
    expect(validarAdjunto({ size: 10 * 1024 * 1024 + 1, name: "a.pdf" }))
      .toBe("El archivo supera los 10 MB.");
  });

  it("acepta hasta 10 MB exactos", () => {
    expect(validarAdjunto({ size: 10 * 1024 * 1024, name: "a.pdf" })).toBeNull();
  });

  it("rechaza extensiones no permitidas", () => {
    expect(validarAdjunto({ size: 100, name: "virus.exe" }))
      .toBe("Tipo de archivo no permitido.");
  });

  it("acepta extensiones permitidas sin importar mayúsculas", () => {
    expect(validarAdjunto({ size: 100, name: "informe.XLSX" })).toBeNull();
  });

  it("acepta cada extensión de la lista permitida", () => {
    for (const ext of EXTENSIONES_PERMITIDAS) {
      expect(validarAdjunto({ size: 100, name: `archivo.${ext}` })).toBeNull();
    }
  });

  it("archivo válido devuelve null", () => {
    expect(validarAdjunto({ size: 2048, name: "Balance Julio (v2).PDF" })).toBeNull();
  });

  it("rechaza archivo sin extensión", () => {
    expect(validarAdjunto({ size: 100, name: "sinextension" }))
      .toBe("Tipo de archivo no permitido.");
  });
});
