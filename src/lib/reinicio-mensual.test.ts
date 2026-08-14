import { describe, it, expect } from "vitest";
import { mesAnterior, reinicioPendiente, seReiniciaCadaMes, quedanRecurrentesSinReiniciar, type Reinicio } from "./reinicio-mensual";
import type { Card } from "./types";

// Fila mínima de `reinicios_mensuales` para los casos de abajo. Los contadores no
// participan de la decisión: lo único que importa es que la fila EXISTA.
const fila = (mes: string): Reinicio => ({
  mes, corrido_at: `${mes}-01T03:05:00.000Z`, origen: "cron", archivadas: 84, reseteadas: 61,
});

describe("mesAnterior", () => {
  it("en un mes normal devuelve el anterior", () => {
    // 04/08/2026 — el día que se reportó el problema.
    expect(mesAnterior("2026-08-04T12:00:00.000Z")).toBe("2026-07");
  });

  it("en enero devuelve diciembre del año anterior", () => {
    expect(mesAnterior("2026-01-09T12:00:00.000Z")).toBe("2025-12");
  });

  it("usa el día ARGENTINO, no el del navegador", () => {
    // 01/08 a las 01:00 UTC todavía es 31/07 en Argentina (UTC-3): el mes anterior
    // al mes argentino en curso (julio) es JUNIO, no julio.
    expect(mesAnterior("2026-08-01T01:00:00.000Z")).toBe("2026-06");
  });
});

describe("reinicioPendiente", () => {
  const hoy = "2026-08-04T12:00:00.000Z";

  it("con el reinicio del mes pasado registrado, no avisa", () => {
    expect(reinicioPendiente([fila("2026-07")], hoy)).toBeNull();
  });

  it("sin el reinicio del mes pasado, devuelve el mes que falta", () => {
    expect(reinicioPendiente([fila("2026-06")], hoy)).toBe("2026-07");
  });

  it("con la lista vacía avisa (la tabla arranca vacía a propósito)", () => {
    expect(reinicioPendiente([], hoy)).toBe("2026-07");
  });

  it("con entradas basura no rompe: las saltea", () => {
    const basura = [null, undefined, 42, "2026-07", { mes: null }, { otra: 1 }] as unknown as Reinicio[];
    expect(reinicioPendiente(basura, hoy)).toBe("2026-07");
  });

  it("con algo que no es un arreglo lo trata como lista vacía", () => {
    expect(reinicioPendiente(undefined as unknown as Reinicio[], hoy)).toBe("2026-07");
    expect(reinicioPendiente(null as unknown as Reinicio[], hoy)).toBe("2026-07");
    expect(reinicioPendiente({} as unknown as Reinicio[], hoy)).toBe("2026-07");
  });

  it("una fila basura entre filas buenas no tapa la fila buena", () => {
    const mezcla = [null, fila("2026-07"), undefined] as unknown as Reinicio[];
    expect(reinicioPendiente(mezcla, hoy)).toBeNull();
  });
});

// ── Qué tarjetas reinicia la base, y si quedó alguna ────────────────────────────
//
// Lo de arriba prueba "¿corrió el proceso?". Esto prueba "¿el resultado es el esperado?", que
// es la pregunta que el semáforo del Cierre contestaba mal el 04/08 (hallazgo 2 de la auditoría
// del 05/08).

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "IVA", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2026-07-01T00:00:00Z", ...over,
  };
}

describe("qué tarjetas reinicia la base", () => {
  it("una con recur_rule se reinicia", () => {
    expect(seReiniciaCadaMes(card({ recur_rule: { tipo: "mensual", diaMes: 15 } }))).toBe(true);
  });

  // EL CASO QUE PRODUJO EL INCIDENTE. El semáforo filtraba sólo por `recur_rule` y éstas
  // quedaban afuera: son las que el equipo carga desde el modal marcando "se repite cada mes",
  // que las deja con `recurring: true` y sin regla. O sea, la mayoría de las reales.
  it("una marcada 'se repite cada mes' desde el modal TAMBIÉN se reinicia, aunque no tenga regla", () => {
    expect(seReiniciaCadaMes(card({ recurring: true, recur_rule: null }))).toBe(true);
  });

  it("una de una sola vez no se reinicia", () => {
    expect(seReiniciaCadaMes(card({ recurring: false, recur_rule: null }))).toBe(false);
  });

  it("con reset_policy manual no se reinicia, aunque sea recurrente", () => {
    expect(seReiniciaCadaMes(card({ recurring: true, reset_policy: "manual" }))).toBe(false);
  });

  it("sin reset_policy vale 'mensual', igual que el coalesce de la base", () => {
    expect(seReiniciaCadaMes(card({ recurring: true, reset_policy: undefined }))).toBe(true);
  });
});

describe("¿quedaron recurrentes sin reiniciar?", () => {
  it("una recurrente terminada el mes pasado significa que NO se reinició", () => {
    const cards = [card({ recurring: true, status: "term", done_at: "2026-07-20T12:00:00Z" })];
    expect(quedanRecurrentesSinReiniciar(cards, "2026-07")).toBe(true);
  });

  it("todas en pendiente significa que sí", () => {
    const cards = [card({ recurring: true, status: "pend", done_at: null })];
    expect(quedanRecurrentesSinReiniciar(cards, "2026-07")).toBe(false);
  });

  // LA SEGUNDA MITAD DEL DEFECTO: `done_at.slice(0, 7)` es el mes UTC.
  it("una cerrada a las 21:30 del 31/07 cuenta como de julio, no de agosto", () => {
    // 2026-08-01T00:30Z son las 21:30 del 31/07 en Argentina. Con el ISO crudo esto daba
    // "2026-08", no coincidía con el mes previo, y el semáforo la dejaba pasar en verde.
    const cards = [card({ recurring: true, status: "term", done_at: "2026-08-01T00:30:00Z" })];
    expect(quedanRecurrentesSinReiniciar(cards, "2026-07")).toBe(true);
  });

  it("una de una sola vez terminada el mes pasado NO enciende la alarma", () => {
    // Es lo normal: las puntuales se terminan y se quedan terminadas.
    const cards = [card({ recurring: false, status: "term", done_at: "2026-07-20T12:00:00Z" })];
    expect(quedanRecurrentesSinReiniciar(cards, "2026-07")).toBe(false);
  });

  it("sin datos no rompe", () => {
    expect(quedanRecurrentesSinReiniciar([], "2026-07")).toBe(false);
    expect(quedanRecurrentesSinReiniciar(undefined as unknown as Card[], "2026-07")).toBe(false);
  });
});
