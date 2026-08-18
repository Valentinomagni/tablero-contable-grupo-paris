import { describe, it, expect } from "vitest";
import { parseOrganizacion, DEFAULT_ORG } from "./organizacion";

describe("parseOrganizacion", () => {
  it("devuelve defaults si el valor es null o malformado", () => {
    expect(parseOrganizacion(null)).toEqual(DEFAULT_ORG);
    expect(parseOrganizacion({ marcas: "no-array" })).toEqual(DEFAULT_ORG);
  });
  it("acepta un JSON válido y filtra entradas vacías", () => {
    const o = parseOrganizacion({ marcas: ["General", " ", "Postventa"], sucursales: ["Merlo"] });
    expect(o.marcas).toEqual(["General", "Postventa"]);
    expect(o.sucursales).toEqual(["Merlo"]);
  });
  it("los defaults incluyen Postventa y las 4 sucursales", () => {
    expect(DEFAULT_ORG.marcas).toContain("Postventa");
    expect(DEFAULT_ORG.sucursales).toEqual(["San Luis Capital", "Villa Mercedes", "Merlo", "San Juan"]);
  });
});

// ── Áreas externas (Fase C) ─────────────────────────────────────────────────────
//
// Las áreas que pueden tener trabada una tarea —Ventas, Administración, RRHH— viven en la misma
// clave que marcas y sucursales, porque son lo mismo: estructura organizacional configurable.
describe("parseOrganizacion — áreas", () => {
  it("trae las áreas cuando están cargadas", () => {
    const o = parseOrganizacion({ marcas: ["General"], sucursales: ["Merlo"], areas: ["Ventas", " ", "RRHH"] });
    expect(o.areas).toEqual(["Ventas", "RRHH"]);
  });

  // EL CASO QUE ROMPERÍA LA CONFIGURACIÓN DE PRODUCCIÓN. La fila que ya existe en `settings` NO
  // tiene `areas`: se guardó antes de que existiera el campo. Si su ausencia hiciera caer todo a
  // DEFAULT_ORG, las marcas y sucursales que el jefe cargó a mano se perderían de la pantalla,
  // en silencio, la primera vez que alguien abriera la app después de esta migración.
  it("sin áreas usa las de fábrica y NO pisa las marcas cargadas a mano", () => {
    const o = parseOrganizacion({ marcas: ["Solo Chevrolet"], sucursales: ["Solo Merlo"] });
    expect(o.marcas).toEqual(["Solo Chevrolet"]);
    expect(o.sucursales).toEqual(["Solo Merlo"]);
    expect(o.areas).toEqual(DEFAULT_ORG.areas);
  });

  it("con áreas rotas tampoco pisa el resto", () => {
    const o = parseOrganizacion({ marcas: ["Solo Chevrolet"], sucursales: ["Solo Merlo"], areas: "no-array" });
    expect(o.marcas).toEqual(["Solo Chevrolet"]);
    expect(o.areas).toEqual(DEFAULT_ORG.areas);
  });

  it("las de fábrica son las tres que nombró el dueño, más las dos obvias", () => {
    expect(DEFAULT_ORG.areas).toEqual(["Ventas", "Administración", "Recursos Humanos", "Sistemas", "Fábrica"]);
  });
});
