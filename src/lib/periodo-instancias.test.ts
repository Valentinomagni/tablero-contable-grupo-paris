import { describe, it, expect } from "vitest";
import { periodoVigente, mesSiguiente, instanciaEnBlanco, mergeCardPeriodo, cardsDelPeriodo, periodosDisponibles, periodoLabel, reencuadrarPeriodo, fuenteDelMes, resolverMesPasado } from "./periodo-instancias";
import type { Card, CardPeriodo, CardArchive } from "./types";

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

// ── Una fila ya volcada no se vuelve a leer ─────────────────────────────────────
//
// HALLAZGO 4 DE LA AUDITORÍA DEL 05/08, la segunda mitad. `card_periodos` es el borrador de un
// mes que todavía no llegó. Cuando ese mes pasa a ser el vigente, la app deja de leer de ahí y
// lee de `cards`, así que el reinicio mensual vuelca el trabajo adelantado (migración 51).
//
// Pero volcarlo no alcanza: si esa fila se sigue pudiendo leer, el día que el mes deje de ser
// vigente la vista de períodos la mergearía otra vez y mostraría la foto adelantada POR ENCIMA
// de todo lo que se hizo durante el mes. El trabajo adelantado se salvaría a costa de tapar el
// trabajo real, que es un cambio de un bug por otro peor.
//
// Por eso la fila volcada queda marcada con `aplicado_at` y acá se ignora.
describe("cardsDelPeriodo ignora las filas ya volcadas", () => {
  const base = card({ id: "c1", status: "pend", checklist: [] });

  it("una fila SIN volcar se mergea, como siempre", () => {
    const p = [{ card_id: "c1", periodo: "2026-07", status: "term" } as unknown as CardPeriodo];
    expect(cardsDelPeriodo([base], p, "2026-07", "2026-08")[0].status).toBe("term");
  });

  it("una fila YA VOLCADA no se mergea: su contenido ya vive en la tarjeta", () => {
    const p = [{ card_id: "c1", periodo: "2026-07", status: "term",
      aplicado_at: "2026-08-01T03:05:00Z" } as unknown as CardPeriodo];
    // La tarjeta manda. Si esto devolviera "term", el mes pasado se vería con el estado que
    // tenía cuando era futuro y no con el que quedó al trabajarlo.
    expect(cardsDelPeriodo([base], p, "2026-07", "2026-08")[0].status).toBe("pend");
  });

  it("`aplicado_at` en null es lo mismo que no tenerlo", () => {
    // La columna es nueva: las filas viejas la traen en null y tienen que seguir funcionando.
    const p = [{ card_id: "c1", periodo: "2026-07", status: "term",
      aplicado_at: null } as unknown as CardPeriodo];
    expect(cardsDelPeriodo([base], p, "2026-07", "2026-08")[0].status).toBe("term");
  });
});

// ── De dónde sale cada mes ───────────────────────────────────────────────────────
//
// EL BUG QUE ORIGINA ESTO. El 2/9 el equipo abrió el período de agosto y vio 51 pendientes y 0
// terminadas. Tres personas concluyeron que se había perdido el mes. No se perdió: agosto está
// entero en `cards_archive` —157 tareas, 119 terminadas, verificado— pero el tablero lo mostró
// vacío.
//
// La causa: `cardsDelPeriodo` tenía DOS casos y metía en la misma bolsa el mes que viene y el mes
// pasado. Son opuestos. Para un mes futuro, en blanco es correcto: no pasó nada todavía. Para un
// mes pasado es una mentira: pasó todo.
describe("fuenteDelMes", () => {
  it("el mes en curso son las tarjetas crudas", () => {
    expect(fuenteDelMes("2026-09", "2026-09")).toBe("vigente");
  });

  it("el mes que viene es futuro", () => {
    expect(fuenteDelMes("2026-10", "2026-09")).toBe("futuro");
  });

  it("el mes anterior es PASADO, no 'cualquier otro'", () => {
    expect(fuenteDelMes("2026-08", "2026-09")).toBe("pasado");
  });

  it("distingue bien en el cambio de año", () => {
    expect(fuenteDelMes("2025-12", "2026-01")).toBe("pasado");
    expect(fuenteDelMes("2026-01", "2025-12")).toBe("futuro");
  });

  it("con datos rotos cae en vigente, que se comporta como siempre", () => {
    // Ante la duda, el camino que ya funcionaba. Devolver "pasado" con un dato roto mandaría a
    // buscar un archivo que no existe y dejaría la pantalla diciendo que no hay nada.
    expect(fuenteDelMes("", "2026-09")).toBe("vigente");
    expect(fuenteDelMes("2026-09", "")).toBe("vigente");
    expect(fuenteDelMes(null as unknown as string, "2026-09")).toBe("vigente");
  });
});

describe("resolverMesPasado", () => {
  const arch = (mes: string, c: Card): CardArchive =>
    ({ id: `a-${c.id}-${mes}`, owner: c.owner, mes, card: c, archived_at: `${mes}-28T00:00:00Z` });

  it("sale del archivo y no de las tarjetas de hoy", () => {
    const hoy = [card({ id: "c1", status: "pend" })];
    const archivo = [arch("2026-08", card({ id: "c1", status: "term", done_at: "2026-08-20T12:00:00Z" }))];
    expect(resolverMesPasado(hoy, archivo, [], "2026-08")?.[0].status).toBe("term");
  });

  // LA OTRA MITAD DEL PEDIDO, y no estaba a la vista hasta escribir esto. Hoy la vista de agosto
  // recorre las tarjetas DE HOY: una tarea creada en septiembre aparece en agosto, y una que
  // existió en agosto y se borró después no aparece. El archivo tiene las tareas que el mes tuvo.
  it("muestra las tareas que ese mes tuvo, no las de hoy", () => {
    const hoy = [card({ id: "nueva-de-septiembre" })];
    const archivo = [arch("2026-08", card({ id: "vieja-de-agosto", status: "term" }))];
    expect(resolverMesPasado(hoy, archivo, [], "2026-08")?.map((c) => c.id)).toEqual(["vieja-de-agosto"]);
  });

  it("ignora las filas de archivo de OTROS meses", () => {
    const archivo = [
      arch("2026-07", card({ id: "de-julio" })),
      arch("2026-08", card({ id: "de-agosto" })),
    ];
    expect(resolverMesPasado([], archivo, [], "2026-08")?.map((c) => c.id)).toEqual(["de-agosto"]);
  });

  // LA CORRECCIÓN POSTERIOR. Sin esta regla, reabrir agosto en octubre y arreglar una tarea no se
  // vería nunca: la foto del archivo la taparía. Y era el pedido textual — "volver para atrás 2
  // meses después, reabrir determinada tarea porque estaba mal y dejar asentado que se terminó".
  it("una fila de card_periodos posterior gana sobre la foto", () => {
    const archivo = [arch("2026-08", card({ id: "c1", status: "pend" }))];
    const periodos = [{ card_id: "c1", periodo: "2026-08", status: "term" } as unknown as CardPeriodo];
    expect(resolverMesPasado([], archivo, periodos, "2026-08")?.[0].status).toBe("term");
  });

  it("una fila YA VOLCADA no gana", () => {
    // Las filas con `aplicado_at` se aplicaron sobre `cards` (migraciones 51 y 56). Volver a
    // leerlas taparía el trabajo real del mes con la foto adelantada.
    const archivo = [arch("2026-08", card({ id: "c1", status: "term" }))];
    const periodos = [{ card_id: "c1", periodo: "2026-08", status: "pend",
      aplicado_at: "2026-09-01T03:00:00Z" } as unknown as CardPeriodo];
    expect(resolverMesPasado([], archivo, periodos, "2026-08")?.[0].status).toBe("term");
  });

  // "NO SÉ" NO ES "NO HABÍA NADA". Es la regla que cierra el agujero de fondo: el bug de agosto
  // no fue que el código estuviera mal, fue que una falla se dibujó como un dato con confianza
  // —cero terminadas, prolijo, creíble— y tres personas le creyeron.
  it("sin archivo devuelve null, NO una lista vacía ni tarjetas en blanco", () => {
    expect(resolverMesPasado([card()], [], [], "2026-08")).toBeNull();
  });

  it("ante datos rotos devuelve null, no algo a medias", () => {
    expect(resolverMesPasado([], undefined as unknown as CardArchive[], [], "2026-08")).toBeNull();
    expect(resolverMesPasado([], [arch("2026-08", card())], [], "")).toBeNull();
  });
});
