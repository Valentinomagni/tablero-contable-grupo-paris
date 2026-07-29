import { describe, it, expect } from "vitest";
import { resumenDeSemana, esMomentoDeResumen, MAX_TITULOS } from "./tu-semana";
import type { Card } from "./types";

// Semana de referencia: lunes 2026-07-20 a domingo 2026-07-26.
const VIERNES_TARDE = "2026-07-24T17:00:00";
const MIERCOLES = "2026-07-22T17:00:00";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "IVA", status: "term", description: "",
    checklist: [], comments: [], history: [], done_at: "2026-07-22T10:00:00",
    proc_at: null, due_date: null, recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-07-01T00:00:00", ...over,
  };
}

describe("esMomentoDeResumen", () => {
  it("el viernes a la tarde sí", () => {
    expect(esMomentoDeResumen(VIERNES_TARDE)).toBe(true);
  });
  it("el viernes a la mañana todavía no: la semana está pasando", () => {
    expect(esMomentoDeResumen("2026-07-24T09:00:00")).toBe(false);
  });
  it("el fin de semana sí", () => {
    expect(esMomentoDeResumen("2026-07-25T11:00:00")).toBe(true); // sábado
    expect(esMomentoDeResumen("2026-07-26T11:00:00")).toBe(true); // domingo
  });
  it("de lunes a jueves no", () => {
    expect(esMomentoDeResumen(MIERCOLES)).toBe(false);
  });
  it("es defensiva ante una fecha inválida", () => {
    expect(esMomentoDeResumen("no es fecha")).toBe(false);
  });
});

describe("resumenDeSemana", () => {
  it("lista los títulos de lo terminado, no un número suelto", () => {
    const cards = [card({ id: "a", title: "IVA junio" }), card({ id: "b", title: "F931" })];
    const r = resumenDeSemana(cards, "u1", VIERNES_TARDE)!;
    expect(r.titulos).toContain("IVA junio");
    expect(r.titulos).toContain("F931");
    expect(r.total).toBe(2);
  });

  it("ordena del cierre más reciente al más viejo", () => {
    const cards = [
      card({ id: "a", title: "Vieja", done_at: "2026-07-20T09:00:00" }),
      card({ id: "b", title: "Nueva", done_at: "2026-07-23T09:00:00" }),
    ];
    expect(resumenDeSemana(cards, "u1", VIERNES_TARDE)!.titulos[0]).toBe("Nueva");
  });

  it("recorta la lista para que siga siendo legible, sin perder el total", () => {
    const cards = Array.from({ length: 15 }, (_, i) => card({ id: `c${i}`, title: `T${i}` }));
    const r = resumenDeSemana(cards, "u1", VIERNES_TARDE)!;
    expect(r.titulos).toHaveLength(MAX_TITULOS);
    expect(r.total).toBe(15);
  });

  // REGLA DURA de P4: si la semana estuvo mal, la tarjeta se calla, no reta.
  it("si no terminó nada, NO muestra nada (no existe versión 'floja' de la tarjeta)", () => {
    const cards = [card({ status: "pend", done_at: null })];
    expect(resumenDeSemana(cards, "u1", VIERNES_TARDE)).toBeNull();
  });

  it("no se muestra de lunes a jueves", () => {
    expect(resumenDeSemana([card()], "u1", MIERCOLES)).toBeNull();
  });

  it("cuenta lo cerrado EN FECHA y nunca informa la contracara", () => {
    const cards = [
      card({ id: "a", due_date: "2026-07-23", done_at: "2026-07-22T10:00:00" }), // en fecha
      card({ id: "b", due_date: "2026-07-21", done_at: "2026-07-23T10:00:00" }), // tarde
    ];
    const r = resumenDeSemana(cards, "u1", VIERNES_TARDE)!;
    expect(r.enFecha).toBe(1);
    expect(r.total).toBe(2);
    // Lo tarde no se expone como campo propio: sólo existe lo positivo.
    expect(r).not.toHaveProperty("tarde");
    expect(r).not.toHaveProperty("vencidas");
  });

  it("sin vencimiento no hay incumplimiento posible: cuenta como en fecha", () => {
    const r = resumenDeSemana([card({ due_date: null })], "u1", VIERNES_TARDE)!;
    expect(r.enFecha).toBe(1);
  });

  it("cerrar el mismo día del vencimiento es en fecha", () => {
    const cards = [card({ due_date: "2026-07-22", done_at: "2026-07-22T23:00:00" })];
    expect(resumenDeSemana(cards, "u1", VIERNES_TARDE)!.enFecha).toBe(1);
  });

  it("no incluye lo de otras personas: es un espejo personal, sin comparación", () => {
    const cards = [card({ id: "a", owner: "u1" }), card({ id: "b", owner: "u2", title: "De otro" })];
    const r = resumenDeSemana(cards, "u1", VIERNES_TARDE)!;
    expect(r.total).toBe(1);
    expect(r.titulos).not.toContain("De otro");
  });

  it("no incluye operativas: son de alto volumen y taparían el resto", () => {
    const cards = [card({ id: "a" }), card({ id: "b", card_type: "operativa", title: "Facturas" })];
    const r = resumenDeSemana(cards, "u1", VIERNES_TARDE)!;
    expect(r.total).toBe(1);
    expect(r.titulos).not.toContain("Facturas");
  });

  it("no incluye lo terminado en semanas anteriores", () => {
    const cards = [
      card({ id: "a", title: "Esta semana" }),
      card({ id: "b", title: "La anterior", done_at: "2026-07-15T10:00:00" }),
    ];
    const r = resumenDeSemana(cards, "u1", VIERNES_TARDE)!;
    expect(r.total).toBe(1);
    expect(r.titulos).toEqual(["Esta semana"]);
  });

  it("informa el rango de la semana, de lunes a domingo", () => {
    const r = resumenDeSemana([card()], "u1", VIERNES_TARDE)!;
    expect(r.desde).toBe("2026-07-20");
    expect(r.hasta).toBe("2026-07-26");
  });

  it("es defensiva ante entradas raras", () => {
    expect(resumenDeSemana(null as unknown as Card[], "u1", VIERNES_TARDE)).toBeNull();
    expect(resumenDeSemana([card()], "", VIERNES_TARDE)).toBeNull();
    expect(resumenDeSemana([card()], "u1", "no es fecha")).toBeNull();
  });
});

describe("racha — sólo cuando de verdad la hay", () => {
  it("una sola semana buena NO es una racha", () => {
    expect(resumenDeSemana([card({ due_date: "2026-07-23" })], "u1", VIERNES_TARDE)!.racha).toBe(0);
  });

  it("dos semanas seguidas cerrando en fecha sí lo son", () => {
    const cards = [
      card({ id: "a", due_date: "2026-07-23", done_at: "2026-07-22T10:00:00" }),
      card({ id: "b", due_date: "2026-07-16", done_at: "2026-07-15T10:00:00" }),
    ];
    expect(resumenDeSemana(cards, "u1", VIERNES_TARDE)!.racha).toBe(2);
  });

  it("una entrega tarde en la semana previa corta la racha", () => {
    const cards = [
      card({ id: "a", due_date: "2026-07-23", done_at: "2026-07-22T10:00:00" }),
      card({ id: "b", due_date: "2026-07-14", done_at: "2026-07-16T10:00:00" }),
    ];
    expect(resumenDeSemana(cards, "u1", VIERNES_TARDE)!.racha).toBe(0);
  });

  // Cortar la racha por estar de vacaciones sería un reproche encubierto.
  it("una semana sin actividad no corta la racha ni la alarga", () => {
    const cards = [
      card({ id: "a", due_date: "2026-07-23", done_at: "2026-07-22T10:00:00" }),
      // 2026-07-13 a 07-19 sin nada (licencia)
      card({ id: "b", due_date: "2026-07-09", done_at: "2026-07-08T10:00:00" }),
    ];
    expect(resumenDeSemana(cards, "u1", VIERNES_TARDE)!.racha).toBe(2);
  });
});
