import { describe, it, expect } from "vitest";
import { tareaParaPreguntar, DIAS_PARA_PREGUNTAR } from "./estancadas";
import type { Card } from "./types";

const HOY = "2026-07-20T12:00:00Z";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "T", status: "proc", description: "",
    checklist: [], comments: [], history: [{ who: "u1", at: "2026-07-01T10:00:00Z", txt: "Movió la tarea" }],
    done_at: null, due_date: null, recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-07-01T10:00:00Z", ...over,
  };
}

describe("tareaParaPreguntar", () => {
  it("devuelve la tarea que lleva muchos días sin moverse", () => {
    const r = tareaParaPreguntar([card()], HOY, []);
    expect(r?.card.id).toBe("c1");
    expect(r?.diasSinMover).toBeGreaterThanOrEqual(DIAS_PARA_PREGUNTAR);
  });
  it("NO pregunta por algo movido hace poco", () => {
    const reciente = card({ history: [{ who: "u1", at: "2026-07-19T10:00:00Z", txt: "x" }] });
    expect(tareaParaPreguntar([reciente], HOY, [])).toBeNull();
  });
  it("NO pregunta por tareas terminadas", () => {
    expect(tareaParaPreguntar([card({ status: "term", done_at: "x" })], HOY, [])).toBeNull();
  });
  it("NO pregunta por operativas (son a demanda por diseño)", () => {
    expect(tareaParaPreguntar([card({ card_type: "operativa" })], HOY, [])).toBeNull();
  });
  it("NO vuelve a preguntar por algo que la persona pospuso", () => {
    expect(tareaParaPreguntar([card({ id: "c1" })], HOY, ["c1"])).toBeNull();
  });
  it("pregunta por UNA sola cosa a la vez (no abruma)", () => {
    const r = tareaParaPreguntar([card({ id: "a" }), card({ id: "b" })], HOY, []);
    expect(r).not.toBeNull();
    expect(typeof r!.card.id).toBe("string");
  });
  it("prioriza la más estancada", () => {
    const vieja = card({ id: "vieja", history: [{ who: "u1", at: "2026-06-01T10:00:00Z", txt: "x" }] });
    const menos = card({ id: "menos", history: [{ who: "u1", at: "2026-07-10T10:00:00Z", txt: "x" }] });
    expect(tareaParaPreguntar([menos, vieja], HOY, [])!.card.id).toBe("vieja");
  });
  it("una tarea cubierta por vacaciones no se cuenta como abandonada", () => {
    // La cobertura se marca en el HISTORY, con el prefijo que usa esCobertura() en
    // vacaciones.ts — no con ningún marcador en la descripción.
    const cubierta = card({
      history: [{ who: "u1", at: "2026-07-01T10:00:00Z", txt: "Cobertura por vacaciones: de Carolina a Valentino (hasta 2026-07-25)" }],
    });
    expect(tareaParaPreguntar([cubierta], HOY, [])).toBeNull();
  });
  it("una cobertura YA DEVUELTA vuelve a contar como estancada", () => {
    const devuelta = card({
      history: [
        { who: "u1", at: "2026-07-01T09:00:00Z", txt: "Cobertura por vacaciones: de Carolina a Valentino (hasta 2026-07-10)" },
        { who: "u1", at: "2026-07-01T10:00:00Z", txt: "Devuelta al titular" },
      ],
    });
    expect(tareaParaPreguntar([devuelta], HOY, [])?.card.id).toBe("c1");
  });
  it("sin historial usa created_at como referencia", () => {
    const sinHist = card({ history: [], created_at: "2026-07-01T10:00:00Z" });
    expect(tareaParaPreguntar([sinHist], HOY, [])?.card.id).toBe("c1");
  });
  it("es defensiva ante entradas no-array", () => {
    expect(tareaParaPreguntar(null as unknown as Card[], HOY, [])).toBeNull();
  });
});
