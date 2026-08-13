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
  // El umbral pasó a contarse en DÍAS HÁBILES, no corridos (reporte de Valentino). Estas fechas
  // están fijas y con el día anotado a propósito: antes el fixture decía `HOY - 6 * DIA` y había
  // que hacer la cuenta mental para saber qué estaba probando — y con el cambio, esos 6 días
  // corridos resultaron ser sólo 4 hábiles, porque HOY es sábado y el arranque caía domingo.
  //
  //   HOY = sábado 18/07 · viernes 10/07 → 5 hábiles transcurridos (13,14,15,16,17)
  it("dispara media si no hay novedades hace 5 días hábiles", () => {
    const cards = [mkCard({ id: "a", owner: "u1", due_date: manana, priority: "alta",
      history: [{ who: "Ana", at: "2026-07-10T12:00:00Z", txt: "x" }] })];
    const r = alertasDeRiesgo(cards, team, HOY);
    expect(r).toContainEqual(expect.objectContaining({ sev: "media", titulo: expect.stringContaining("alta prioridad sin novedades") }));
  });

  // EL TEST QUE PROTEGE EL CAMBIO. El de arriba sólo prueba que el umbral sigue disparando;
  // éste prueba que el fin de semana NO cuenta. Sin él, alguien podría volver a días corridos y
  // los dos tests seguirían en verde.
  //
  //   HOY = sábado 18/07 · lunes 13/07 → 6 días CORRIDOS, pero sólo 4 hábiles (14,15,16,17).
  //
  // Con la cuenta vieja esto disparaba. Ahora no, y eso es lo correcto: es exactamente el caso
  // que reportó Valentino, un aviso que llegaba dos días antes de lo que correspondía.
  it("NO dispara si los días corridos alcanzan pero los hábiles no", () => {
    const cards = [mkCard({ id: "a", owner: "u1", due_date: manana, priority: "alta",
      history: [{ who: "Ana", at: "2026-07-13T12:00:00Z", txt: "x" }] })];
    const r = alertasDeRiesgo(cards, team, HOY);
    expect(r.some((x) => x.titulo.includes("alta prioridad sin novedades"))).toBe(false);
  });

  it("un feriado en el medio corre el aviso un día más", () => {
    // Mismo caso que el primero (viernes 10 → 5 hábiles), pero con el miércoles 15 feriado:
    // quedan 4 hábiles y ya no alcanza. Es la prueba de que la lista del jefe se respeta.
    const cards = [mkCard({ id: "a", owner: "u1", due_date: manana, priority: "alta",
      history: [{ who: "Ana", at: "2026-07-10T12:00:00Z", txt: "x" }] })];
    const r = alertasDeRiesgo(cards, team, HOY, new Set(["2026-07-15"]));
    expect(r.some((x) => x.titulo.includes("alta prioridad sin novedades"))).toBe(false);
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
