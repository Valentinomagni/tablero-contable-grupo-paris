import { describe, it, expect } from "vitest";
import { puedeEditarAnuncio, puedeEliminarAnuncio } from "./anuncios";

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

describe("puedeEliminarAnuncio", () => {
  it("el jefe puede eliminar un aviso ajeno", () => {
    expect(puedeEliminarAnuncio({ owner_id: "u1" }, "jefe", true)).toBe(true);
  });
  it("el autor puede eliminar el suyo", () => {
    expect(puedeEliminarAnuncio({ owner_id: "u1" }, "u1", false)).toBe(true);
  });
  it("un empleado no puede eliminar un aviso ajeno", () => {
    expect(puedeEliminarAnuncio({ owner_id: "u1" }, "u2", false)).toBe(false);
  });
  it("aviso legacy sin owner: solo jefe puede eliminar", () => {
    expect(puedeEliminarAnuncio({ owner_id: null }, "u1", false)).toBe(false);
    expect(puedeEliminarAnuncio({ owner_id: null }, "u1", true)).toBe(true);
  });
});
