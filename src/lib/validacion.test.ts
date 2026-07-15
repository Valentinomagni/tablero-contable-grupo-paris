import { describe, it, expect } from "vitest";
import { nombreValido } from "./validacion";

describe("nombreValido", () => {
  it("rechaza vacío o solo espacios", () => {
    expect(nombreValido("  ")).toBe(false);
  });
  it("acepta nombre real", () => {
    expect(nombreValido("Valentino")).toBe(true);
  });
});
