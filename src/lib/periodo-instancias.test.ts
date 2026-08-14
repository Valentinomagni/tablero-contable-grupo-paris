import { describe, it, expect } from "vitest";
import { periodoVigente, mesSiguiente, instanciaEnBlanco, mergeCardPeriodo, cardsDelPeriodo, periodosDisponibles, periodoLabel, reencuadrarPeriodo } from "./periodo-instancias";
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
  it("sin fila para esa card (mes futuro) → instancia EN BLANCO", () => {
    const term = card({ id: "c1", status: "term", done_at: "x", checklist: [{ txt: "a", done: true, done_at: "x" }] });
    const res = cardsDelPeriodo([term], [], "2026-08", "2026-07");
    expect(res[0].status).toBe("pend");
    expect(res[0].done_at).toBeNull();
    expect(res[0].checklist[0].done).toBe(false);
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
  it("período VIGENTE → devuelve las cards CRUDAS sin mergear (fuente de verdad = cards)", () => {
    const cards = [card({ id: "c1" })];
    const res = cardsDelPeriodo(cards, [cp({ card_id: "c1", status: "term" })], "2026-07", "2026-07");
    expect(res).toBe(cards);
    expect(res[0].status).toBe("pend");
  });
  it("período NO vigente → sí mergea desde card_periodos", () => {
    const res = cardsDelPeriodo([card({ id: "c1" })], [cp({ card_id: "c1", periodo: "2026-08", status: "term" })], "2026-08", "2026-07");
    expect(res[0].status).toBe("term");
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
  it("incluirFuturo agrega el mes siguiente aunque no tenga datos", () => {
    expect(periodosDisponibles([], "2026-07-23T15:00:00Z", true)).toEqual(["2026-08", "2026-07"]);
  });
  it("sin incluirFuturo (default) NO ofrece el mes que viene", () => {
    expect(periodosDisponibles([], "2026-07-23T15:00:00Z", false)).toEqual(["2026-07"]);
  });
});

describe("mesSiguiente", () => {
  it("suma un mes", () => {
    expect(mesSiguiente("2026-07")).toBe("2026-08");
  });
  it("cruza el año en diciembre", () => {
    expect(mesSiguiente("2026-12")).toBe("2027-01");
  });
  it("formato inválido → devuelve tal cual", () => {
    expect(mesSiguiente("basura")).toBe("basura");
  });
});

describe("instanciaEnBlanco", () => {
  it("arranca en 'pend', destilda el checklist y limpia estado", () => {
    const b = instanciaEnBlanco(card({ status: "term", done_at: "x", proc_at: "y",
      checklist: [{ txt: "a", done: true, done_at: "z" }], comments: [{ who: "u", when: "t", txt: "hola" }] }));
    expect(b.status).toBe("pend");
    expect(b.done_at).toBeNull();
    expect(b.proc_at).toBeNull();
    expect(b.checklist).toEqual([{ txt: "a", done: false, done_at: null }]);
    expect(b.comments).toEqual([]);
    expect(b.history).toEqual([]);
  });
  it("conserva la DEFINICIÓN (title, deps, categoria, etiquetas)", () => {
    const b = instanciaEnBlanco(card({ title: "IVA", deps: ["x"], categoria: "impuestos", etiquetas: ["Peugeot"] }));
    expect(b.title).toBe("IVA");
    expect(b.deps).toEqual(["x"]);
    expect(b.categoria).toBe("impuestos");
    expect(b.etiquetas).toEqual(["Peugeot"]);
  });
  it("reset_policy 'mantener' → arrastra el estado actual sin limpiar", () => {
    const c = card({ status: "term", reset_policy: "mantener" });
    expect(instanciaEnBlanco(c)).toBe(c);
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

// ── Reencuadre al cambiar el mes ────────────────────────────────────────────────
//
// HALLAZGO 5 DE LA AUDITORÍA DEL 05/08. `periodoSel` se fijaba una sola vez, al montar
// (`App.tsx:87`), y el vigente se recalcula en cada render. Nada los re-sincronizaba.
//
// EL ESCENARIO, que es de todos los meses: alguien deja la app abierta el 31/08 y vuelve el
// 01/09. El vigente pasa a septiembre y la selección se queda en agosto. Como agosto escribía
// en las tarjetas y no tiene filas de período, el tablero aparece ENTERO en pendiente, sin
// checklist y sin historial. La persona cree que perdió todo. Y si vuelve a marcar las tareas,
// esas ediciones se escriben en el período de agosto en vez de en las tarjetas: quedan dos
// verdades distintas para el mismo mes, que es peor que la pantalla vacía.
describe("reencuadrarPeriodo", () => {
  it("mueve la selección al mes nuevo si estaba parada en el mes que dejó de ser vigente", () => {
    expect(reencuadrarPeriodo("2026-08", "2026-08", "2026-09")).toBe("2026-09");
  });

  it("NO toca la selección si la persona eligió mirar otro mes a propósito", () => {
    // Estar mirando junio el 1/9 es una decisión, no un descuido. Arrastrarla a septiembre
    // le sacaría de la pantalla lo que fue a buscar, y eso es peor que el bug que arregla.
    expect(reencuadrarPeriodo("2026-06", "2026-08", "2026-09")).toBeNull();
  });

  it("no hace nada mientras el vigente no cambió", () => {
    // Es el caso de todos los renders menos uno al mes. Devolver un valor acá dispararía un
    // setState en cada render y colgaría la app.
    expect(reencuadrarPeriodo("2026-08", "2026-08", "2026-08")).toBeNull();
  });

  it("también sirve para atrás, si el reloj de la máquina se corrige", () => {
    expect(reencuadrarPeriodo("2026-09", "2026-09", "2026-08")).toBe("2026-08");
  });

  it("ante datos rotos no devuelve nada, en vez de mandar a la persona a un mes inventado", () => {
    expect(reencuadrarPeriodo("", "2026-08", "2026-09")).toBeNull();
    expect(reencuadrarPeriodo("2026-08", "", "2026-09")).toBeNull();
    expect(reencuadrarPeriodo("2026-08", "2026-08", "")).toBeNull();
  });
});
