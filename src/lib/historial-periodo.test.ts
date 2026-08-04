import { describe, it, expect } from "vitest";
import { historialDePeriodo, periodosConHistorial, esRuidoDeReinicio } from "./historial-periodo";
import type { HistoryEntry } from "./types";

function h(at: string, txt = "Marcó terminada", who = "Ana"): HistoryEntry {
  return { who, at, txt };
}

describe("historialDePeriodo", () => {
  it("devuelve sólo lo que pasó en ese mes", () => {
    const todo = [h("2026-07-16T14:13:00Z"), h("2026-08-04T16:02:00Z")];
    expect(historialDePeriodo(todo, "2026-07")).toHaveLength(1);
    expect(historialDePeriodo(todo, "2026-08")).toHaveLength(1);
  });

  it("un mes sin movimientos devuelve lista vacía, no todo", () => {
    expect(historialDePeriodo([h("2026-07-16T14:13:00Z")], "2026-09")).toEqual([]);
  });

  it("ordena del más reciente al más viejo, como se lee", () => {
    const todo = [h("2026-07-01T10:00:00Z", "Creó la tarea"), h("2026-07-20T10:00:00Z", "Marcó terminada")];
    expect(historialDePeriodo(todo, "2026-07")[0].txt).toBe("Marcó terminada");
  });

  // El mes se decide en hora ARGENTINA: una entrada del 31/07 a las 22 hora local es de
  // julio, aunque en UTC ya sea el 1 de agosto.
  it("asigna el mes en hora argentina, no en UTC", () => {
    const nocturna = h("2026-08-01T01:30:00Z"); // 31/07 22:30 en Argentina
    expect(historialDePeriodo([nocturna], "2026-07")).toHaveLength(1);
    expect(historialDePeriodo([nocturna], "2026-08")).toHaveLength(0);
  });

  it("es defensiva ante entradas raras", () => {
    expect(historialDePeriodo(null as unknown as HistoryEntry[], "2026-07")).toEqual([]);
    expect(historialDePeriodo([null as unknown as HistoryEntry], "2026-07")).toEqual([]);
    expect(historialDePeriodo([h("no es fecha")], "2026-07")).toEqual([]);
  });
});

describe("periodosConHistorial", () => {
  it("lista los meses que tienen movimientos, del más nuevo al más viejo", () => {
    const todo = [h("2026-06-10T10:00:00Z"), h("2026-08-04T10:00:00Z"), h("2026-07-16T10:00:00Z")];
    expect(periodosConHistorial(todo)).toEqual(["2026-08", "2026-07", "2026-06"]);
  });

  it("no repite un mes con varios movimientos", () => {
    const todo = [h("2026-07-01T10:00:00Z"), h("2026-07-20T10:00:00Z")];
    expect(periodosConHistorial(todo)).toEqual(["2026-07"]);
  });

  it("sin historial devuelve lista vacía", () => {
    expect(periodosConHistorial([])).toEqual([]);
  });
});

// Lo que motivó todo: la captura mostraba "Marcó terminada" y "Reabrió la tarea" en el
// MISMO minuto. No es trabajo de nadie: es el reinicio mensual dejando rastro.
describe("esRuidoDeReinicio", () => {
  it("reconoce el reinicio automático", () => {
    expect(esRuidoDeReinicio({ who: "Sistema", at: "2026-08-01T03:05:00Z", txt: "Reinicio mensual automático (2026-07 archivado)" })).toBe(true);
  });

  it("reconoce el reinicio manual", () => {
    expect(esRuidoDeReinicio({ who: "Sistema", at: "2026-08-04T19:00:00Z", txt: "Reinicio mensual manual (2026-07 archivado)" })).toBe(true);
  });

  it("NO marca como ruido el trabajo de una persona", () => {
    expect(esRuidoDeReinicio(h("2026-08-04T16:02:00Z", "Marcó terminada", "Valentino Magni"))).toBe(false);
    expect(esRuidoDeReinicio(h("2026-08-04T16:02:00Z", "Reabrió la tarea", "Valentino Magni"))).toBe(false);
  });

  it("es defensiva", () => {
    expect(esRuidoDeReinicio(null as unknown as HistoryEntry)).toBe(false);
  });
});
