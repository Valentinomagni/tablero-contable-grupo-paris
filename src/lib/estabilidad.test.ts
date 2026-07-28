import { describe, it, expect } from "vitest";
import { estabilidad } from "./estabilidad";

describe("estabilidad", () => {
  it("una serie casi idéntica es muy estable", () => {
    const r = estabilidad([95, 94, 96, 95, 95]);
    expect(r.nivel).toBe("muy-estable");
    expect(r.cv).toBeLessThan(0.05);
  });
  it("una serie que salta es muy variable", () => {
    expect(estabilidad([100, 30, 98, 20, 100]).nivel).toBe("muy-variable");
  });
  it("dos series con el MISMO promedio se distinguen por su variación", () => {
    const a = estabilidad([60, 60, 60]);
    const b = estabilidad([10, 60, 110]);
    expect(a.nivel).toBe("muy-estable");
    expect(b.nivel).toBe("muy-variable");
  });
  it("menos de 3 datos no alcanza para hablar de estabilidad", () => {
    expect(estabilidad([50, 90]).nivel).toBe("sin-datos");
    expect(estabilidad([]).nivel).toBe("sin-datos");
  });
  it("promedio 0 no divide por cero", () => {
    expect(estabilidad([0, 0, 0]).nivel).toBe("sin-datos");
  });
  it("es defensiva ante entradas no-array", () => {
    expect(estabilidad(null as unknown as number[]).nivel).toBe("sin-datos");
  });
  it("el texto describe el proceso, no a la persona", () => {
    expect(estabilidad([95, 94, 96]).texto).toBe("Resultados parejos mes a mes");
    expect(estabilidad([100, 20, 100]).texto).toBe("Resultados muy dispares entre meses");
  });
});
