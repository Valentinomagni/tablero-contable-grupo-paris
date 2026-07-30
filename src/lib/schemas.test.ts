import { describe, it, expect, vi, afterEach } from "vitest";
import { saneaCards, validateRows, CardSchema } from "./schemas";

const FILA_OK = {
  id: "c1", owner: "u1", title: "IVA", status: "pend", description: "",
  checklist: [], comments: [], history: [], deps: [], done_at: null, proc_at: null,
  due_date: "2026-07-20", recurring: false, priority: "media", effort: 2,
  card_type: "normal", created_at: "2026-07-01T00:00:00Z",
};

afterEach(() => vi.restoreAllMocks());

describe("saneaCards", () => {
  it("deja pasar una fila correcta sin cambiarla", () => {
    const [c] = saneaCards([FILA_OK]);
    expect(c.id).toBe("c1");
    expect(c.title).toBe("IVA");
    expect(c.effort).toBe(2);
  });

  // Las columnas que no están en el esquema (categoria, etiquetas, tiempo_max_horas, las que
  // agregue la próxima migración) TIENEN que sobrevivir: si el saneado las borrara, arreglar
  // un dato roto costaría perder features enteras.
  it("conserva las columnas que el esquema no nombra", () => {
    const [c] = saneaCards([{ ...FILA_OK, categoria: "IVA", etiquetas: ["a"], tiempo_max_horas: 3 }]);
    expect((c as unknown as { categoria: string }).categoria).toBe("IVA");
    expect((c as unknown as { tiempo_max_horas: number }).tiempo_max_horas).toBe(3);
  });

  // EL CASO QUE MOTIVA TODO: un null donde el componente hace .map() y explota diez niveles
  // más abajo, con un error que no dice nada útil.
  it("convierte los arreglos nulos en arreglos vacíos", () => {
    const [c] = saneaCards([{ ...FILA_OK, checklist: null, comments: null, history: null, deps: null }]);
    expect(c.checklist).toEqual([]);
    expect(c.comments).toEqual([]);
    expect(c.history).toEqual([]);
    expect(c.deps).toEqual([]);
  });

  it("también si vienen como algo que no es un arreglo", () => {
    const [c] = saneaCards([{ ...FILA_OK, checklist: "no soy un arreglo", deps: 42 }]);
    expect(c.checklist).toEqual([]);
    expect(c.deps).toEqual([]);
  });

  it("un estado desconocido cae a pendiente en vez de dejar la tarjeta sin columna", () => {
    expect(saneaCards([{ ...FILA_OK, status: "zaraza" }])[0].status).toBe("pend");
  });

  it("una prioridad desconocida cae a media", () => {
    expect(saneaCards([{ ...FILA_OK, priority: "urgentisima" }])[0].priority).toBe("media");
  });

  it("un tipo de tarjeta desconocido cae a normal", () => {
    expect(saneaCards([{ ...FILA_OK, card_type: "otra cosa" }])[0].card_type).toBe("normal");
  });

  // Un solo NaN contamina TODOS los totales del reporte sin dejar rastro de dónde salió.
  it("un esfuerzo que no es número cae a 1, para que las sumas no den NaN", () => {
    expect(saneaCards([{ ...FILA_OK, effort: "mucho" }])[0].effort).toBe(1);
    expect(saneaCards([{ ...FILA_OK, effort: null }])[0].effort).toBe(1);
  });

  it("un esfuerzo numérico en texto se interpreta, no se descarta", () => {
    expect(saneaCards([{ ...FILA_OK, effort: "3" }])[0].effort).toBe(3);
  });

  it("el título ausente no deja la tarjeta sin nombre", () => {
    expect(saneaCards([{ ...FILA_OK, title: null }])[0].title).toBe("(sin título)");
    expect(saneaCards([{ ...FILA_OK, title: "   " }])[0].title).toBe("(sin título)");
  });

  it("una fecha que no es texto cae a nulo en vez de romper los cálculos", () => {
    expect(saneaCards([{ ...FILA_OK, due_date: 20260720 }])[0].due_date).toBeNull();
  });

  // Sin id o sin owner la tarjeta es inservible: no se puede abrir, ni guardar, ni atribuir.
  it("descarta una fila sin id", () => {
    expect(saneaCards([{ ...FILA_OK, id: null }])).toHaveLength(0);
  });

  it("descarta una fila sin owner", () => {
    expect(saneaCards([{ ...FILA_OK, owner: "" }])).toHaveLength(0);
  });

  it("una fila podrida no se lleva puestas a las buenas", () => {
    const cards = saneaCards([FILA_OK, { ...FILA_OK, id: null }, { ...FILA_OK, id: "c2" }]);
    expect(cards.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("es defensiva ante entradas raras", () => {
    expect(saneaCards(null)).toEqual([]);
    expect(saneaCards({ raro: true })).toEqual([]);
    expect(saneaCards([null, undefined, 0, "texto"])).toEqual([]);
  });

  // Descartar en silencio es lo que convierte "falta una tarjeta" en un misterio de dos horas.
  it("avisa por consola cuando descarta filas, con el contexto", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    saneaCards([FILA_OK, { ...FILA_OK, id: null }]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/1.*2|descart/i);
  });

  it("no avisa cuando no hay nada que descartar", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    saneaCards([FILA_OK]);
    expect(warn).not.toHaveBeenCalled();
  });
});

// `validateRows` sigue existiendo y sigue siendo NO destructivo: detecta drift de la base y
// avisa, sin tocar los datos. Cumple un rol distinto al del saneado y por eso conviven.
describe("validateRows — sigue avisando sin descartar", () => {
  it("devuelve todas las filas, incluso las que no cumplen", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const filas = [FILA_OK, { ...FILA_OK, status: "zaraza" }];
    expect(validateRows(filas, CardSchema, "cards")).toHaveLength(2);
    expect(warn).toHaveBeenCalled();
  });

  it("no avisa cuando todas cumplen", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateRows([{ ...FILA_OK, effort: 2 }], CardSchema, "cards");
    expect(warn).not.toHaveBeenCalled();
  });
});
