import { describe, it, expect } from "vitest";
import { estaBloqueada, diasEsperando, textoBloqueo, esperasPorArea } from "./bloqueo-area";
import type { Card } from "./types";

// Fechas reales de agosto de 2026, con el día anotado para no tener que abrir un calendario:
//   viernes 7 · sábado 8 · domingo 9 · lunes 10 · martes 11 · viernes 14 · lunes 17
const HOY = "2026-08-17T12:00:00Z";   // lunes 17

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "Conciliación", status: "proc", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2026-08-01T00:00:00Z", ...over,
  };
}

describe("cuándo una tarea cuenta como bloqueada", () => {
  it("con área y fecha, sí", () => {
    expect(estaBloqueada(card({ bloqueo_area: "Ventas", bloqueo_desde: "2026-08-10T09:00:00Z" }))).toBe(true);
  });

  // LAS DOS COSAS O NINGUNA. Un área sin fecha es una etiqueta con la que no se puede hacer
  // nada: no se sabe si espera hace un día o hace un mes, que es justamente el dato que hace
  // falta para ir a golpear la puerta.
  it("con área pero sin fecha, no", () => {
    expect(estaBloqueada(card({ bloqueo_area: "Ventas", bloqueo_desde: null }))).toBe(false);
  });

  it("sin nada, no", () => {
    expect(estaBloqueada(card())).toBe(false);
  });
});

describe("hace cuánto espera", () => {
  it("cuenta días hábiles, no corridos", () => {
    // Viernes 7 a lunes 17: 10 días corridos, pero 6 hábiles transcurridos
    // (10, 11, 12, 13, 14, 17). El fin de semana no es demora de Ventas.
    const c = card({ bloqueo_area: "Ventas", bloqueo_desde: "2026-08-07T15:00:00Z" });
    expect(diasEsperando(c, HOY, new Set())).toBe(6);
  });

  // EL CASO QUE MOTIVA TODO. Un pedido hecho el viernes a la tarde no lleva tres días de demora
  // el lunes a la mañana: lleva uno. Con días corridos, el área quedaría acusada de una demora
  // que no tuvo, y ése es el tipo de número que hace que se deje de creer el resto.
  it("del viernes al lunes es 1, no 3", () => {
    const c = card({ bloqueo_area: "Ventas", bloqueo_desde: "2026-08-14T17:00:00Z" });
    expect(diasEsperando(c, HOY, new Set())).toBe(1);
  });

  it("un feriado en el medio no cuenta", () => {
    // Lunes 10 a lunes 17 son 5 hábiles; con el miércoles 12 feriado quedan 4.
    const c = card({ bloqueo_area: "Ventas", bloqueo_desde: "2026-08-10T09:00:00Z" });
    expect(diasEsperando(c, HOY, new Set(["2026-08-12"]))).toBe(4);
  });

  it("sin bloqueo es 0", () => {
    expect(diasEsperando(card(), HOY, new Set())).toBe(0);
  });
});

describe("el chip de la tarjeta", () => {
  it("dice el área y hace cuánto", () => {
    const c = card({ bloqueo_area: "Ventas", bloqueo_desde: "2026-08-07T15:00:00Z" });
    expect(textoBloqueo(c, HOY, new Set())).toBe("Espera a Ventas · 6 días");
  });

  it("en singular cuando es uno", () => {
    const c = card({ bloqueo_area: "Recursos Humanos", bloqueo_desde: "2026-08-14T17:00:00Z" });
    expect(textoBloqueo(c, HOY, new Set())).toBe("Espera a Recursos Humanos · 1 día");
  });

  it("el mismo día no dice '0 días': sólo el área", () => {
    // "Espera a Ventas · 0 días" queda raro y no aporta nada. Recién desde el primer día hábil
    // el número significa algo.
    const c = card({ bloqueo_area: "Ventas", bloqueo_desde: HOY });
    expect(textoBloqueo(c, HOY, new Set())).toBe("Espera a Ventas");
  });

  it("sin bloqueo devuelve null y no se dibuja nada", () => {
    expect(textoBloqueo(card(), HOY, new Set())).toBeNull();
  });
});

describe("el resumen por área para el jefe", () => {
  const bloqueada = (id: string, area: string, desde: string, over: Partial<Card> = {}) =>
    card({ id, bloqueo_area: area, bloqueo_desde: desde, ...over });

  it("agrupa por área y cuenta", () => {
    const cards = [
      bloqueada("a", "Ventas", "2026-08-14T09:00:00Z"),
      bloqueada("b", "Ventas", "2026-08-13T09:00:00Z"),
      bloqueada("c", "Administración", "2026-08-11T09:00:00Z"),
    ];
    const r = esperasPorArea(cards, HOY, new Set());
    expect(r.map((x) => [x.area, x.cantidad])).toEqual([["Administración", 1], ["Ventas", 2]]);
  });

  // ORDENADO POR LA MÁS VIEJA, NO POR CANTIDAD. Cuatro tareas de dos días son ruido normal; una
  // sola parada hace once días es el problema. Ordenar por cantidad escondería justo eso.
  it("primero el área con la espera más vieja, aunque tenga menos tareas", () => {
    const cards = [
      bloqueada("a", "Ventas", "2026-08-14T09:00:00Z"),
      bloqueada("b", "Ventas", "2026-08-14T09:00:00Z"),
      bloqueada("c", "Ventas", "2026-08-14T09:00:00Z"),
      bloqueada("z", "Sistemas", "2026-08-03T09:00:00Z"),
    ];
    const r = esperasPorArea(cards, HOY, new Set());
    expect(r[0].area).toBe("Sistemas");
    expect(r[0].cantidad).toBe(1);
  });

  it("una tarea terminada ya no espera a nadie", () => {
    // Aunque haya quedado el campo puesto: si se terminó, se destrabó.
    const cards = [bloqueada("a", "Ventas", "2026-08-10T09:00:00Z", { status: "term" })];
    expect(esperasPorArea(cards, HOY, new Set())).toEqual([]);
  });

  it("sin bloqueadas devuelve lista vacía", () => {
    expect(esperasPorArea([card()], HOY, new Set())).toEqual([]);
  });

  it("ante datos rotos no explota", () => {
    expect(esperasPorArea(undefined as unknown as Card[], HOY, new Set())).toEqual([]);
    expect(esperasPorArea([null as unknown as Card], HOY, new Set())).toEqual([]);
  });
});
