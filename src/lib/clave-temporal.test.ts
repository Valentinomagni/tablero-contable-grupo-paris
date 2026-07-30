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
