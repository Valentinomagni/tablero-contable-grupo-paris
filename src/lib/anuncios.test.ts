import { describe, it, expect } from "vitest";
import { puedeEditarAnuncio } from "./anuncios";

describe("puedeEditarAnuncio", () => {
  it("el autor puede editar su propio aviso", () => {
    expect(puedeEditarAnuncio({ owner_id: "u1" }, "u1", false)).toBe(true);
  });
  it("otro empleado no puede editar un aviso ajeno", () => {
    expect(puedeEditarAnuncio({ owner_id: "u1" }, "u2", false)).toBe(false);
  });
  it("el jefe puede editar cualquier aviso", () => {
    expect(puedeEditarAnuncio({ owner_id: "u1" }, "jefe", true)).toBe(true);
  });
  it("aviso legacy sin owner: solo jefe", () => {
    expect(puedeEditarAnuncio({ owner_id: null }, "u1", false)).toBe(false);
    expect(puedeEditarAnuncio({ owner_id: null }, "u1", true)).toBe(true);
  });
});
