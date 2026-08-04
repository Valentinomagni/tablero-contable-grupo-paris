import { describe, it, expect } from "vitest";
import { enQueAnda } from "./en-que-anda";
import type { Card, Profile } from "./types";

const HOY = "2026-08-04T15:00:00Z";

function persona(over: Partial<Profile> = {}): Profile {
  return { id: "u1", name: "Ana Pérez", role: "empleado", manager_id: null, ...over } as Profile;
}

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "DDJJ IIBB", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, proc_at: null,
    due_date: null, recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-08-01T09:00:00Z", ...over,
  };
}

describe("enQueAnda", () => {
  it("lista lo que cada persona tiene abierto", () => {
    const r = enQueAnda([card()], [persona()], HOY);
    expect(r).toHaveLength(1);
    expect(r[0].abiertas[0].title).toBe("DDJJ IIBB");
  });

  it("no cuenta lo terminado", () => {
    const r = enQueAnda([card({ status: "term", done_at: "2026-08-02T10:00:00Z" })], [persona()], HOY);
    expect(r[0].abiertas).toHaveLength(0);
  });

  // Las operativas son a demanda y de volumen alto: mezclarlas taparía el resto.
  it("no cuenta las operativas", () => {
    const r = enQueAnda([card({ card_type: "operativa" })], [persona()], HOY);
    expect(r[0].abiertas).toHaveLength(0);
  });

  it("marca cuáles están en proceso y cuenta cuántas", () => {
    const cards = [card({ id: "a", status: "proc", proc_at: "2026-08-03T10:00:00Z" }), card({ id: "b" })];
    const r = enQueAnda(cards, [persona()], HOY);
    expect(r[0].enProceso).toBe(1);
    expect(r[0].abiertas.find((t) => t.id === "a")!.enProceso).toBe(true);
  });

  it("dice desde cuándo está en proceso, en días", () => {
    const r = enQueAnda([card({ status: "proc", proc_at: "2026-08-01T15:00:00Z" })], [persona()], HOY);
    expect(r[0].abiertas[0].dias).toBe(3);
  });

  it("sin fecha de inicio no inventa un número", () => {
    const r = enQueAnda([card({ status: "pend", proc_at: null })], [persona()], HOY);
    expect(r[0].abiertas[0].dias).toBeNull();
    expect(r[0].abiertas[0].desde).toBeNull();
  });

  it("señala la que lleva más tiempo sin moverse", () => {
    const cards = [
      card({ id: "a", status: "proc", proc_at: "2026-08-03T10:00:00Z" }),
      card({ id: "b", status: "proc", proc_at: "2026-07-20T10:00:00Z" }),
    ];
    expect(enQueAnda(cards, [persona()], HOY)[0].sinMover!.id).toBe("b");
  });

  it("si nada lleva tiempo, no señala nada", () => {
    const r = enQueAnda([card({ status: "proc", proc_at: "2026-08-04T09:00:00Z" })], [persona()], HOY);
    expect(r[0].sinMover).toBeNull();
  });

  it("incluye a quien no tiene nada abierto, sin destacarlo", () => {
    const r = enQueAnda([], [persona()], HOY);
    expect(r).toHaveLength(1);
    expect(r[0].abiertas).toEqual([]);
  });

  it("ordena las personas por nombre, no por cantidad", () => {
    // Ordenar por cantidad arma un ranking. El orden es alfabético a propósito.
    const equipo = [persona({ id: "u2", name: "Zoe" }), persona({ id: "u1", name: "Ana Pérez" })];
    const cards = [card({ id: "a", owner: "u2" }), card({ id: "b", owner: "u2" })];
    expect(enQueAnda(cards, equipo, HOY).map((r) => r.persona.name)).toEqual(["Ana Pérez", "Zoe"]);
  });

  it("es defensiva ante entradas raras", () => {
    expect(enQueAnda(null as unknown as Card[], [persona()], HOY)[0].abiertas).toEqual([]);
    expect(enQueAnda([card()], null as unknown as Profile[], HOY)).toEqual([]);
    expect(enQueAnda([card()], [persona()], "no es fecha")[0].abiertas[0].dias).toBeNull();
  });
});
