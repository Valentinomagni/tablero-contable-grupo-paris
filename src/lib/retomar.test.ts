import { describe, it, expect } from "vitest";
import { tareaParaRetomar } from "./retomar";
import type { Card } from "./types";

const HOY = "2026-07-20T09:00:00Z";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "Conciliación Banco Nación", status: "proc",
    description: "", checklist: [], comments: [],
    history: [{ who: "Valentino", at: "2026-07-19T17:30:00Z", txt: "Movió la tarea" }],
    done_at: null, due_date: null, recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-07-01T00:00:00Z", ...over,
  };
}

describe("tareaParaRetomar", () => {
  it("devuelve la última tarea que la persona tocó", () => {
    expect(tareaParaRetomar([card()], "u1", HOY)?.title).toBe("Conciliación Banco Nación");
  });

  it("elige la MÁS RECIENTE cuando hay varias", () => {
    const vieja = card({ id: "vieja", history: [{ who: "V", at: "2026-07-15T10:00:00Z", txt: "x" }] });
    const nueva = card({ id: "nueva", history: [{ who: "V", at: "2026-07-19T18:00:00Z", txt: "x" }] });
    expect(tareaParaRetomar([vieja, nueva], "u1", HOY)?.id).toBe("nueva");
  });

  it("sólo mira tareas PROPIAS", () => {
    expect(tareaParaRetomar([card({ owner: "otro" })], "u1", HOY)).toBeNull();
  });

  it("no propone retomar algo ya terminado", () => {
    expect(tareaParaRetomar([card({ status: "term", done_at: "2026-07-19T18:00:00Z" })], "u1", HOY)).toBeNull();
  });

  it("no propone operativas: son a demanda, no algo que se retome", () => {
    expect(tareaParaRetomar([card({ card_type: "operativa" })], "u1", HOY)).toBeNull();
  });

  it("si lo último fue hace mucho, NO muestra nada (arranque frío, no reproche)", () => {
    // 10 días atrás: ya no es "donde quedaste", y recordarlo se leería como un reclamo.
    const vieja = card({ history: [{ who: "V", at: "2026-07-10T10:00:00Z", txt: "x" }] });
    expect(tareaParaRetomar([vieja], "u1", HOY)).toBeNull();
  });

  it("lo tocado hoy mismo tampoco se propone: no hay nada que 'retomar'", () => {
    const hoyMismo = card({ history: [{ who: "V", at: "2026-07-20T08:30:00Z", txt: "x" }] });
    expect(tareaParaRetomar([hoyMismo], "u1", HOY)).toBeNull();
  });

  it("una tarea sin historial no cuenta (no hay señal de que se haya trabajado)", () => {
    expect(tareaParaRetomar([card({ history: [] })], "u1", HOY)).toBeNull();
  });

  it("sin nada que retomar devuelve null, no un objeto vacío", () => {
    expect(tareaParaRetomar([], "u1", HOY)).toBeNull();
  });

  it("es defensiva ante entradas no-array", () => {
    expect(tareaParaRetomar(null as unknown as Card[], "u1", HOY)).toBeNull();
  });
});
