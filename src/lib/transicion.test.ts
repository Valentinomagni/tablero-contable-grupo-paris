import { describe, it, expect } from "vitest";
import { bloqueoDeTransicion, puedeCerrar } from "./transicion";
import type { Card } from "./types";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "Conciliación", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2026-08-01T00:00:00Z", ...over,
  };
}

describe("de dónde a dónde se puede mover una tarea", () => {
  it("de Pendiente a En proceso, sí", () => {
    expect(bloqueoDeTransicion(card({ status: "pend" }), "proc")).toBeNull();
  });

  // LA REGLA QUE PIDIÓ EL DUEÑO. Saltar de Pendiente a Terminado significa que la tarea nunca
  // estuvo "en proceso", y entonces el tiempo de ciclo de TODO el equipo se calcula sobre una
  // ficción: `proc_at` queda en null y la tarea figura resuelta en cero horas.
  it("de Pendiente a Terminado, NO", () => {
    const m = bloqueoDeTransicion(card({ status: "pend" }), "term");
    expect(m).toContain("En proceso");
  });

  it("de En proceso a Terminado, sí", () => {
    expect(bloqueoDeTransicion(card({ status: "proc" }), "term")).toBeNull();
  });

  it("volver atrás siempre se puede", () => {
    // Reabrir es legítimo y ya se registra como reapertura en el historial. Bloquearlo
    // empujaría a crear una tarea nueva, y ahí se pierde el rastro de que fue la misma.
    expect(bloqueoDeTransicion(card({ status: "term" }), "proc")).toBeNull();
    expect(bloqueoDeTransicion(card({ status: "term" }), "pend")).toBeNull();
    expect(bloqueoDeTransicion(card({ status: "proc" }), "pend")).toBeNull();
  });

  it("quedarse donde está no es una transición", () => {
    expect(bloqueoDeTransicion(card({ status: "pend" }), "pend")).toBeNull();
  });
});

describe("el checklist tiene que estar completo para cerrar", () => {
  const conChecklist = (hechos: number, total: number, status: Card["status"] = "proc") =>
    card({
      status,
      checklist: Array.from({ length: total }, (_, i) => ({
        txt: `paso ${i}`, done: i < hechos, done_at: i < hechos ? "2026-08-10T12:00:00Z" : null,
      })),
    });

  // SIN FLAG. Antes esto dependía de `exige_checklist`, que arranca en false y sólo se podía
  // prender al crear la tarea: ninguna tarea existente lo tenía, así que la regla no existía
  // en la práctica. Si alguien escribió un checklist, es porque esos pasos hay que hacerlos.
  it("con pasos sin marcar, NO se puede cerrar", () => {
    const m = bloqueoDeTransicion(conChecklist(2, 5), "term");
    expect(m).toContain("3");
  });

  it("con todos los pasos marcados, sí", () => {
    expect(bloqueoDeTransicion(conChecklist(5, 5), "term")).toBeNull();
  });

  it("sin checklist no hay nada que completar", () => {
    // Bloquear acá sería un callejón sin salida: la persona no puede completar una lista vacía.
    expect(bloqueoDeTransicion(card({ status: "proc", checklist: [] }), "term")).toBeNull();
  });

  it("el checklist no estorba para volver atrás", () => {
    expect(bloqueoDeTransicion(conChecklist(2, 5, "term"), "proc")).toBeNull();
  });

  it("dice CUÁNTOS faltan, no sólo que no se puede", () => {
    // Un "no se puede cerrar" genérico obliga a abrir la tarea para averiguar por qué.
    expect(bloqueoDeTransicion(conChecklist(4, 5), "term")).toContain("1");
  });
});

describe("puedeCerrar", () => {
  it("es el atajo para el botón: false si algo bloquea", () => {
    expect(puedeCerrar(card({ status: "pend" }))).toBe(false);
    expect(puedeCerrar(card({ status: "proc" }))).toBe(true);
  });
});

describe("ante datos rotos no bloquea", () => {
  // Una tarea que no se puede cerrar por un dato corrupto es peor que una que se cierra de más:
  // la segunda se arregla, la primera deja a alguien trabado sin entender por qué.
  it("sin card, sin bloqueo", () => {
    expect(bloqueoDeTransicion(null as unknown as Card, "term")).toBeNull();
  });

  it("checklist que no es lista, sin bloqueo", () => {
    expect(bloqueoDeTransicion(card({ status: "proc", checklist: "x" as never }), "term")).toBeNull();
  });
});
