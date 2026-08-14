import { describe, it, expect } from "vitest";
import { generarClaveTemporal, claveAceptable, LARGO_CLAVE } from "./clave-temporal";

describe("generarClaveTemporal", () => {
  it("tiene el largo definido", () => {
    expect(generarClaveTemporal()).toHaveLength(LARGO_CLAVE);
  });

  it("cumple el mínimo que pide Supabase (8 caracteres)", () => {
    expect(LARGO_CLAVE).toBeGreaterThanOrEqual(8);
  });

  // Se dicta por teléfono o se manda por chat: un 0 y una O confundidos son otra llamada.
  it("no usa caracteres que se confunden al leerlos en voz alta", () => {
    const clave = generarClaveTemporal();
    expect(clave).not.toMatch(/[0OolI1]/);
  });

  it("no repite la misma clave dos veces seguidas", () => {
    const claves = new Set(Array.from({ length: 50 }, () => generarClaveTemporal()));
    expect(claves.size).toBeGreaterThan(45);
  });

  it("es determinista si se le pasa el azar, para poder testearla", () => {
    const fijo = () => 0;
    expect(generarClaveTemporal(fijo)).toBe(generarClaveTemporal(fijo));
  });

  it("siempre incluye al menos un número, para que no la rechace ninguna política", () => {
    for (let i = 0; i < 30; i++) expect(generarClaveTemporal()).toMatch(/[0-9]/);
  });
});

describe("claveAceptable", () => {
  it("acepta una clave normal", () => {
    expect(claveAceptable("Paris2026x")).toBeNull();
  });

  it("rechaza una demasiado corta, diciendo el mínimo", () => {
    expect(claveAceptable("corta")).toMatch(/8/);
  });

  it("rechaza la vacía", () => {
    expect(claveAceptable("")).not.toBeNull();
    expect(claveAceptable("        ")).not.toBeNull();
  });

  it("es defensiva ante entradas raras", () => {
    expect(claveAceptable(null as unknown as string)).not.toBeNull();
  });

  it("acepta lo que genera el generador", () => {
    for (let i = 0; i < 20; i++) expect(claveAceptable(generarClaveTemporal())).toBeNull();
  });
});

// ── La fuente de azar por defecto ───────────────────────────────────────────────
//
// HALLAZGO 9 DE LA AUDITORÍA DEL 05/08: el default era `Math.random`, que no es un generador
// criptográfico. Los tests de arriba inyectan `azar`, así que el camino que usa la app de verdad
// —el default— no lo ejercitaba ninguno. Es el mismo modo de falla que en `mesesAbiertos`:
// se prueba lo que se inyecta y se confía en lo que no.
describe("generarClaveTemporal sin inyectar azar", () => {
  it("cumple el formato con la fuente real, no sólo con la de mentira", () => {
    for (let i = 0; i < 50; i++) {
      const c = generarClaveTemporal();
      expect(c).toHaveLength(LARGO_CLAVE);
      expect(claveAceptable(c)).toBeNull();
      // Sin ambiguos y terminada en número: las dos razones por las que existe el alfabeto.
      // Los que se fueron son 0, 1, I, O y l minúscula. La `i` minúscula SÍ está: no se
      // confunde con nada cuando se dicta.
      expect(c).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{9}[2-9]$/);
    }
  });

  it("no repite: 200 claves seguidas son 200 distintas", () => {
    // Si el generador se quedara pegado —fuente rota, entorno sin crypto mal resuelto— esto lo
    // detecta. Dos personas con la misma clave temporal es un incidente, no un detalle.
    const vistas = new Set<string>();
    for (let i = 0; i < 200; i++) vistas.add(generarClaveTemporal());
    expect(vistas.size).toBe(200);
  });
});
