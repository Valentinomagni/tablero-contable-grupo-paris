import { describe, it, expect } from "vitest";
import { confianzaDe } from "./confianza-metrica";
import type { ResultadoICR } from "./icr";

const icrCon = (puntaje: number | null, suficiente = true, muestra = 20): ResultadoICR =>
  ({ puntaje, muestra, suficiente, factores: [], lectura: "" });

describe("confianzaDe", () => {
  it("85 o más es confianza alta", () => {
    expect(confianzaDe(icrCon(90)).nivel).toBe("alta");
    expect(confianzaDe(icrCon(85)).nivel).toBe("alta");
  });
  it("entre 70 y 84 es media", () => {
    expect(confianzaDe(icrCon(75)).nivel).toBe("media");
  });
  it("por debajo de 70 es baja", () => {
    expect(confianzaDe(icrCon(60)).nivel).toBe("baja");
    expect(confianzaDe(icrCon(20)).nivel).toBe("baja");
  });
  it("sin muestra suficiente no arriesga un nivel", () => {
    expect(confianzaDe(icrCon(null, false, 3)).nivel).toBe("sin-datos");
  });
  it("el rótulo habla del DATO, nunca de personas", () => {
    for (const p of [90, 75, 40]) {
      const c = confianzaDe(icrCon(p));
      expect(c.rotulo).not.toMatch(/persona|equipo|empleado|rendimiento/i);
    }
  });
  it("la explicación de confianza baja dice que no conviene decidir con esto", () => {
    expect(confianzaDe(icrCon(40)).explicacion).toMatch(/no conviene|no deberían|no alcanza/i);
  });
  it("es defensiva ante un icr ausente", () => {
    expect(confianzaDe(undefined as unknown as ResultadoICR).nivel).toBe("sin-datos");
  });
});
