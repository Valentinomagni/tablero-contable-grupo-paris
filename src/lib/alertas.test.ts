import { describe, it, expect } from "vitest";
import { alertasDeRiesgo } from "./alertas";
import { SIN_ASIGNAR_EMAIL } from "./jerarquia";
import type { Card, Profile } from "./types";

const DIA = 86400000;
const HOY = new Date("2026-07-18T12:00:00Z").getTime();

function mkCard(p: Partial<Card>): Card {
  return {
    id: "c1", owner: "u1", title: "t", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2026-07-01T00:00:00Z", ...p,
  };
}
function mkProfile(p: Partial<Profile>): Profile {
  return { id: "u1", name: "Ana", role: "empleado", email: "ana@x.com", username: null, puesto: "", ficha: "", manager_id: null, marca: null, ...p };
}

// fecha vencida (ayer) e "hoy futuro" para no vencer
const ayer = "2026-07-17";
const manana = "2026-07-30";

describe("alertasDeRiesgo — persona con vencidas", () => {
  const team = [mkProfile({ id: "u1", name: "Ana" })];
  it("dispara alta con ≥3 vencidas", () => {
    const cards = [
      mkCard({ id: "a", owner: "u1", due_date: ayer }),
      mkCard({ id: "b", owner: "u1", due_date: ayer }),
      mkCard({ id: "c", owner: "u1", due_date: ayer }),
    ];
    const r = alertasDeRiesgo(cards, team, HOY);
    expect(r).toContainEqual(expect.objectContaining({ sev: "alta", titulo: "Ana: 3 tareas vencidas" }));
  });
  it("NO dispara con 2 vencidas", () => {
    const cards = [
      mkCard({ id: "a", owner: "u1", due_date: ayer }),
      mkCard({ id: "b", owner: "u1", due_date: ayer }),
    ];
    const r = alertasDeRiesgo(cards, team, HOY);
    expect(r.some((x) => x.titulo.includes("vencidas"))).toBe(false);
  });
});

describe("alertasDeRiesgo — alta prioridad sin novedades", () => {
  const team = [mkProfile({ id: "u1" })];
  it("dispara media si history ≥5 días vieja", () => {
    const cards = [mkCard({ id: "a", owner: "u1", due_date: manana, priority: "alta",
      history: [{ who: "Ana", at: new Date(HOY - 6 * DIA).toISOString(), txt: "x" }] })];
    const r = alertasDeRiesgo(cards, team, HOY);
    expect(r).toContainEqual(expect.objectContaining({ sev: "media", titulo: expect.stringContaining("alta prioridad sin novedades") }));
  });
  it("NO dispara si movida hoy", () => {
    const cards = [mkCard({ id: "a", owner: "u1", due_date: manana, priority: "alta",
      history: [{ who: "Ana", at: new Date(HOY).toISOString(), txt: "x" }] })];
    const r = alertasDeRiesgo(cards, team, HOY);
    expect(r.some((x) => x.titulo.includes("prioridad"))).toBe(false);
  });
  it("usa created_at si no hay history", () => {
    const cards = [mkCard({ id: "a", owner: "u1", due_date: manana, priority: "alta",
      history: [], created_at: new Date(HOY - 10 * DIA).toISOString() })];
    const r = alertasDeRiesgo(cards, team, HOY);
    expect(r.some((x) => x.titulo.includes("prioridad"))).toBe(true);
  });
});

describe("alertasDeRiesgo — sin responsable", () => {
  it("dispara alta si owner es centinela", () => {
    const team = [mkProfile({ id: "u1" }), mkProfile({ id: "sa", name: "Sin asignar", email: SIN_ASIGNAR_EMAIL })];
    const cards = [mkCard({ id: "a", owner: "sa", due_date: manana })];
    const r = alertasDeRiesgo(cards, team, HOY);
    expect(r).toContainEqual(expect.objectContaining({ sev: "alta", titulo: "1 tareas sin responsable — reasignar" }));
  });
  it("dispara si owner no está en el team", () => {
    const team = [mkProfile({ id: "u1" })];
    const cards = [mkCard({ id: "a", owner: "fantasma", due_date: manana })];
    const r = alertasDeRiesgo(cards, team, HOY);
    expect(r.some((x) => x.titulo.includes("sin responsable"))).toBe(true);
  });
  it("NO dispara si todos los owners están en el team", () => {
    const team = [mkProfile({ id: "u1" })];
    const cards = [mkCard({ id: "a", owner: "u1", due_date: manana })];
    const r = alertasDeRiesgo(cards, team, HOY);
    expect(r.some((x) => x.titulo.includes("sin responsable"))).toBe(false);
  });
});

describe("alertasDeRiesgo — orden y límites", () => {
  it("ordena alta antes que media y limita a 8", () => {
    const team = [mkProfile({ id: "u1", name: "Ana" })];
    const altas: Card[] = Array.from({ length: 3 }, (_, i) => mkCard({ id: `v${i}`, owner: "u1", due_date: ayer }));
    // 10 tareas alta prioridad quietas → media
    const medias: Card[] = Array.from({ length: 10 }, (_, i) => mkCard({ id: `m${i}`, owner: "u1", due_date: manana, priority: "alta", created_at: new Date(HOY - 10 * DIA).toISOString() }));
    const r = alertasDeRiesgo([...altas, ...medias], team, HOY);
    expect(r.length).toBe(8);
    expect(r[0].sev).toBe("alta");
  });
  it("no operativas ni terminadas cuentan", () => {
    const team = [mkProfile({ id: "u1" })];
    const cards = [
      mkCard({ id: "a", owner: "u1", due_date: ayer, status: "term" }),
      mkCard({ id: "b", owner: "u1", due_date: ayer, card_type: "operativa" }),
    ];
    const r = alertasDeRiesgo(cards, team, HOY);
    expect(r.some((x) => x.titulo.includes("vencidas"))).toBe(false);
  });
});
