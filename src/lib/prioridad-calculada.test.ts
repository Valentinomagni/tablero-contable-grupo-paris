import { describe, it, expect } from "vitest";
import { puntajeDeOrden, porQueVaPrimero, PESOS_POR_DEFECTO } from "./prioridad-calculada";
import type { Card } from "./types";

const HOY = "2026-08-04T12:00:00Z";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "T", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, proc_at: null,
    due_date: null, recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-08-01T09:00:00Z", ...over,
  };
}

describe("puntajeDeOrden", () => {
  it("lo vencido pesa más que lo que vence lejos", () => {
    const vencida = card({ id: "a", due_date: "2026-08-01" });
    const lejana = card({ id: "b", due_date: "2026-09-30" });
    expect(puntajeDeOrden(vencida, [], PESOS_POR_DEFECTO, HOY))
      .toBeGreaterThan(puntajeDeOrden(lejana, [], PESOS_POR_DEFECTO, HOY));
  });

  it("la prioridad alta pesa más que la baja", () => {
    const alta = card({ id: "a", priority: "alta" });
    const baja = card({ id: "b", priority: "baja" });
    expect(puntajeDeOrden(alta, [], PESOS_POR_DEFECTO, HOY))
      .toBeGreaterThan(puntajeDeOrden(baja, [], PESOS_POR_DEFECTO, HOY));
  });

  // Que otros dependan de una tarea la vuelve urgente aunque no lo parezca: mientras no se
  // haga, hay gente parada.
  it("una tarea que bloquea a otras pesa más", () => {
    const bloqueante = card({ id: "a" });
    const dependiente = card({ id: "b", deps: ["a"] });
    expect(puntajeDeOrden(bloqueante, [bloqueante, dependiente], PESOS_POR_DEFECTO, HOY))
      .toBeGreaterThan(puntajeDeOrden(bloqueante, [bloqueante], PESOS_POR_DEFECTO, HOY));
  });

  it("a igualdad de todo, la más rápida va primero", () => {
    const rapida = card({ id: "a", effort: 1 });
    const larga = card({ id: "b", effort: 5 });
    expect(puntajeDeOrden(rapida, [], PESOS_POR_DEFECTO, HOY))
      .toBeGreaterThan(puntajeDeOrden(larga, [], PESOS_POR_DEFECTO, HOY));
  });

  it("los pesos cambian el resultado, que es el punto de que sean configurables", () => {
    const alta = card({ priority: "alta" });
    const sinPeso = { ...PESOS_POR_DEFECTO, prioridad: 0 };
    expect(puntajeDeOrden(alta, [], sinPeso, HOY))
      .toBeLessThan(puntajeDeOrden(alta, [], PESOS_POR_DEFECTO, HOY));
  });

  it("nunca devuelve NaN, ni con datos incompletos", () => {
    // `effort: undefined` es el caso real de una tarea vieja sin esfuerzo cargado. El plan lo
    // escribía con un cast a `number`, pero el tipo `Card.effort` ya admite `undefined`.
    const rota = card({ due_date: "no es fecha", effort: undefined });
    expect(Number.isFinite(puntajeDeOrden(rota, [], PESOS_POR_DEFECTO, HOY))).toBe(true);
    expect(Number.isFinite(puntajeDeOrden(null as unknown as Card, [], PESOS_POR_DEFECTO, HOY))).toBe(true);
  });
});

describe("porQueVaPrimero", () => {
  it("explica en texto, no con un número suelto", () => {
    const c = card({ due_date: "2026-08-01", priority: "alta" });
    const motivos = porQueVaPrimero(c, [], PESOS_POR_DEFECTO, HOY);
    expect(motivos.join(" ")).toMatch(/vencid/i);
    expect(motivos.join(" ")).toMatch(/prioridad/i);
  });

  it("si no hay nada que destacar, no inventa un motivo", () => {
    expect(porQueVaPrimero(card(), [], PESOS_POR_DEFECTO, HOY)).toEqual([]);
  });

  it("los motivos hablan de la tarea, nunca de quien la tiene", () => {
    const c = card({ due_date: "2026-08-01", priority: "alta", owner: "u1" });
    expect(porQueVaPrimero(c, [], PESOS_POR_DEFECTO, HOY).join(" ")).not.toMatch(/u1|responsable|persona/i);
  });
});
