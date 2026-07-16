import { describe, it, expect } from "vitest";
import { normalizar, similitud, similares } from "./similitud";
import type { Card } from "./types";

const card = (title: string, status: Card["status"] = "pend"): Card =>
  ({ id: title, owner: "u1", title, status, description: "", checklist: [], comments: [],
     history: [], done_at: null, due_date: null, recurring: false, priority: "media",
     effort: 1, card_type: "normal", deps: [], created_at: "" } as Card);

describe("normalizar", () => {
  it("baja a minúsculas, quita tildes y colapsa espacios", () => {
    expect(normalizar("  Conciliación   BANCOS ")).toBe("conciliacion bancos");
  });
});

describe("similitud", () => {
  it("idénticos = 1", () => {
    expect(similitud("IVA julio", "IVA julio")).toBe(1);
  });
  it("variantes con tilde/plural superan 0.6", () => {
    expect(similitud("Conciliación Bancos", "conciliacion banco")).toBeGreaterThan(0.6);
  });
  it("mismo prefijo distinto mes supera 0.5", () => {
    expect(similitud("IVA julio", "IVA agosto")).toBeGreaterThan(0.5);
  });
  it("textos distintos quedan bajo 0.3", () => {
    expect(similitud("IVA", "Sueldos")).toBeLessThan(0.3);
  });
  it("strings de <2 chars: comparación exacta", () => {
    expect(similitud("a", "a")).toBe(1);
    expect(similitud("a", "b")).toBe(0);
  });
});

describe("similares", () => {
  it("filtra cerradas y ordena por similitud desc", () => {
    const cards = [
      card("Conciliación Bancos", "term"),
      card("Conciliacion bancaria"),
      card("Conciliación Banco"),
      card("Sueldos"),
    ];
    const r = similares("conciliacion banco", cards);
    expect(r.map((c) => c.title)).toEqual(["Conciliación Banco", "Conciliacion bancaria"]);
  });
  it("sin coincidencias devuelve vacío", () => {
    expect(similares("Honorarios", [card("Sueldos")])).toEqual([]);
  });
});
