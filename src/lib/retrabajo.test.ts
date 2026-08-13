import { describe, it, expect } from "vitest";
import { reaperturasDe, indiceRetrabajo, textoTransicion, TXT_REAPERTURA } from "./retrabajo";
import type { Card, Profile } from "./types";

const mkCard = (over: Partial<Card> = {}): Card => ({
  id: "c1", owner: "u1", title: "Tarea", status: "term", description: "",
  checklist: [], comments: [], history: [],
  done_at: null, due_date: null, recurring: false,
  ...over,
} as Card);

const mkProfile = (over: Partial<Profile> = {}): Profile => ({
  id: "u1", name: "Ana", role: "empleado", email: "ana@x.com", username: null,
  puesto: "", ficha: "", manager_id: null, marca: null,
  ...over,
} as Profile);

describe("reaperturasDe", () => {
  it("card sin history -> 0", () => {
    expect(reaperturasDe({ history: [] })).toBe(0);
  });

  it("history undefined -> 0 sin crashear", () => {
    expect(reaperturasDe({ history: undefined as unknown as Card["history"] })).toBe(0);
  });

  it("una reapertura -> 1", () => {
    expect(reaperturasDe({ history: [{ who: "u1", at: "2026-01-01", txt: "Reabrió la tarea" }] })).toBe(1);
  });

  it("tres reaperturas -> 3", () => {
    const history = [
      { who: "u1", at: "2026-01-01", txt: "Reabrió la tarea" },
      { who: "u1", at: "2026-01-02", txt: "Otra cosa" },
      { who: "u1", at: "2026-01-03", txt: "Reabrió la tarea" },
      { who: "u1", at: "2026-01-04", txt: "Reabrió la tarea" },
    ];
    expect(reaperturasDe({ history })).toBe(3);
  });
});

describe("textoTransicion", () => {
  it("term -> pend es reapertura", () => {
    expect(textoTransicion("term", "pend", "Movió la tarea")).toBe(TXT_REAPERTURA);
  });

  it("term -> proc es reapertura", () => {
    expect(textoTransicion("term", "proc", "Volvió a Pendiente")).toBe(TXT_REAPERTURA);
  });

  it("term -> term no es reapertura (usa el default)", () => {
    expect(textoTransicion("term", "term", "Marcó terminada")).toBe("Marcó terminada");
  });

  it("pend -> proc no es reapertura", () => {
    expect(textoTransicion("pend", "proc", "Pasó a En proceso")).toBe("Pasó a En proceso");
  });

  it("proc -> term no es reapertura", () => {
    expect(textoTransicion("proc", "term", "Marcó terminada")).toBe("Marcó terminada");
  });
});

describe("indiceRetrabajo", () => {
  it("equipo sin terminadas -> pct general null", () => {
    const cards = [mkCard({ id: "c1", owner: "u1", status: "proc", history: [] })];
    const profiles = [mkProfile({ id: "u1" })];
    const r = indiceRetrabajo(cards, profiles);
    expect(r.general.pct).toBeNull();
    expect(r.general.terminadas).toBe(0);
  });

  it("masReabiertas solo incluye las de 2+ reaperturas y ordena desc", () => {
    const cards = [
      mkCard({ id: "c1", owner: "u1", title: "Una sola", status: "term", history: [
        { who: "u1", at: "2026-01-01", txt: "Reabrió la tarea" },
      ] }),
      mkCard({ id: "c2", owner: "u1", title: "Dos veces", status: "term", history: [
        { who: "u1", at: "2026-01-01", txt: "Reabrió la tarea" },
        { who: "u1", at: "2026-01-02", txt: "Reabrió la tarea" },
      ] }),
      mkCard({ id: "c3", owner: "u1", title: "Cinco veces", status: "term", history: [
        { who: "u1", at: "2026-01-01", txt: "Reabrió la tarea" },
        { who: "u1", at: "2026-01-02", txt: "Reabrió la tarea" },
        { who: "u1", at: "2026-01-03", txt: "Reabrió la tarea" },
        { who: "u1", at: "2026-01-04", txt: "Reabrió la tarea" },
        { who: "u1", at: "2026-01-05", txt: "Reabrió la tarea" },
      ] }),
    ];
    const profiles = [mkProfile({ id: "u1" })];
    const r = indiceRetrabajo(cards, profiles);
    expect(r.masReabiertas.map((m) => m.title)).toEqual(["Cinco veces", "Dos veces"]);
    expect(r.masReabiertas[0].veces).toBe(5);
  });

  it("el usuario oculto no aparece en porPersona", () => {
    const cards = [
      mkCard({ id: "c1", owner: "u1", status: "term", history: [] }),
      mkCard({ id: "c2", owner: "oculto1", status: "term", history: [
        { who: "oculto1", at: "2026-01-01", txt: "Reabrió la tarea" },
      ] }),
    ];
    const profiles = [
      mkProfile({ id: "u1" }),
      mkProfile({ id: "oculto1", name: "Oculto", oculto: true } as Partial<Profile>),
    ];
    const r = indiceRetrabajo(cards, profiles);
    expect(r.porPersona.find((p) => p.id === "oculto1")).toBeUndefined();
  });

  it("porPersona excluye jefes", () => {
    const cards = [
      mkCard({ id: "c1", owner: "jefe1", status: "term", history: [
        { who: "jefe1", at: "2026-01-01", txt: "Reabrió la tarea" },
      ] }),
    ];
    const profiles = [mkProfile({ id: "jefe1", role: "jefe" })];
    const r = indiceRetrabajo(cards, profiles);
    expect(r.porPersona.find((p) => p.id === "jefe1")).toBeUndefined();
  });

  it("calcula pct general redondeado", () => {
    const cards = [
      mkCard({ id: "c1", owner: "u1", status: "term", history: [
        { who: "u1", at: "2026-01-01", txt: "Reabrió la tarea" },
      ] }),
      mkCard({ id: "c2", owner: "u1", status: "term", history: [] }),
      mkCard({ id: "c3", owner: "u1", status: "term", history: [] }),
    ];
    const profiles = [mkProfile({ id: "u1" })];
    const r = indiceRetrabajo(cards, profiles);
    // 1 reapertura / 3 terminadas = 33.33% -> 33
    expect(r.general.pct).toBe(33);
  });
});

// GUARDIÁN DE DOS ARCHIVOS QUE TIENEN QUE SEGUIR SIN CHOCAR.
//
// La migración 46 reactiva las tareas recurrentes y deja una marca en el historial. Si esa marca
// contuviera el texto de reapertura, CADA CICLO de CADA tarea recurrente contaría como retrabajo
// — una tarea diaria inflaría el índice unos 20 puntos por mes ella sola, y el equipo aparecería
// rehaciendo trabajo que nunca rehízo. Ese número se le muestra al jefe.
//
// Hoy los dos textos no chocan por casualidad. Este test lo vuelve una regla: si alguien cambia
// cualquiera de los dos y quedan solapados, esto se pone en rojo y explica por qué.
describe("el ciclo automático no se confunde con una reapertura", () => {
  it("los dos textos son distintos y no se contienen entre sí", async () => {
    const { TXT_NUEVO_CICLO } = await import("./recurrencia-ciclo");
    expect(TXT_NUEVO_CICLO).not.toBe(TXT_REAPERTURA);
    expect(TXT_NUEVO_CICLO).not.toContain(TXT_REAPERTURA);
    expect(TXT_REAPERTURA).not.toContain(TXT_NUEVO_CICLO);
  });

  it("una tarjeta reactivada por la recurrencia no cuenta como reabierta", async () => {
    const { TXT_NUEVO_CICLO } = await import("./recurrencia-ciclo");
    const card = mkCard({
      history: [
        { who: "Ana", at: "2026-08-06T10:00:00Z", txt: "Marcó terminada" },
        { who: "Sistema", at: "2026-08-13T03:10:00Z", txt: TXT_NUEVO_CICLO },
      ],
    });
    expect(reaperturasDe(card)).toBe(0);
  });

  it("y una reabierta de verdad sí cuenta, para que el test no pase por vacío", () => {
    const card = mkCard({
      history: [{ who: "Ana", at: "2026-08-06T10:00:00Z", txt: TXT_REAPERTURA }],
    });
    expect(reaperturasDe(card)).toBe(1);
  });
});
