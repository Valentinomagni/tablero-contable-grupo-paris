import { describe, it, expect } from "vitest";
import { itemsDelDia } from "./midia";
import type { Card } from "./types";

function mk(p: Partial<Card>): Card {
  return {
    id: "c", owner: "u1", title: "Tarea", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2026-07-01T00:00:00Z", ...p,
  };
}

const HOY = "2026-07-18";

describe("itemsDelDia", () => {
  it("clasifica vencida, vence-hoy y alta", () => {
    const cards = [
      mk({ id: "venc", due_date: "2026-07-10" }),
      mk({ id: "hoy", due_date: HOY }),
      mk({ id: "alta", priority: "alta" }),
    ];
    const items = itemsDelDia(cards, HOY);
    expect(items.map((i) => [i.card.id, i.motivo])).toEqual([
      ["venc", "vencida"],
      ["hoy", "vence-hoy"],
      ["alta", "alta"],
    ]);
  });

  it("ordena por urgencia: vencida > vence-hoy > alta", () => {
    const cards = [
      mk({ id: "alta", priority: "alta" }),
      mk({ id: "hoy", due_date: HOY }),
      mk({ id: "venc", due_date: "2026-07-01" }),
    ];
    expect(itemsDelDia(cards, HOY).map((i) => i.card.id)).toEqual(["venc", "hoy", "alta"]);
  });

  it("no duplica: una card vencida y alta aparece una vez como vencida", () => {
    const cards = [mk({ id: "x", due_date: "2026-07-10", priority: "alta" })];
    const items = itemsDelDia(cards, HOY);
    expect(items).toHaveLength(1);
    expect(items[0].motivo).toBe("vencida");
  });

  it("una card que vence hoy con prioridad alta aparece como vence-hoy", () => {
    const cards = [mk({ id: "x", due_date: HOY, priority: "alta" })];
    expect(itemsDelDia(cards, HOY)[0].motivo).toBe("vence-hoy");
  });

  it("excluye terminadas, operativas y sin motivo", () => {
    const cards = [
      mk({ id: "term", due_date: "2026-07-01", status: "term" }),
      mk({ id: "oper", priority: "alta", card_type: "operativa" }),
      mk({ id: "futura", due_date: "2026-07-25" }),
      mk({ id: "media", priority: "media" }),
    ];
    expect(itemsDelDia(cards, HOY)).toEqual([]);
  });
});
