import { describe, it, expect } from "vitest";
import { MIGRACIONES_ESPERADAS, estadoMigraciones } from "./migraciones";

describe("estadoMigraciones", () => {
  it("al día: todas las esperadas aplicadas", () => {
    expect(estadoMigraciones(MIGRACIONES_ESPERADAS)).toEqual({ ok: true, faltan: [], desconocido: false });
  });

  it("faltan migraciones: devuelve las que faltan ordenadas asc", () => {
    const aplicadas = MIGRACIONES_ESPERADAS.filter((n) => n !== 26 && n !== 27);
    expect(estadoMigraciones(aplicadas)).toEqual({ ok: false, faltan: [26, 27], desconocido: false });
  });

  it("null (tabla inexistente o sin migración 28): desconocido", () => {
    expect(estadoMigraciones(null)).toEqual({ ok: false, faltan: [], desconocido: true });
  });

  it("ids extra desconocidos no rompen el cálculo", () => {
    const aplicadas = [...MIGRACIONES_ESPERADAS, 999, 1000];
    expect(estadoMigraciones(aplicadas)).toEqual({ ok: true, faltan: [], desconocido: false });
  });

  it("faltan ordenadas asc aunque las aplicadas vengan desordenadas", () => {
    const aplicadas = MIGRACIONES_ESPERADAS.filter((n) => n !== 27 && n !== 13).sort(() => Math.random() - 0.5);
    expect(estadoMigraciones(aplicadas)).toEqual({ ok: false, faltan: [13, 27], desconocido: false });
  });
});
