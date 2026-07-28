import { describe, it, expect } from "vitest";
import { exposicion } from "./exposicion";
import type { Card } from "./types";

const HOY = "2026-07-10T12:00:00Z";

function card(over: Partial<Card> = {}): Card {
  return {
    id: Math.random().toString(36).slice(2), owner: "u1", title: "T", status: "pend",
    description: "", checklist: [], comments: [], history: [], done_at: null,
    due_date: "2026-07-11", recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-07-01T00:00:00Z",
    categoria: "IVA", ...over,
  };
}

describe("exposicion", () => {
  it("devuelve los tres horizontes: mañana, 3 días y 7 días", () => {
    expect(exposicion([], HOY).map((e) => e.horizonte)).toEqual([1, 3, 7]);
  });
  it("cuenta lo que vence dentro de cada horizonte", () => {
    const r = exposicion([
      card({ due_date: "2026-07-11" }),   // mañana
      card({ due_date: "2026-07-13" }),   // dentro de 3
      card({ due_date: "2026-07-16" }),   // dentro de 7
      card({ due_date: "2026-08-30" }),   // fuera
    ], HOY);
    expect(r.find((e) => e.horizonte === 1)!.total).toBe(1);
    expect(r.find((e) => e.horizonte === 3)!.total).toBe(2);  // acumulativo
    expect(r.find((e) => e.horizonte === 7)!.total).toBe(3);
  });
  it("lo YA vencido también está expuesto (sigue sin hacerse)", () => {
    expect(exposicion([card({ due_date: "2026-07-01" })], HOY).find((e) => e.horizonte === 1)!.total).toBe(1);
  });
  it("las terminadas NO están expuestas", () => {
    expect(exposicion([card({ status: "term", done_at: "x" })], HOY).find((e) => e.horizonte === 7)!.total).toBe(0);
  });
  it("agrupa por categoría, de mayor a menor", () => {
    const r = exposicion([
      card({ due_date: "2026-07-11", categoria: "Bancos" }),
      card({ due_date: "2026-07-11", categoria: "IVA" }),
      card({ due_date: "2026-07-11", categoria: "IVA" }),
    ], HOY);
    expect(r.find((e) => e.horizonte === 1)!.porCategoria).toEqual([
      { categoria: "IVA", n: 2 }, { categoria: "Bancos", n: 1 },
    ]);
  });
  it("las tareas sin categoría se agrupan como 'Sin categoría'", () => {
    const r = exposicion([card({ due_date: "2026-07-11", categoria: null })], HOY);
    expect(r.find((e) => e.horizonte === 1)!.porCategoria[0].categoria).toBe("Sin categoría");
  });
  it("las tareas sin vencimiento no exponen a nada", () => {
    expect(exposicion([card({ due_date: null })], HOY).every((e) => e.total === 0)).toBe(true);
  });
  it("los títulos son legibles", () => {
    const r = exposicion([], HOY);
    expect(r.find((e) => e.horizonte === 1)!.titulo).toBe("Mañana");
    expect(r.find((e) => e.horizonte === 3)!.titulo).toBe("En 3 días");
    expect(r.find((e) => e.horizonte === 7)!.titulo).toBe("En 7 días");
  });
  it("es defensiva ante entradas no-array", () => {
    expect(exposicion(null as unknown as Card[], HOY)).toHaveLength(3);
  });
});
