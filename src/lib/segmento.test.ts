import { describe, it, expect } from "vitest";
import { filtrarPorSegmento } from "./segmento";
import type { Card, Profile } from "./types";

const p = (id: string, marca: string | null, sucursal: string | null) =>
  ({ id, marca, sucursal, name: id, role: "empleado", email: "", username: null, puesto: "", ficha: "", manager_id: null }) as Profile;
const c = (id: string, owner: string, extra: Partial<Card> = {}) =>
  ({ id, owner, title: id, status: "pend", description: "", checklist: [], comments: [], history: [],
     done_at: null, due_date: null, recurring: false, priority: "media", effort: 1,
     card_type: "normal", deps: [], created_at: "2026-07-01", ...extra }) as Card;

describe("filtrarPorSegmento", () => {
  const profiles = [p("ana", "Peugeot", "Merlo"), p("bo", "Honda", null)];
  const cards = [c("t1", "ana"), c("t2", "bo"), c("t3", "ana", { marca: "Honda" } as Partial<Card>)];
  it("sin segmento devuelve todo", () => {
    expect(filtrarPorSegmento(cards, profiles, {})).toHaveLength(3);
  });
  it("filtra por marca usando la de la card y si no la del dueño", () => {
    const r = filtrarPorSegmento(cards, profiles, { marca: "Honda" });
    expect(r.map((x) => x.id).sort()).toEqual(["t2", "t3"]);
  });
  it("filtra por sucursal del dueño", () => {
    expect(filtrarPorSegmento(cards, profiles, { sucursal: "Merlo" }).map((x) => x.id)).toEqual(["t1", "t3"]);
  });
});
