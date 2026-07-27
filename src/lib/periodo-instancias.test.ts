import { describe, it, expect } from "vitest";
import { periodoVigente, mergeCardPeriodo, cardsDelPeriodo, periodosDisponibles, periodoLabel } from "./periodo-instancias";
import type { Card, CardPeriodo } from "./types";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "IVA", status: "pend", description: "",
    checklist: [{ txt: "a", done: false, done_at: null }], comments: [], history: [],
    done_at: null, due_date: "2026-07-31", recurring: false,
    priority: "media", effort: 2, card_type: "normal", deps: [], created_at: "2026-07-01T00:00:00Z",
    recur_rule: null, categoria: "impuestos", etiquetas: ["Peugeot"],
    ...over,
  };
}

function cp(over: Partial<CardPeriodo> = {}): CardPeriodo {
  return {
    id: "p1", card_id: "c1", owner: "u1", periodo: "2026-07", status: "term",
    checklist: [{ txt: "a", done: true, done_at: "2026-07-10T00:00:00Z" }],
    comments: [{ who: "u1", when: "2026-07-10T00:00:00Z", txt: "listo" }],
    history: [{ who: "u1", at: "2026-07-10T00:00:00Z", txt: "terminado" }],
    done_at: "2026-07-10T00:00:00Z", proc_at: "2026-07-05T00:00:00Z",
    due_date: "2026-07-20", created_at: "2026-07-01T00:00:00Z",
    ...over,
  };
}

describe("periodoVigente", () => {
  it("devuelve 'YYYY-MM' del mes de hoy en ART", () => {
    expect(periodoVigente("2026-07-23T15:00:00Z")).toBe("2026-07");
  });
  it("respeta el corte de zona ART: medianoche UTC del día 1 sigue siendo el mes anterior", () => {
    // 2026-08-01T00:00:00Z en ART (UTC-3) es 2026-07-31 21:00 → mes 2026-07
    expect(periodoVigente("2026-08-01T00:00:00Z")).toBe("2026-07");
  });
});

describe("mergeCardPeriodo", () => {
  it("cp null → devuelve la card tal cual (fallback)", () => {
    const c = card();
    expect(mergeCardPeriodo(c, null)).toBe(c);
  });
  it("toma el ESTADO del período (status/checklist/comments/history/tiempos)", () => {
    const m = mergeCardPeriodo(card(), cp());
    expect(m.status).toBe("term");
    expect(m.checklist[0].done).toBe(true);
    expect(m.comments).toHaveLength(1);
    expect(m.history).toHaveLength(1);
    expect(m.done_at).toBe("2026-07-10T00:00:00Z");
    expect(m.proc_at).toBe("2026-07-05T00:00:00Z");
    expect(m.due_date).toBe("2026-07-20");
  });
  it("respeta la DEFINICIÓN de la card (title/owner/recur/priority/effort/deps/categoria/etiquetas)", () => {
    const m = mergeCardPeriodo(
      card({ title: "IVA", priority: "alta", effort: 5, deps: ["x"], categoria: "impuestos", etiquetas: ["Peugeot"] }),
      cp(),
    );
    expect(m.title).toBe("IVA");
    expect(m.priority).toBe("alta");
    expect(m.effort).toBe(5);
    expect(m.deps).toEqual(["x"]);
    expect(m.categoria).toBe("impuestos");
    expect(m.etiquetas).toEqual(["Peugeot"]);
  });
  it("no muta la card original", () => {
    const c = card();
    mergeCardPeriodo(c, cp());
    expect(c.status).toBe("pend");
  });
});

describe("cardsDelPeriodo", () => {
  it("mergea cada card no operativa con su fila del período", () => {
    const res = cardsDelPeriodo([card({ id: "c1" })], [cp({ card_id: "c1" })], "2026-07");
    expect(res[0].status).toBe("term");
  });
  it("sin fila para esa card → fallback a la card", () => {
    const res = cardsDelPeriodo([card({ id: "c1" })], [], "2026-07");
    expect(res[0].status).toBe("pend");
  });
  it("ignora filas de OTRO período", () => {
    const res = cardsDelPeriodo([card({ id: "c1" })], [cp({ card_id: "c1", periodo: "2026-06" })], "2026-07");
    expect(res[0].status).toBe("pend");
  });
  it("card operativa no se toca (se devuelve tal cual, sin merge)", () => {
    const oper = card({ id: "op1", card_type: "operativa", status: "pend" });
    const res = cardsDelPeriodo([oper], [cp({ card_id: "op1", status: "term" })], "2026-07");
    expect(res[0]).toBe(oper);
    expect(res[0].status).toBe("pend");
  });
  it("sin períodos (base sin migrar) → todas las cards tal cual", () => {
    const cards = [card({ id: "c1" }), card({ id: "c2" })];
    const res = cardsDelPeriodo(cards, [], "2026-07");
    expect(res.map((c) => c.status)).toEqual(["pend", "pend"]);
  });
});

describe("periodosDisponibles", () => {
  it("incluye el vigente aunque no haya datos", () => {
    expect(periodosDisponibles([], "2026-07-23T15:00:00Z")).toEqual(["2026-07"]);
  });
  it("une datos + vigente, únicos y en orden descendente", () => {
    const ps = [cp({ periodo: "2026-06" }), cp({ periodo: "2026-08" }), cp({ periodo: "2026-06" })];
    expect(periodosDisponibles(ps, "2026-07-23T15:00:00Z")).toEqual(["2026-08", "2026-07", "2026-06"]);
  });
  it("descarta períodos con formato inválido", () => {
    const ps = [cp({ periodo: "basura" }), cp({ periodo: "2026-05" })];
    expect(periodosDisponibles(ps, "2026-07-23T15:00:00Z")).toEqual(["2026-07", "2026-05"]);
  });
});

describe("periodoLabel", () => {
  it("formatea 'YYYY-MM' como 'Mes Año' capitalizado", () => {
    expect(periodoLabel("2026-07")).toBe("Julio 2026");
    expect(periodoLabel("2026-01")).toBe("Enero 2026");
  });
  it("formato inválido → devuelve el valor tal cual", () => {
    expect(periodoLabel("basura")).toBe("basura");
    expect(periodoLabel("")).toBe("");
  });
});
