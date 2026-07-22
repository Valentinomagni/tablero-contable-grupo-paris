import { describe, it, expect } from "vitest";
import { delegacionesVivas } from "./delegaciones";
import type { Card, Profile } from "./types";

const mkCard = (over: Partial<Card> = {}): Card => ({
  id: "c1", owner: "u1", title: "Tarea", status: "pend", description: "",
  checklist: [], comments: [], history: [],
  done_at: null, due_date: null, recurring: false,
  ...over,
} as Card);

const mkProfile = (over: Partial<Profile> = {}): Profile => ({
  id: "u1", name: "Ana", role: "empleado", email: "ana@x.com", username: null,
  puesto: "", ficha: "", manager_id: null, marca: null,
  ...over,
} as Profile);

const delegHistory = (at: string, delegador = "Valentino", con = "Ana") => [
  { who: delegador, at, txt: `compartida:link1` },
  { who: delegador, at, txt: `Tarea compartida — delegada por ${delegador} · con ${con}` },
];

const profiles: Profile[] = [
  mkProfile({ id: "jefe1", name: "Valentino", role: "jefe" }),
  mkProfile({ id: "u1", name: "Ana" }),
];

describe("delegacionesVivas", () => {
  it("sin delegaciones -> vacío", () => {
    const cards = [mkCard({ history: [] })];
    expect(delegacionesVivas(cards, profiles, "2026-07-22")).toEqual([]);
  });

  it("delegada reciente -> no trabada", () => {
    const cards = [mkCard({ history: delegHistory("2026-07-21T14:00:00Z") })];
    const r = delegacionesVivas(cards, profiles, "2026-07-22");
    expect(r).toHaveLength(1);
    expect(r[0].trabada).toBe(false);
    expect(r[0].diasSinMover).toBe(1);
    expect(r[0].de?.name).toBe("Valentino");
    expect(r[0].a.map((p) => p.name)).toEqual(["Ana"]);
  });

  it("delegada hace 7 días sin mover -> trabada", () => {
    const cards = [mkCard({ history: delegHistory("2026-07-15T14:00:00Z") })];
    const r = delegacionesVivas(cards, profiles, "2026-07-22");
    expect(r[0].trabada).toBe(true);
    expect(r[0].diasSinMover).toBe(7);
  });

  it("delegada y terminada -> no aparece", () => {
    const cards = [mkCard({ status: "term", history: delegHistory("2026-07-01T14:00:00Z") })];
    expect(delegacionesVivas(cards, profiles, "2026-07-22")).toEqual([]);
  });

  it("history vacío o undefined -> no rompe", () => {
    const cards = [
      mkCard({ id: "c1", history: [] }),
      mkCard({ id: "c2", history: undefined as unknown as Card["history"] }),
    ];
    expect(delegacionesVivas(cards, profiles, "2026-07-22")).toEqual([]);
  });

  it("persona oculta (owner) -> excluida", () => {
    const ps = [...profiles.filter((p) => p.id !== "u1"), mkProfile({ id: "u1", name: "Ana", oculto: true })];
    const cards = [mkCard({ history: delegHistory("2026-07-15T14:00:00Z") })];
    expect(delegacionesVivas(cards, ps, "2026-07-22")).toEqual([]);
  });

  it("persona oculta (delegador) -> excluida", () => {
    const ps = [mkProfile({ id: "jefe1", name: "Valentino", role: "jefe", oculto: true }), mkProfile({ id: "u1", name: "Ana" })];
    const cards = [mkCard({ history: delegHistory("2026-07-15T14:00:00Z") })];
    expect(delegacionesVivas(cards, ps, "2026-07-22")).toEqual([]);
  });

  it("card no delegada (sin marca compartida) -> no aparece", () => {
    const cards = [mkCard({ history: [{ who: "u1", at: "2026-07-15T14:00:00Z", txt: "Movió la tarea" }] })];
    expect(delegacionesVivas(cards, profiles, "2026-07-22")).toEqual([]);
  });

  describe("multi-participante (delegación a varias personas a la vez)", () => {
    const profilesMulti: Profile[] = [
      mkProfile({ id: "jefe1", name: "Valentino", role: "jefe" }),
      mkProfile({ id: "u1", name: "Ana" }),
      mkProfile({ id: "u2", name: "Beto" }),
      mkProfile({ id: "u3", name: "Caro" }),
    ];

    it("3 espejos del mismo linkId -> UNA sola fila, no 3", () => {
      const con = "Ana, Beto, Caro";
      const cards = [
        mkCard({ id: "c1", owner: "u1", history: delegHistory("2026-07-20T10:00:00Z", "Valentino", con) }),
        mkCard({ id: "c2", owner: "u2", history: delegHistory("2026-07-19T10:00:00Z", "Valentino", con) }),
        mkCard({ id: "c3", owner: "u3", history: delegHistory("2026-07-15T10:00:00Z", "Valentino", con) }),
      ];
      const r = delegacionesVivas(cards, profilesMulti, "2026-07-22");
      expect(r).toHaveLength(1);
      expect(r[0].a.map((p) => p.name).sort()).toEqual(["Ana", "Beto", "Caro"]);
      expect(r[0].de?.name).toBe("Valentino");
    });

    it("diasSinMover de la fila agrupada = el MÁXIMO entre los espejos vivos", () => {
      const con = "Ana, Beto, Caro";
      const cards = [
        mkCard({ id: "c1", owner: "u1", history: delegHistory("2026-07-21T10:00:00Z", "Valentino", con) }), // 1 día
        mkCard({ id: "c2", owner: "u2", history: delegHistory("2026-07-19T10:00:00Z", "Valentino", con) }), // 3 días
        mkCard({ id: "c3", owner: "u3", history: delegHistory("2026-07-15T10:00:00Z", "Valentino", con) }), // 7 días
      ];
      const r = delegacionesVivas(cards, profilesMulti, "2026-07-22");
      expect(r).toHaveLength(1);
      expect(r[0].diasSinMover).toBe(7);
      expect(r[0].trabada).toBe(true);
    });

    it("si un espejo ya terminó pero otros no, la delegación sigue viva (sin el terminado en 'a' ni en el cálculo)", () => {
      const con = "Ana, Beto";
      const cards = [
        mkCard({ id: "c1", owner: "u1", status: "term", history: delegHistory("2026-07-16T10:00:00Z", "Valentino", con) }),
        mkCard({ id: "c2", owner: "u2", status: "pend", history: delegHistory("2026-07-15T10:00:00Z", "Valentino", con) }),
      ];
      const r = delegacionesVivas(cards, profilesMulti, "2026-07-22");
      expect(r).toHaveLength(1);
      expect(r[0].diasSinMover).toBe(7); // solo cuenta el espejo vivo (u2), no el terminado
    });

    it("si TODOS los espejos terminaron, la delegación no aparece", () => {
      const con = "Ana, Beto";
      const cards = [
        mkCard({ id: "c1", owner: "u1", status: "term", history: delegHistory("2026-07-16T10:00:00Z", "Valentino", con) }),
        mkCard({ id: "c2", owner: "u2", status: "term", history: delegHistory("2026-07-15T10:00:00Z", "Valentino", con) }),
      ];
      expect(delegacionesVivas(cards, profilesMulti, "2026-07-22")).toEqual([]);
    });

    it("2 delegaciones distintas (linkId distinto) -> 2 filas separadas", () => {
      const cards = [
        mkCard({ id: "c1", owner: "u1", history: [
          { who: "Valentino", at: "2026-07-20T10:00:00Z", txt: "compartida:linkA" },
          { who: "Valentino", at: "2026-07-20T10:00:00Z", txt: "Tarea compartida — delegada por Valentino · con Ana" },
        ] }),
        mkCard({ id: "c2", owner: "u2", history: [
          { who: "Valentino", at: "2026-07-18T10:00:00Z", txt: "compartida:linkB" },
          { who: "Valentino", at: "2026-07-18T10:00:00Z", txt: "Tarea compartida — delegada por Valentino · con Beto" },
        ] }),
      ];
      const r = delegacionesVivas(cards, profilesMulti, "2026-07-22");
      expect(r).toHaveLength(2);
    });
  });
});
