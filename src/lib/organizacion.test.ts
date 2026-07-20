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
