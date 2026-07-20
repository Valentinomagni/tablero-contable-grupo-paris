import { describe, it, expect } from "vitest";
import { puntualidad } from "./puntualidad";
import type { Card } from "./types";

const base: Card = {
  id: "1", owner: "u1", title: "t", status: "term", description: "",
  done_at: null, due_date: null, recurring: false,
} as unknown as Card;

const hoyISO = "2026-07-20";

function mk(over: Partial<Card>): Card {
  return { ...base, ...over } as Card;
}

describe("puntualidad", () => {
  it("sin cerradas en el período -> pct null", () => {
    const r = puntualidad([], hoyISO);
    expect(r.pct).toBeNull();
    expect(r.n).toBe(0);
    expect(r.enFecha).toBe(0);
    expect(r.sinFecha).toBe(0);
    expect(r.muestraChica).toBe(false);
  });

  it("2 cerradas con vto, 1 en fecha -> pct 50, muestraChica true", () => {
    const cards = [
      mk({ id: "a", done_at: "2026-07-10T12:00:00Z", due_date: "2026-07-10" }), // en fecha
      mk({ id: "b", done_at: "2026-07-10T12:00:00Z", due_date: "2026-07-05" }), // tarde
    ];
    const r = puntualidad(cards, hoyISO);
    expect(r.n).toBe(2);
    expect(r.enFecha).toBe(1);
    expect(r.pct).toBe(50);
    expect(r.muestraChica).toBe(true);
  });

  it("4 cerradas con vto, 3 en fecha -> pct 75, muestraChica false", () => {
    const cards = [
      mk({ id: "a", done_at: "2026-07-10T12:00:00Z", due_date: "2026-07-10" }),
      mk({ id: "b", done_at: "2026-07-10T12:00:00Z", due_date: "2026-07-15" }),
      mk({ id: "c", done_at: "2026-07-10T12:00:00Z", due_date: "2026-07-20" }),
      mk({ id: "d", done_at: "2026-07-10T12:00:00Z", due_date: "2026-07-05" }), // tarde
    ];
    const r = puntualidad(cards, hoyISO);
    expect(r.n).toBe(4);
    expect(r.enFecha).toBe(3);
    expect(r.pct).toBe(75);
    expect(r.muestraChica).toBe(false);
  });

  it("cerradas sin due_date cuentan en sinFecha, no en n", () => {
    const cards = [
      mk({ id: "a", done_at: "2026-07-10T12:00:00Z", due_date: "2026-07-10" }),
      mk({ id: "b", done_at: "2026-07-10T12:00:00Z", due_date: null }),
      mk({ id: "c", done_at: "2026-07-11T12:00:00Z", due_date: null }),
    ];
    const r = puntualidad(cards, hoyISO);
    expect(r.n).toBe(1);
    expect(r.enFecha).toBe(1);
    expect(r.sinFecha).toBe(2);
    expect(r.pct).toBe(100);
  });

  it("cerrada hace 40 dias no cuenta", () => {
    const cards = [
      mk({ id: "a", done_at: "2026-06-10T12:00:00Z", due_date: "2026-06-10" }), // 40 dias antes de 2026-07-20
    ];
    const r = puntualidad(cards, hoyISO);
    expect(r.n).toBe(0);
    expect(r.sinFecha).toBe(0);
    expect(r.pct).toBeNull();
  });

  it("ignora tarjetas que no estan status term", () => {
    const cards = [
      mk({ id: "a", status: "pend", done_at: "2026-07-10T12:00:00Z", due_date: "2026-07-10" }),
    ];
    const r = puntualidad(cards, hoyISO);
    expect(r.n).toBe(0);
  });
});
