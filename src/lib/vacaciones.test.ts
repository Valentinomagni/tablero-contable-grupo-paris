import { describe, it, expect } from "vitest";
import { rangoValido, estaDeVacaciones, ausentesEnFecha, vacacionesActivasYFuturas, esCobertura, novedadesPara } from "./vacaciones";
import type { Vacacion, Card, HistoryEntry } from "./types";

function mk(p: Partial<Vacacion>): Vacacion {
  return {
    id: "v", owner: "u1", desde: "2026-07-10", hasta: "2026-07-20", motivo: "Vacaciones",
    reemplazante: null, notas: "", created_by: null, created_at: "2026-07-01T00:00:00Z", ...p,
  };
}

describe("rangoValido", () => {
  it("ambos presentes y desde <= hasta → true", () => {
    expect(rangoValido("2026-07-10", "2026-07-20")).toBe(true);
    expect(rangoValido("2026-07-10", "2026-07-10")).toBe(true);
  });
  it("desde > hasta → false", () => {
    expect(rangoValido("2026-07-21", "2026-07-20")).toBe(false);
  });
  it("algún extremo vacío → false", () => {
    expect(rangoValido("", "2026-07-20")).toBe(false);
    expect(rangoValido("2026-07-10", "")).toBe(false);
    expect(rangoValido("", "")).toBe(false);
  });
});

describe("estaDeVacaciones", () => {
  const vacs = [mk({ owner: "u1", desde: "2026-07-10", hasta: "2026-07-20" })];
  it("dentro del rango (bordes inclusive) → true", () => {
    expect(estaDeVacaciones(vacs, "u1", "2026-07-10")).toBe(true);
    expect(estaDeVacaciones(vacs, "u1", "2026-07-15")).toBe(true);
    expect(estaDeVacaciones(vacs, "u1", "2026-07-20")).toBe(true);
  });
  it("fuera del rango → false", () => {
    expect(estaDeVacaciones(vacs, "u1", "2026-07-09")).toBe(false);
    expect(estaDeVacaciones(vacs, "u1", "2026-07-21")).toBe(false);
  });
  it("otra persona → false", () => {
    expect(estaDeVacaciones(vacs, "u2", "2026-07-15")).toBe(false);
  });
});

describe("ausentesEnFecha", () => {
  const vacs = [
    mk({ id: "a", owner: "u1", desde: "2026-07-10", hasta: "2026-07-20" }),
    mk({ id: "b", owner: "u2", desde: "2026-07-14", hasta: "2026-07-16" }),
    mk({ id: "c", owner: "u3", desde: "2026-08-01", hasta: "2026-08-05" }),
  ];
  it("devuelve las vigentes ese día", () => {
    expect(ausentesEnFecha(vacs, "2026-07-15").map((v) => v.id)).toEqual(["a", "b"]);
    expect(ausentesEnFecha(vacs, "2026-07-11").map((v) => v.id)).toEqual(["a"]);
    expect(ausentesEnFecha(vacs, "2026-09-01")).toEqual([]);
  });
});

describe("vacacionesActivasYFuturas", () => {
  const vacs = [
    mk({ id: "vieja", desde: "2026-06-01", hasta: "2026-06-10" }),
    mk({ id: "futura", desde: "2026-08-01", hasta: "2026-08-10" }),
    mk({ id: "actual", desde: "2026-07-10", hasta: "2026-07-20" }),
  ];
  it("excluye las terminadas y ordena por desde", () => {
    expect(vacacionesActivasYFuturas(vacs, "2026-07-17").map((v) => v.id)).toEqual(["actual", "futura"]);
  });
  it("hasta == hoy sigue activa (borde inclusive)", () => {
    expect(vacacionesActivasYFuturas([mk({ id: "x", desde: "2026-07-01", hasta: "2026-07-17" })], "2026-07-17").map((v) => v.id)).toEqual(["x"]);
  });
});

describe("novedadesPara", () => {
  it("sin licencias → vacío", () => {
    expect(novedadesPara([], "u2", "2026-07-15")).toEqual([]);
  });
  it("licencia vigente con novedades → la ve el reemplazante", () => {
    const vacs = [mk({ id: "a", reemplazante: "u2", notas: "Ojo con el proveedor X", desde: "2026-07-10", hasta: "2026-07-20" })];
    expect(novedadesPara(vacs, "u2", "2026-07-15").map((v) => v.id)).toEqual(["a"]);
  });
  it("licencia vencida → no aparece", () => {
    const vacs = [mk({ id: "a", reemplazante: "u2", notas: "Algo", desde: "2026-06-01", hasta: "2026-06-10" })];
    expect(novedadesPara(vacs, "u2", "2026-07-15")).toEqual([]);
  });
  it("licencia de otro reemplazante → no aparece", () => {
    const vacs = [mk({ id: "a", reemplazante: "u3", notas: "Algo", desde: "2026-07-10", hasta: "2026-07-20" })];
    expect(novedadesPara(vacs, "u2", "2026-07-15")).toEqual([]);
  });
  it("licencia sin novedades → no aparece", () => {
    const vacs = [mk({ id: "a", reemplazante: "u2", notas: "", desde: "2026-07-10", hasta: "2026-07-20" })];
    expect(novedadesPara(vacs, "u2", "2026-07-15")).toEqual([]);
  });
  it("notas solo con espacios → no aparece", () => {
    const vacs = [mk({ id: "a", reemplazante: "u2", notas: "   ", desde: "2026-07-10", hasta: "2026-07-20" })];
    expect(novedadesPara(vacs, "u2", "2026-07-15")).toEqual([]);
  });
});

describe("esCobertura", () => {
  const h = (txt: string): HistoryEntry => ({ who: "Ana", at: "2026-07-10T00:00:00Z", txt });
  const card = (history: HistoryEntry[]): Card => ({
    id: "c", owner: "u1", title: "T", status: "pend", description: "",
    checklist: [], comments: [], history, done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2026-07-01T00:00:00Z",
  });

  it("detecta cobertura activa y parsea el titular", () => {
    const r = esCobertura(card([h("Creó la tarea"), h("Cobertura por vacaciones: de Juan Pérez a Ana Gómez (10/07–20/07)")]));
    expect(r).toEqual({ activa: true, titular: "Juan Pérez" });
  });

  it("sin cobertura → activa false", () => {
    expect(esCobertura(card([h("Creó la tarea")]))).toEqual({ activa: false, titular: null });
  });

  it("devuelta al titular posterior anula la cobertura", () => {
    const r = esCobertura(card([
      h("Cobertura por vacaciones: de Juan a Ana (10/07–20/07)"),
      h("Devuelta al titular tras cobertura"),
    ]));
    expect(r.activa).toBe(false);
  });

  it("toma la última cobertura si hay varias", () => {
    const r = esCobertura(card([
      h("Cobertura por vacaciones: de Juan a Ana (…)"),
      h("Cobertura por vacaciones: de Pedro a Ana (…)"),
    ]));
    expect(r).toEqual({ activa: true, titular: "Pedro" });
  });
});
