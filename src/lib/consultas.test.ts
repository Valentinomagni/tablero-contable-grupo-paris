import { describe, it, expect } from "vitest";
import { validarConsulta, ordenarConsultas, contarNuevas } from "./consultas";
import type { Consulta } from "./types";

function mkConsulta(p: Partial<Consulta>): Consulta {
  return {
    id: "c1", autor: "u1", tipo: "consulta", texto: "texto",
    estado: "nueva", respuesta: null, created_at: "2026-07-01T00:00:00Z",
    respondida_at: null, ...p,
  };
}

describe("validarConsulta", () => {
  it("rechaza texto vacío", () => {
    expect(validarConsulta("")).toBe("Escribí tu consulta.");
  });
  it("rechaza texto de solo espacios", () => {
    expect(validarConsulta("   ")).toBe("Escribí tu consulta.");
  });
  it("rechaza más de 2000 caracteres", () => {
    expect(validarConsulta("a".repeat(2001))).toBe("Máximo 2000 caracteres.");
  });
  it("acepta exactamente 2000 caracteres", () => {
    expect(validarConsulta("a".repeat(2000))).toBeNull();
  });
  it("acepta texto normal", () => {
    expect(validarConsulta("¿Cómo cargo un vencimiento?")).toBeNull();
  });
});

describe("ordenarConsultas", () => {
  it("lista vacía devuelve vacía", () => {
    expect(ordenarConsultas([])).toEqual([]);
  });
  it("nuevas primero, luego leídas, archivadas al final", () => {
    const nueva = mkConsulta({ id: "n", estado: "nueva", created_at: "2026-07-10T00:00:00Z" });
    const leida = mkConsulta({ id: "l", estado: "leida", created_at: "2026-07-11T00:00:00Z" });
    const archivada = mkConsulta({ id: "a", estado: "archivada", created_at: "2026-07-12T00:00:00Z" });
    const out = ordenarConsultas([archivada, leida, nueva]);
    expect(out.map((c) => c.id)).toEqual(["n", "l", "a"]);
  });
  it("dentro de cada grupo ordena por fecha desc", () => {
    const a = mkConsulta({ id: "a", estado: "nueva", created_at: "2026-07-01T00:00:00Z" });
    const b = mkConsulta({ id: "b", estado: "nueva", created_at: "2026-07-10T00:00:00Z" });
    const c = mkConsulta({ id: "c", estado: "nueva", created_at: "2026-07-05T00:00:00Z" });
    const out = ordenarConsultas([a, b, c]);
    expect(out.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
  it("todas archivadas mantiene orden por fecha desc", () => {
    const a = mkConsulta({ id: "a", estado: "archivada", created_at: "2026-07-01T00:00:00Z" });
    const b = mkConsulta({ id: "b", estado: "archivada", created_at: "2026-07-10T00:00:00Z" });
    const out = ordenarConsultas([a, b]);
    expect(out.map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("no muta el array original", () => {
    const list = [mkConsulta({ id: "a", estado: "archivada" }), mkConsulta({ id: "b", estado: "nueva" })];
    const copy = [...list];
    ordenarConsultas(list);
    expect(list).toEqual(copy);
  });
});

describe("contarNuevas", () => {
  it("lista vacía da 0", () => {
    expect(contarNuevas([])).toBe(0);
  });
  it("cuenta solo las de estado nueva", () => {
    const cs = [
      mkConsulta({ id: "a", estado: "nueva" }),
      mkConsulta({ id: "b", estado: "leida" }),
      mkConsulta({ id: "c", estado: "nueva" }),
      mkConsulta({ id: "d", estado: "archivada" }),
    ];
    expect(contarNuevas(cs)).toBe(2);
  });
  it("todas archivadas da 0", () => {
    const cs = [mkConsulta({ id: "a", estado: "archivada" }), mkConsulta({ id: "b", estado: "archivada" })];
    expect(contarNuevas(cs)).toBe(0);
  });
});
