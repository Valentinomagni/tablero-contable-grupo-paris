import { describe, it, expect } from "vitest";
import {
  ordenarColumna, vistaDeColumna, vistaActiva, parseVistas,
  VISTA_DEFECTO, VISTAS_DEFECTO, ORDENES_COLUMNA,
} from "./columna-vista";
import type { Card, Profile } from "./types";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "Tarea", status: "pend", description: "",
    checklist: [], comments: [], history: [],
    done_at: null, due_date: null, recurring: false,
    priority: "media", effort: 2, card_type: "normal", deps: [], created_at: "2026-07-01T00:00:00Z",
    ...over,
  };
}
const SIN_PERFILES: { profiles: Profile[] } = { profiles: [] };

describe("ordenarColumna", () => {
  it("'manual' devuelve el MISMO array (identidad): comportamiento de siempre", () => {
    const cs = [card({ id: "b", title: "B" }), card({ id: "a", title: "A" })];
    expect(ordenarColumna(cs, "manual")).toBe(cs);
  });

  it("no muta el array original", () => {
    const cs = [card({ id: "b", title: "B" }), card({ id: "a", title: "A" })];
    ordenarColumna(cs, "titulo");
    expect(cs.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("'titulo' ordena alfabéticamente en español", () => {
    const cs = [card({ title: "Zapato" }), card({ title: "Ábaco" }), card({ title: "Mesa" })];
    expect(ordenarColumna(cs, "titulo").map((c) => c.title)).toEqual(["Ábaco", "Mesa", "Zapato"]);
  });

  it("'prioridad' ordena alta → media → baja", () => {
    const cs = [card({ priority: "baja" }), card({ priority: "alta" }), card({ priority: "media" })];
    expect(ordenarColumna(cs, "prioridad").map((c) => c.priority)).toEqual(["alta", "media", "baja"]);
  });

  it("'esfuerzo' pone la más pesada primero", () => {
    const cs = [card({ effort: 1 }), card({ effort: 5 }), card({ effort: 2 })];
    expect(ordenarColumna(cs, "esfuerzo").map((c) => c.effort)).toEqual([5, 2, 1]);
  });

  it("'vencimiento': más próximo primero y SIN fecha al final", () => {
    const cs = [
      card({ id: "sin", due_date: null }),
      card({ id: "lejos", due_date: "2026-12-31" }),
      card({ id: "cerca", due_date: "2026-07-05" }),
    ];
    expect(ordenarColumna(cs, "vencimiento").map((c) => c.id)).toEqual(["cerca", "lejos", "sin"]);
  });

  it("'vencimiento' con todas sin fecha: no explota, desempata por título", () => {
    const cs = [card({ title: "B", due_date: null }), card({ title: "A", due_date: null })];
    expect(ordenarColumna(cs, "vencimiento").map((c) => c.title)).toEqual(["A", "B"]);
  });

  it("empates: desempata por título para que el orden sea estable", () => {
    const cs = [card({ title: "B", priority: "alta" }), card({ title: "A", priority: "alta" })];
    expect(ordenarColumna(cs, "prioridad").map((c) => c.title)).toEqual(["A", "B"]);
  });

  it("es defensiva ante entradas no-array", () => {
    expect(ordenarColumna(null as unknown as Card[], "titulo")).toEqual([]);
  });
});

describe("vistaDeColumna", () => {
  it("sin agrupar: un solo bloque con grupo vacío (tablero de siempre)", () => {
    const res = vistaDeColumna([card({ title: "B" }), card({ title: "A" })], VISTA_DEFECTO, SIN_PERFILES);
    expect(res).toHaveLength(1);
    expect(res[0].grupo).toBe("");
    expect(res[0].cards.map((c) => c.title)).toEqual(["B", "A"]); // manual: sin reordenar
  });

  it("ordena DENTRO de cada grupo, sin romper la agrupación", () => {
    const cs = [
      card({ id: "1", categoria: "IVA", due_date: "2026-08-20" }),
      card({ id: "2", categoria: "Sueldos", due_date: "2026-07-01" }),
      card({ id: "3", categoria: "IVA", due_date: "2026-07-10" }),
    ];
    const res = vistaDeColumna(cs, { orden: "vencimiento", agrupar: "categoria" }, SIN_PERFILES);
    const iva = res.find((g) => g.grupo === "IVA")!;
    expect(iva.cards.map((c) => c.id)).toEqual(["3", "1"]);
    // el grupo Sueldos sigue existiendo aparte, no se mezcló por tener fecha más temprana
    expect(res.find((g) => g.grupo === "Sueldos")!.cards.map((c) => c.id)).toEqual(["2"]);
  });

  it("cada columna es independiente: la misma lista con dos vistas da dos resultados", () => {
    const cs = [card({ title: "B", priority: "baja" }), card({ title: "A", priority: "alta" })];
    const porTitulo = vistaDeColumna(cs, { orden: "titulo", agrupar: "ninguno" }, SIN_PERFILES);
    const porPrio = vistaDeColumna(cs, { orden: "prioridad", agrupar: "ninguno" }, SIN_PERFILES);
    expect(porTitulo[0].cards.map((c) => c.title)).toEqual(["A", "B"]);
    expect(porPrio[0].cards.map((c) => c.title)).toEqual(["A", "B"]);
    // y con orden inverso de prioridad se nota la diferencia:
    const cs2 = [card({ title: "A", priority: "baja" }), card({ title: "B", priority: "alta" })];
    expect(vistaDeColumna(cs2, { orden: "titulo", agrupar: "ninguno" }, SIN_PERFILES)[0].cards.map((c) => c.title)).toEqual(["A", "B"]);
    expect(vistaDeColumna(cs2, { orden: "prioridad", agrupar: "ninguno" }, SIN_PERFILES)[0].cards.map((c) => c.title)).toEqual(["B", "A"]);
  });

  it("lista vacía → sin bloques", () => {
    expect(vistaDeColumna([], VISTA_DEFECTO, SIN_PERFILES)).toEqual([]);
  });

  it("vista undefined → cae a la de defecto sin romper", () => {
    const res = vistaDeColumna([card()], undefined as unknown as typeof VISTA_DEFECTO, SIN_PERFILES);
    expect(res[0].grupo).toBe("");
  });
});

describe("vistaActiva", () => {
  it("false con la vista por defecto", () => {
    expect(vistaActiva(VISTA_DEFECTO)).toBe(false);
  });
  it("true si hay orden o agrupación", () => {
    expect(vistaActiva({ orden: "titulo", agrupar: "ninguno" })).toBe(true);
    expect(vistaActiva({ orden: "manual", agrupar: "categoria" })).toBe(true);
  });
});

describe("parseVistas", () => {
  it("null → las tres columnas en defecto", () => {
    expect(parseVistas(null)).toEqual(VISTAS_DEFECTO);
  });
  it("JSON inválido → defecto (una preferencia corrupta no deja sin tablero)", () => {
    expect(parseVistas("{{{no soy json")).toEqual(VISTAS_DEFECTO);
  });
  it("lee lo válido y descarta valores que ya no existen", () => {
    const raw = JSON.stringify({
      pend: { orden: "vencimiento", agrupar: "categoria" },
      proc: { orden: "inventado", agrupar: "tampoco" },
      term: { orden: "titulo" },
    });
    const v = parseVistas(raw);
    expect(v.pend).toEqual({ orden: "vencimiento", agrupar: "categoria" });
    expect(v.proc).toEqual(VISTA_DEFECTO);                       // valores inválidos → defecto
    expect(v.term).toEqual({ orden: "titulo", agrupar: "ninguno" });
  });
  it("ignora claves de columnas que no existen", () => {
    expect(parseVistas(JSON.stringify({ otra: { orden: "titulo" } }))).toEqual(VISTAS_DEFECTO);
  });
});

describe("ORDENES_COLUMNA", () => {
  it("expone los cinco criterios, con 'manual' primero", () => {
    expect([...ORDENES_COLUMNA]).toEqual(["manual", "vencimiento", "prioridad", "titulo", "esfuerzo"]);
  });
});
