import { describe, it, expect } from "vitest";
import { saludOperativa } from "./salud-operativa";
import type { Card } from "./types";

const HOY = "2026-07-10T00:00:00Z";

function card(over: Partial<Card> = {}): Card {
  return {
    id: Math.random().toString(36).slice(2), owner: "u1", title: "T", status: "pend",
    description: "", checklist: [], comments: [], history: [], done_at: null, proc_at: null,
    due_date: null, recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-07-01T00:00:00Z", ...over,
  };
}

describe("saludOperativa — espera hasta comenzar", () => {
  it("mide de created_at a proc_at, no la duración del trabajo", () => {
    const r = saludOperativa([
      card({ created_at: "2026-07-01T00:00:00Z", proc_at: "2026-07-03T00:00:00Z" }),
      card({ created_at: "2026-07-01T00:00:00Z", proc_at: "2026-07-05T00:00:00Z" }),
    ], HOY);
    expect(r.esperaPromedioDias).toBe(3);
  });
  it("las que nunca arrancaron no promedian", () => {
    expect(saludOperativa([card({ proc_at: null })], HOY).esperaPromedioDias).toBeNull();
  });
});

describe("saludOperativa — edad por estado", () => {
  it("promedia los días desde created_at de las abiertas de cada columna", () => {
    const r = saludOperativa([
      card({ status: "pend", created_at: "2026-07-08T00:00:00Z" }),
      card({ status: "proc", created_at: "2026-07-05T00:00:00Z" }),
    ], HOY);
    expect(r.edadPend).toBe(2);
    expect(r.edadProc).toBe(5);
  });
  it("sin tareas en una columna, esa edad es null (no 0)", () => {
    const r = saludOperativa([card({ status: "pend" })], HOY);
    expect(r.edadProc).toBeNull();
  });
  it("las terminadas no tienen edad acumulada", () => {
    expect(saludOperativa([card({ status: "term", done_at: "x" })], HOY).edadPend).toBeNull();
  });
});

describe("saludOperativa — multitarea", () => {
  it("cuenta tareas abiertas por persona, de mayor a menor", () => {
    const r = saludOperativa([
      card({ owner: "a" }), card({ owner: "a" }), card({ owner: "b" }),
    ], HOY);
    expect(r.multitarea).toEqual([{ owner: "a", abiertas: 2 }, { owner: "b", abiertas: 1 }]);
  });
  it("no cuenta las terminadas", () => {
    expect(saludOperativa([card({ owner: "a", status: "term", done_at: "x" })], HOY).multitarea).toEqual([]);
  });
});

describe("saludOperativa — defensiva", () => {
  it("sin datos devuelve nulls sin explotar", () => {
    const r = saludOperativa([], HOY);
    expect(r).toEqual({ esperaPromedioDias: null, edadPend: null, edadProc: null, multitarea: [] });
  });
  it("tolera entradas no-array", () => {
    expect(saludOperativa(null as unknown as Card[], HOY).multitarea).toEqual([]);
  });
});
