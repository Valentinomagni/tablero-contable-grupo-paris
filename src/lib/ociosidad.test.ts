import { describe, it, expect } from "vitest";
import { esDiaHabil, diasHabilesDelRango, tuvoActividad, utilizacion, utilizacionEquipo } from "./ociosidad";
import type { Card, ActivityLog, Snapshot, Profile } from "./types";

function card(owner: string, done_at: string | null): Card {
  return {
    id: "c-" + Math.random(), owner, title: "t", status: "term", description: "",
    checklist: [], comments: [], history: [], done_at, due_date: null, recurring: false,
    priority: "media", effort: 1, card_type: "normal", deps: [], created_at: "2026-01-01",
  };
}
function act(owner: string, at: string): ActivityLog {
  return { id: "a-" + Math.random(), card_id: "c1", owner, who_name: "x", qty: 1, note: "", at };
}
function snap(owner: string, day: string, done_count: number, activity_qty: number): Snapshot {
  return { day, owner, open_count: 0, open_effort: 0, done_count, done_effort: 0, activity_qty };
}
function prof(id: string, name: string): Profile {
  return { id, name, role: "empleado", email: "", username: null, puesto: "", ficha: "", manager_id: null, marca: null };
}

describe("esDiaHabil", () => {
  it("lunes a viernes son hábiles", () => {
    // 2026-07-13 lunes .. 2026-07-17 viernes
    for (const d of ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17"]) {
      expect(esDiaHabil(d)).toBe(true);
    }
  });
  it("sábado y domingo no son hábiles", () => {
    expect(esDiaHabil("2026-07-18")).toBe(false); // sábado
    expect(esDiaHabil("2026-07-19")).toBe(false); // domingo
  });
});

describe("diasHabilesDelRango", () => {
  it("excluye fin de semana", () => {
    // semana lun 13 a dom 19 → 5 hábiles
    const r = diasHabilesDelRango("2026-07-13", "2026-07-19");
    expect(r).toEqual(["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17"]);
  });
  it("rango invertido o vacío → []", () => {
    expect(diasHabilesDelRango("2026-07-19", "2026-07-13")).toEqual([]);
  });
});

describe("tuvoActividad", () => {
  it("detecta cierre de card ese día", () => {
    expect(tuvoActividad("u1", "2026-07-15", [card("u1", "2026-07-15T10:00:00Z")], [], [])).toBe(true);
  });
  it("detecta activity_log ese día", () => {
    expect(tuvoActividad("u1", "2026-07-15", [], [act("u1", "2026-07-15T09:00:00Z")], [])).toBe(true);
  });
  it("detecta snapshot con done_count/activity_qty > 0", () => {
    expect(tuvoActividad("u1", "2026-07-15", [], [], [snap("u1", "2026-07-15", 1, 0)])).toBe(true);
    expect(tuvoActividad("u1", "2026-07-15", [], [], [snap("u1", "2026-07-15", 0, 3)])).toBe(true);
  });
  it("snapshot en cero no cuenta", () => {
    expect(tuvoActividad("u1", "2026-07-15", [], [], [snap("u1", "2026-07-15", 0, 0)])).toBe(false);
  });
  it("otra persona u otro día no cuenta", () => {
    expect(tuvoActividad("u1", "2026-07-15", [card("u2", "2026-07-15T10:00:00Z")], [], [])).toBe(false);
    expect(tuvoActividad("u1", "2026-07-15", [card("u1", "2026-07-14T10:00:00Z")], [], [])).toBe(false);
  });
});

describe("utilizacion", () => {
  const desde = "2026-07-13", hasta = "2026-07-17"; // 5 hábiles
  it("persona con actividad todos los días hábiles → indice 1", () => {
    const acts = ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17"].map((d) => act("u1", d + "T10:00:00Z"));
    const u = utilizacion("u1", [], acts, [], desde, hasta);
    expect(u.diasHabiles).toBe(5);
    expect(u.diasConActividad).toBe(5);
    expect(u.diasSinActividad).toBe(0);
    expect(u.indice).toBe(1);
  });
  it("persona sin actividad → indice 0, diasSinActividad = diasHabiles", () => {
    const u = utilizacion("u1", [], [], [], desde, hasta);
    expect(u.indice).toBe(0);
    expect(u.diasSinActividad).toBe(5);
  });
  it("actividad en fin de semana no cuenta", () => {
    const u = utilizacion("u1", [], [act("u1", "2026-07-18T10:00:00Z")], [], desde, hasta);
    expect(u.diasConActividad).toBe(0);
    expect(u.indice).toBe(0);
  });
  it("diasHabiles 0 → indice 0", () => {
    const u = utilizacion("u1", [], [], [], "2026-07-18", "2026-07-19");
    expect(u.diasHabiles).toBe(0);
    expect(u.indice).toBe(0);
  });
  it("redondea a 2 decimales", () => {
    const acts = ["2026-07-13", "2026-07-14"].map((d) => act("u1", d + "T10:00:00Z"));
    const u = utilizacion("u1", [], acts, [], desde, hasta);
    expect(u.indice).toBe(0.4); // 2/5
  });
});

describe("utilizacionEquipo", () => {
  it("ordena por indice ascendente (menor utilización primero)", () => {
    const desde = "2026-07-13", hasta = "2026-07-17";
    const team = [prof("u1", "Ana"), prof("u2", "Beto")];
    const acts = ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17"].map((d) => act("u2", d + "T10:00:00Z"));
    const r = utilizacionEquipo(team, [], acts, [], desde, hasta);
    expect(r.map((x) => x.id)).toEqual(["u1", "u2"]);
    expect(r[0].indice).toBe(0);
    expect(r[0].diasSinActividad).toBe(5);
    expect(r[1].indice).toBe(1);
  });
  it("defensivo con snaps/team vacíos", () => {
    expect(utilizacionEquipo([], [], [], [], "2026-07-13", "2026-07-17")).toEqual([]);
  });
});
