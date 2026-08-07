import { describe, it, expect } from "vitest";
import { checklistIncompleto, motivoChecklist, progresoChecklist } from "./checklist-gate";
import type { Card } from "./types";

function card(over: Partial<Card> = {}): Card {
  return { id: "1", title: "T", owner: "u1", status: "proc", ...over } as Card;
}

/**
 * Un ítem de checklist completo.
 *
 * `done_at` es obligatorio en `ChecklistItem` y las fixtures lo omitían. Los tests pasaban igual
 * —vitest no chequea tipos— y lo agarró `tsc`, que es justamente para lo que se prendió `strict`.
 * Vale la pena el helper: si mañana el tipo suma un campo, se arregla en un solo lugar.
 */
function item(txt: string, done: boolean) {
  return { txt, done, done_at: done ? "2026-08-07T10:00:00Z" : null };
}

describe("checklist que exige estar completo antes de cerrar", () => {
  it("no bloquea si la tarea no lo exige", () => {
    // Esta es LA decisión de diseño de la función, y por eso es el primer test.
    // Se eligió que sea por tarea y no una regla global: mucha gente usa el checklist como
    // notas sueltas, y bloquear siempre haría que borren los ítems para poder cerrar — o sea,
    // se perdería justo el dato que el checklist venía a guardar.
    const c = card({ checklist: [item("a", false)] });
    expect(checklistIncompleto(c)).toBe(false);
  });

  it("bloquea si lo exige y quedan ítems sin tildar", () => {
    const c = card({
      exige_checklist: true,
      checklist: [item("a", true), item("b", false)],
    });
    expect(checklistIncompleto(c)).toBe(true);
  });

  it("deja cerrar cuando están todos tildados", () => {
    const c = card({
      exige_checklist: true,
      checklist: [item("a", true), item("b", true)],
    });
    expect(checklistIncompleto(c)).toBe(false);
  });

  it("no bloquea si lo exige pero no hay checklist", () => {
    // Sin ítems no hay nada que completar. Bloquear acá sería una tarea imposible de cerrar,
    // y una regla que deja trabajo trabado sin salida se termina desactivando entera.
    expect(checklistIncompleto(card({ exige_checklist: true, checklist: [] }))).toBe(false);
    expect(checklistIncompleto(card({ exige_checklist: true }))).toBe(false);
  });

  it("una tarea ya terminada nunca se reporta como bloqueada", () => {
    // Si no, el tablero mostraría el aviso sobre tareas cerradas del mes pasado.
    const c = card({
      status: "term",
      exige_checklist: true,
      checklist: [item("a", false)],
    });
    expect(checklistIncompleto(c)).toBe(false);
  });

  it("el motivo dice cuántos faltan, no un texto genérico", () => {
    // "No se puede cerrar" obliga a abrir la tarea para averiguar por qué. El número evita ese
    // viaje: mismo criterio que `mensajeUsuario`, que siempre dice qué hacer.
    const c = card({
      exige_checklist: true,
      checklist: [item("a", true), item("b", false), item("c", false)],
    });
    expect(motivoChecklist(c)).toBe("Faltan 2 pasos del checklist.");
  });

  it("en singular no dice 'faltan 1'", () => {
    const c = card({ exige_checklist: true, checklist: [item("a", false)] });
    expect(motivoChecklist(c)).toBe("Falta 1 paso del checklist.");
  });

  it("sin motivo devuelve null, no una cadena vacía", () => {
    expect(motivoChecklist(card())).toBeNull();
  });

  it("el progreso sirve para mostrar 3/5 en la tarjeta", () => {
    const c = card({
      checklist: [item("a", true), item("b", true), item("c", false)],
    });
    expect(progresoChecklist(c)).toEqual({ hechos: 2, total: 3 });
  });

  it("progreso sin checklist es 0 de 0, no explota", () => {
    expect(progresoChecklist(card())).toEqual({ hechos: 0, total: 0 });
  });

  it("aguanta un checklist que viene roto de la base", () => {
    // `checklist` es una columna jsonb: puede llegar cualquier cosa. Ante la duda, no bloquear
    // — dejar trabado el trabajo de alguien por un dato mal formado es el peor resultado.
    const roto = card({ exige_checklist: true, checklist: "no soy un array" as never });
    expect(checklistIncompleto(roto)).toBe(false);
    expect(progresoChecklist(roto)).toEqual({ hechos: 0, total: 0 });
  });
});
