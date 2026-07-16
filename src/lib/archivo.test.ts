import { describe, it, expect } from "vitest";
import { mesesDisponibles, cardsDeArchivo, mesLabel } from "./archivo";
import type { Card, CardArchive } from "./types";

const card = (over: Partial<Card> = {}): Card => ({
  id: "c1", owner: "u1", title: "Conciliación", status: "term", description: "",
  checklist: [{ txt: "banco", done: true, done_at: "2026-06-10T12:00:00Z" }],
  comments: [], history: [], done_at: "2026-06-20T12:00:00Z", due_date: "2026-06-25",
  recurring: false, priority: "alta", effort: 2, card_type: "normal", deps: [],
  created_at: "2026-06-01T00:00:00Z", ...over,
});

const arch = (mes: string, c: unknown, id = "a1"): CardArchive =>
  ({ id, owner: "u1", mes, card: c as Card, archived_at: "2026-07-01T00:00:00Z" });

describe("mesesDisponibles", () => {
  it("únicos, descendente", () =>
    expect(mesesDisponibles([arch("2026-05", card()), arch("2026-06", card()), arch("2026-06", card(), "a2")]))
      .toEqual(["2026-06", "2026-05"]));
  it("sin archivo: vacío", () => expect(mesesDisponibles([])).toEqual([]));
});

describe("cardsDeArchivo", () => {
  it("filtra por mes y devuelve la card del snapshot", () => {
    const out = cardsDeArchivo([arch("2026-06", card()), arch("2026-05", card({ title: "otra" }), "a2")], "2026-06");
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Conciliación");
    expect(out[0].checklist[0].done).toBe(true);
  });
  it("tolera snapshots con campos faltantes (versiones viejas del esquema)", () => {
    const out = cardsDeArchivo([arch("2026-06", { title: "vieja" })], "2026-06");
    expect(out[0].title).toBe("vieja");
    expect(out[0].status).toBe("pend");
    expect(out[0].checklist).toEqual([]);
    expect(out[0].comments).toEqual([]);
    expect(out[0].owner).toBe("u1"); // cae al owner de la fila de archivo
  });
  it("tolera card jsonb null sin crashear", () => {
    const out = cardsDeArchivo([arch("2026-06", null)], "2026-06");
    expect(out[0].title).toBe("(sin título)");
    expect(out[0].id).toBe("a1");
  });
  it("valores inválidos caen a defaults seguros", () => {
    const out = cardsDeArchivo([arch("2026-06", { status: "x", priority: "z", effort: 99, checklist: "no" })], "2026-06");
    expect(out[0].status).toBe("pend");
    expect(out[0].priority).toBe("media");
    expect(out[0].effort).toBe(1);
    expect(out[0].checklist).toEqual([]);
  });
});

describe("mesLabel", () => {
  it("junio 2026", () => expect(mesLabel("2026-06")).toBe("junio 2026"));
  it("diciembre 2025", () => expect(mesLabel("2025-12")).toBe("diciembre 2025"));
  it("formato inválido: devuelve tal cual", () => expect(mesLabel("junio")).toBe("junio"));
  it("mes fuera de rango: devuelve tal cual", () => expect(mesLabel("2026-13")).toBe("2026-13"));
});
