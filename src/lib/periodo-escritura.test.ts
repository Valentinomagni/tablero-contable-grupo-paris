import { describe, it, expect } from "vitest";
import { CAMPOS_ESTADO, escribeEnPeriodo, filaPeriodo, soloDefinicion } from "./periodo-escritura";
import type { Card } from "./types";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "IVA", status: "pend", description: "",
    checklist: [{ txt: "a", done: false, done_at: null }], comments: [], history: [],
    done_at: null, proc_at: null, due_date: "2026-08-31", recurring: false,
    priority: "media", effort: 2, card_type: "normal", deps: [], created_at: "2026-07-01T00:00:00Z",
    recur_rule: null, categoria: "impuestos", etiquetas: [],
    ...over,
  };
}

describe("escribeEnPeriodo — gate de ruteo", () => {
  it("false si la migración 32 no está aplicada (aunque el período no sea el vigente)", () => {
    expect(escribeEnPeriodo([29, 31], "2026-08", "2026-07", "normal")).toBe(false);
    expect(escribeEnPeriodo(null, "2026-08", "2026-07", "normal")).toBe(false);
  });
  it("false para el período VIGENTE (ese sigue escribiendo en cards, sin cambios)", () => {
    expect(escribeEnPeriodo([32], "2026-07", "2026-07", "normal")).toBe(false);
  });
  it("false para cards operativas (no tienen instancia por período)", () => {
    expect(escribeEnPeriodo([32], "2026-08", "2026-07", "operativa")).toBe(false);
  });
  it("true solo con migración 32 + período NO vigente + card normal", () => {
    expect(escribeEnPeriodo([32], "2026-08", "2026-07", "normal")).toBe(true);
    expect(escribeEnPeriodo([29, 31, 32], "2026-09", "2026-07", "normal")).toBe(true);
  });
});

describe("CAMPOS_ESTADO", () => {
  it("son exactamente los 7 campos de estado de trabajo", () => {
    expect([...CAMPOS_ESTADO].sort()).toEqual(
      ["checklist", "comments", "done_at", "due_date", "history", "proc_at", "status"].sort(),
    );
  });
});

describe("soloDefinicion — parte de un patch que va a `cards`", () => {
  it("quita los campos de estado, deja los de definición", () => {
    const def = soloDefinicion({ status: "term", title: "Nuevo", priority: "alta", checklist: [] });
    expect(def).toEqual({ title: "Nuevo", priority: "alta" });
  });
  it("un patch de puro estado queda vacío (nada que escribir en cards)", () => {
    expect(soloDefinicion({ status: "proc", proc_at: "x", history: [] })).toEqual({});
  });
  it("no muta el patch original", () => {
    const p = { status: "term" as const, title: "X" };
    soloDefinicion(p);
    expect(p.status).toBe("term");
  });
});

describe("filaPeriodo — fila para upsert en card_periodos", () => {
  it("combina el estado ACTUAL de la card (ya mergeada) con el patch", () => {
    const c = card({ status: "proc", proc_at: "2026-08-02T00:00:00Z", checklist: [{ txt: "a", done: true, done_at: "x" }] });
    const fila = filaPeriodo(c, "2026-08", { status: "term", done_at: "2026-08-10T00:00:00Z" });
    expect(fila.card_id).toBe("c1");
    expect(fila.owner).toBe("u1");
    expect(fila.periodo).toBe("2026-08");
    expect(fila.status).toBe("term");                 // del patch
    expect(fila.done_at).toBe("2026-08-10T00:00:00Z"); // del patch
    expect(fila.proc_at).toBe("2026-08-02T00:00:00Z"); // conservado de la card
    expect(fila.checklist).toEqual([{ txt: "a", done: true, done_at: "x" }]); // conservado
    expect(fila.comments).toEqual([]);
    expect(fila.history).toEqual([]);
    expect(fila.due_date).toBe("2026-08-31");
  });
  it("incluye SIEMPRE los 7 campos de estado (upsert idempotente, sin undefined)", () => {
    const fila = filaPeriodo(card(), "2026-08", { checklist: [{ txt: "b", done: false, done_at: null }] });
    for (const k of CAMPOS_ESTADO) expect(fila).toHaveProperty(k);
    expect(fila.checklist).toEqual([{ txt: "b", done: false, done_at: null }]);
  });
  it("no arrastra campos de definición del patch (title, priority) a la fila", () => {
    const fila = filaPeriodo(card(), "2026-08", { status: "term", title: "no-va", priority: "alta" } as Partial<Card>);
    expect(fila).not.toHaveProperty("title");
    expect(fila).not.toHaveProperty("priority");
  });
});
