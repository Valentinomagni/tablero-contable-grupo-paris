import { describe, it, expect } from "vitest";
import { nuevaCantidad } from "./operativas";

describe("nuevaCantidad", () => {
  it("resta respetando el piso", () => {
    expect(nuevaCantidad(3, -1)).toBe(2);
    expect(nuevaCantidad(0, -1)).toBe(0);
  });
  it("suma", () => {
    expect(nuevaCantidad(2, 5)).toBe(7);
  });
});
