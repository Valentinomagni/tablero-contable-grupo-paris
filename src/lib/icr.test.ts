import { describe, it, expect } from "vitest";
import { icr, MUESTRA_MINIMA } from "./icr";
import type { Card } from "./types";

const HOY = "2026-07-31T12:00:00Z";

function card(over: Partial<Card> = {}): Card {
  return {
    id: Math.random().toString(36).slice(2), owner: "u1", title: "T", status: "term",
    description: "", checklist: [], comments: [], history: [],
    created_at: "2026-07-01T09:00:00Z",
    proc_at: "2026-07-02T09:00:00Z",
    done_at: "2026-07-02T17:00:00Z",
    due_date: "2026-07-10", recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], ...over,
  };
}
/** n tareas cerradas impecablemente. */
const buenas = (n: number) => Array.from({ length: n }, () => card());

describe("icr — muestra mínima", () => {
  it(`con menos de ${MUESTRA_MINIMA} cerradas no publica número`, () => {
    const r = icr(buenas(MUESTRA_MINIMA - 1), HOY);
    expect(r.suficiente).toBe(false);
    expect(r.puntaje).toBeNull();
    expect(r.muestra).toBe(MUESTRA_MINIMA - 1);
  });
  it("con muestra suficiente sí publica", () => {
    const r = icr(buenas(MUESTRA_MINIMA), HOY);
    expect(r.suficiente).toBe(true);
    expect(r.puntaje).not.toBeNull();
  });
  it("sin datos no explota", () => {
    expect(icr([], HOY).puntaje).toBeNull();
    expect(icr(null as unknown as Card[], HOY).muestra).toBe(0);
  });
});

describe("icr — registro impecable", () => {
  it("da un puntaje alto", () => {
    expect(icr(buenas(10), HOY).puntaje!).toBeGreaterThanOrEqual(90);
  });
  it("expone los 5 factores con sus pesos", () => {
    const f = icr(buenas(10), HOY).factores;
    expect(f.map((x) => x.clave)).toEqual(["F1", "F2", "F3", "F4", "F5"]);
    expect(f.reduce((s, x) => s + x.peso, 0)).toBe(100);
  });
});

describe("icr — F1 trazabilidad de estados", () => {
  it("cerrar sin haber pasado por 'En proceso' baja el puntaje", () => {
    const sinProc = Array.from({ length: 10 }, () => card({ proc_at: null }));
    const r = icr(sinProc, HOY);
    expect(r.factores.find((f) => f.clave === "F1")!.valor).toBe(0);
    expect(r.puntaje!).toBeLessThan(80);
  });
  it("proc_at posterior a done_at no cuenta como trazable", () => {
    const invertido = Array.from({ length: 10 }, () =>
      card({ proc_at: "2026-07-05T10:00:00Z", done_at: "2026-07-04T10:00:00Z" }));
    expect(icr(invertido, HOY).factores.find((f) => f.clave === "F1")!.valor).toBe(0);
  });
});

describe("icr — F2 registro no colapsado (con su salvaguarda)", () => {
  it("marcar 'En proceso' recién al terminar, en una tarea vieja, baja F2", () => {
    const colapsadas = Array.from({ length: 10 }, () => card({
      created_at: "2026-07-01T09:00:00Z",
      proc_at: "2026-07-20T16:55:00Z",
      done_at: "2026-07-20T17:00:00Z",
    }));
    expect(icr(colapsadas, HOY).factores.find((f) => f.clave === "F2")!.valor).toBe(0);
  });
  it("SALVAGUARDA: una tarea corta y reciente NO se penaliza", () => {
    const cortasLegitimas = Array.from({ length: 10 }, () => card({
      created_at: "2026-07-20T16:00:00Z",
      proc_at: "2026-07-20T16:55:00Z",
      done_at: "2026-07-20T17:00:00Z",
    }));
    expect(icr(cortasLegitimas, HOY).factores.find((f) => f.clave === "F2")!.valor).toBe(1);
  });
  it("SALVAGUARDA: una tarea larga bien registrada da F2 perfecto", () => {
    const larga = Array.from({ length: 10 }, () => card({
      created_at: "2026-07-01T09:00:00Z",
      proc_at: "2026-07-02T09:00:00Z",
      done_at: "2026-07-22T17:00:00Z",
    }));
    expect(icr(larga, HOY).factores.find((f) => f.clave === "F2")!.valor).toBe(1);
  });
});

describe("icr — exclusiones", () => {
  it("las operativas NO cuentan (por diseño no pasan por 'En proceso')", () => {
    const opers = Array.from({ length: 5 }, () => card({ card_type: "operativa", proc_at: null }));
    expect(icr([...buenas(8), ...opers], HOY).muestra).toBe(8);
  });
  it("sólo cuenta lo cerrado dentro de la ventana de 30 días", () => {
    const vieja = card({ done_at: "2026-01-05T10:00:00Z" });
    expect(icr([...buenas(8), vieja], HOY).muestra).toBe(8);
  });
  it("las abiertas no entran en la muestra de cerradas", () => {
    expect(icr([...buenas(8), card({ status: "pend", done_at: null })], HOY).muestra).toBe(8);
  });
});

describe("icr — lectura", () => {
  it("el texto recuerda que un ICR bajo invalida las métricas, no a la persona", () => {
    expect(icr(buenas(10), HOY).lectura).toContain("no a la persona");
  });
});
