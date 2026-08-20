import { describe, it, expect } from "vitest";
import { coberturaEstandar } from "./cobertura-estandar";
import type { Card } from "./types";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "Conciliación bancaria", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2026-08-01T00:00:00Z", ...over,
  };
}

describe("cuánto del mes sale del catálogo", () => {
  it("cuenta las que tienen vínculo y saca el porcentaje", () => {
    const cards = [
      card({ id: "a", estandar_id: "e1" }),
      card({ id: "b", estandar_id: "e1" }),
      card({ id: "c", title: "Otra cosa" }),
      card({ id: "d", title: "Y otra" }),
    ];
    const r = coberturaEstandar(cards);
    expect(r.conEstandar).toBe(2);
    expect(r.total).toBe(4);
    expect(r.pct).toBe(50);
  });

  it("sin tareas no divide por cero", () => {
    expect(coberturaEstandar([])).toEqual({ conEstandar: 0, total: 0, pct: 0, candidatas: [] });
  });

  it("las operativas no cuentan", () => {
    // Son a demanda y de volumen alto: inflarían el denominador y taparían el dato real.
    const cards = [
      card({ id: "a", estandar_id: "e1" }),
      card({ id: "op", title: "Atención mostrador", card_type: "operativa" }),
    ];
    const r = coberturaEstandar(cards);
    expect(r.total).toBe(1);
    expect(r.pct).toBe(100);
  });

  it("ante datos rotos no explota", () => {
    expect(coberturaEstandar(undefined as unknown as Card[]).total).toBe(0);
    expect(coberturaEstandar([null as unknown as Card]).total).toBe(0);
  });
});

describe("qué títulos convendría estandarizar", () => {
  it("lista los repetidos que no salen del catálogo", () => {
    const cards = [
      card({ id: "a", title: "Conciliación Chevrolet" }),
      card({ id: "b", title: "Conciliación Chevrolet" }),
      card({ id: "c", title: "Conciliación Chevrolet" }),
      card({ id: "d", title: "Cierre de caja" }),
      card({ id: "e", title: "Cierre de caja" }),
    ];
    const r = coberturaEstandar(cards);
    expect(r.candidatas).toEqual([
      { titulo: "Conciliación Chevrolet", veces: 3 },
      { titulo: "Cierre de caja", veces: 2 },
    ]);
  });

  it("una sola vez no es candidata: no hay nada que unificar todavía", () => {
    const cards = [card({ id: "a", title: "Trámite puntual de agosto" })];
    expect(coberturaEstandar(cards).candidatas).toEqual([]);
  });

  it("las que YA salen del catálogo no aparecen: ya están unificadas", () => {
    const cards = [
      card({ id: "a", title: "Conciliación", estandar_id: "e1" }),
      card({ id: "b", title: "Conciliación", estandar_id: "e1" }),
    ];
    expect(coberturaEstandar(cards).candidatas).toEqual([]);
  });

  // EL CASO QUE HACE ÚTIL A ESTA FUNCIÓN, y sin el cual no encontraría nada. En una oficina
  // argentina media gente escribe con acento y la otra mitad no, y alguien deja un espacio de
  // más. Si contaran como títulos distintos, cada uno aparecería una sola vez y ninguno llegaría
  // al mínimo de repeticiones — el informe diría que no hay nada que estandarizar justo cuando
  // hay tres formas de escribir lo mismo.
  it("agrupa aunque cambien acentos, mayúsculas y espacios", () => {
    const cards = [
      card({ id: "a", title: "Conciliación bancaria" }),
      card({ id: "b", title: "conciliacion bancaria" }),
      card({ id: "c", title: "  Conciliación   Bancaria  " }),
    ];
    const r = coberturaEstandar(cards);
    expect(r.candidatas).toHaveLength(1);
    expect(r.candidatas[0].veces).toBe(3);
    // Muestra el título como lo escribió la primera persona, no la clave normalizada:
    // "conciliacion bancaria" en minúscula y sin acento se leería como un error de la app.
    expect(r.candidatas[0].titulo).toBe("Conciliación bancaria");
  });

  it("un título vacío no arma un grupo fantasma", () => {
    const cards = [card({ id: "a", title: "   " }), card({ id: "b", title: "" })];
    expect(coberturaEstandar(cards).candidatas).toEqual([]);
  });

  it("no lista más de ocho: es una sugerencia, no un informe", () => {
    const cards = Array.from({ length: 24 }, (_, i) =>
      card({ id: `c${i}`, title: `Tarea tipo ${Math.floor(i / 2)}` }));
    expect(coberturaEstandar(cards).candidatas).toHaveLength(8);
  });
});

// ── EL ENCUADRE, QUE ES LA PARTE FÁCIL DE ROMPER ────────────────────────────────
//
// Es la regla más dura del producto: las métricas describen procesos, nunca juzgan personas.
// Este informe es especialmente fácil de convertir en un ranking sin querer — bastaría agrupar
// por `owner` en vez de por título, y hasta parecería más útil.
//
// No lo es: "Juan tiene 8 tareas sin estandarizar" convierte un problema de proceso en una lista
// de responsables, y el equipo lo lee así aunque nadie lo diga en voz alta. "Hay 6 tareas
// llamadas 'Conciliación' que no salen del catálogo" dice el mismo hecho, no acusa a nadie, y
// encima es más útil: nombra qué definición falta escribir.
describe("el encuadre no punitivo", () => {
  it("la salida NO contiene ids ni nombres de persona", () => {
    const cards = [
      card({ id: "a", owner: "juan-uuid", title: "Conciliación" }),
      card({ id: "b", owner: "juan-uuid", title: "Conciliación" }),
      card({ id: "c", owner: "valentino-uuid", title: "Cierre" }),
      card({ id: "d", owner: "valentino-uuid", title: "Cierre" }),
    ];
    const texto = JSON.stringify(coberturaEstandar(cards));
    expect(texto).not.toContain("juan-uuid");
    expect(texto).not.toContain("valentino-uuid");
    expect(texto).not.toContain("owner");
  });

  it("dos personas con el mismo título son UN grupo, no dos filas", () => {
    // Si esto devolviera dos entradas, sería un conteo por persona con otro nombre.
    const cards = [
      card({ id: "a", owner: "juan", title: "Conciliación" }),
      card({ id: "b", owner: "valentino", title: "Conciliación" }),
    ];
    const r = coberturaEstandar(cards);
    expect(r.candidatas).toEqual([{ titulo: "Conciliación", veces: 2 }]);
  });
});
