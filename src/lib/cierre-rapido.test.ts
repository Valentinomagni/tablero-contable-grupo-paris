import { describe, it, expect } from "vitest";
import { sePuedeCerrarRapido, patchCierreRapido, MOTIVO_NO_RAPIDO } from "./cierre-rapido";
import type { Card } from "./types";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "IVA", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, proc_at: null,
    due_date: "2026-07-20", recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-07-01T00:00:00Z", ...over,
  };
}

describe("sePuedeCerrarRapido", () => {
  it("una tarea normal abierta se puede cerrar de un toque", () => {
    expect(sePuedeCerrarRapido(card(), [])).toBe(true);
  });

  it("una tarea YA terminada no se vuelve a cerrar", () => {
    expect(sePuedeCerrarRapido(card({ status: "term", done_at: "x" }), [])).toBe(false);
  });

  // REGLA DURA de la propuesta P5: no precargar nada que implique una afirmación de control.
  it("una tarea de CONTROL (arqueo) NO se cierra de un toque: el resultado es una decisión", () => {
    expect(sePuedeCerrarRapido(card({ requiere_resultado: true }), [])).toBe(false);
  });

  it("una tarea BLOQUEADA por dependencias no se cierra de un toque", () => {
    const bloqueada = card({ id: "b", deps: ["dep1"] });
    const dep = card({ id: "dep1", status: "proc" });
    expect(sePuedeCerrarRapido(bloqueada, [bloqueada, dep])).toBe(false);
  });

  it("con la dependencia ya terminada, sí se puede", () => {
    const c = card({ id: "b", deps: ["dep1"] });
    const dep = card({ id: "dep1", status: "term", done_at: "x" });
    expect(sePuedeCerrarRapido(c, [c, dep])).toBe(true);
  });

  it("una tarea PROTEGIDA por un jefe no se cierra de un toque", () => {
    expect(sePuedeCerrarRapido(card({ protected: true }), [])).toBe(false);
  });

  it("es defensiva ante entradas raras", () => {
    expect(sePuedeCerrarRapido(null as unknown as Card, [])).toBe(false);
    expect(sePuedeCerrarRapido(card(), null as unknown as Card[])).toBe(true);
  });
});

describe("MOTIVO_NO_RAPIDO — explica por qué hay que abrir la tarea", () => {
  it("control: dice que el resultado se elige, no se asume", () => {
    expect(MOTIVO_NO_RAPIDO(card({ requiere_resultado: true }), [])).toMatch(/resultado/i);
  });
  it("bloqueada: menciona la dependencia", () => {
    const c = card({ id: "b", deps: ["dep1"] });
    const dep = card({ id: "dep1", status: "proc" });
    expect(MOTIVO_NO_RAPIDO(c, [c, dep])).toMatch(/espera|depende/i);
  });
  it("protegida: lo dice", () => {
    expect(MOTIVO_NO_RAPIDO(card({ protected: true }), [])).toMatch(/protegida/i);
  });
  it("si se puede cerrar, no hay motivo", () => {
    expect(MOTIVO_NO_RAPIDO(card(), [])).toBeNull();
  });
});

describe("patchCierreRapido", () => {
  const AHORA = "2026-07-20T15:00:00Z";

  it("marca terminada y sella la fecha de cierre", () => {
    const p = patchCierreRapido(card(), "Valentino", AHORA);
    expect(p.status).toBe("term");
    expect(p.done_at).toBe(AHORA);
  });

  it("deja rastro en el historial, con quién y cuándo", () => {
    const p = patchCierreRapido(card(), "Valentino", AHORA);
    expect(p.history).toHaveLength(1);
    expect(p.history![0].who).toBe("Valentino");
    expect(p.history![0].at).toBe(AHORA);
  });

  it("conserva el historial previo en vez de pisarlo", () => {
    const c = card({ history: [{ who: "Ana", at: "2026-07-01T10:00:00Z", txt: "Creó la tarea" }] });
    const p = patchCierreRapido(c, "Valentino", AHORA);
    expect(p.history).toHaveLength(2);
    expect(p.history![0].who).toBe("Ana");
  });

  it("si nunca pasó por 'en proceso', sella proc_at para no romper las métricas de tiempo", () => {
    // Sin proc_at, el ICR y el SLA no pueden medir nada sobre esta tarea.
    const p = patchCierreRapido(card({ proc_at: null }), "Valentino", AHORA);
    expect(p.proc_at).toBe(AHORA);
  });

  it("si ya tenía proc_at, NO lo pisa: el arranque real se respeta", () => {
    const p = patchCierreRapido(card({ proc_at: "2026-07-18T09:00:00Z" }), "Valentino", AHORA);
    expect(p.proc_at).toBeUndefined();
  });

  it("no toca campos de definición (titulo, prioridad, categoría)", () => {
    const p = patchCierreRapido(card(), "Valentino", AHORA);
    expect(p).not.toHaveProperty("title");
    expect(p).not.toHaveProperty("priority");
    expect(p).not.toHaveProperty("categoria");
  });
});
