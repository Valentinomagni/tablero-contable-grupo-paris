import { describe, it, expect } from "vitest";
import { analiticaOperativas } from "./analitica-operativas";
import type { Card, ActivityLog, Profile } from "./types";

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: "u1", name: "Ana", role: "empleado", email: "a@x.com", username: null, puesto: "", ficha: "", manager_id: null, marca: null, ...over,
});

const card = (over: Partial<Card> = {}): Card => ({
  id: "c1", owner: "u1", title: "Carga de remitos", status: "pend", description: "",
  checklist: [], comments: [], history: [], done_at: null, due_date: null, recurring: false,
  priority: "media", effort: 1, card_type: "operativa", deps: [], created_at: "2026-01-01T00:00:00Z",
  ...over,
});

const act = (over: Partial<ActivityLog> = {}): ActivityLog => ({
  id: "a1", card_id: "c1", owner: "u1", who_name: "Ana", qty: 1, note: "", at: "2026-07-10T12:00:00Z", ...over,
});

describe("analiticaOperativas — por empleado", () => {
  it("suma la cantidad ejecutada dentro del rango", () => {
    const cards = [card()];
    const activity = [act({ id: "a1", qty: 5, at: "2026-07-05T00:00:00Z" }), act({ id: "a2", qty: 3, at: "2026-07-10T00:00:00Z" })];
    const r = analiticaOperativas(cards, activity, [profile()], "2026-07-01", "2026-07-31");
    expect(r.porEmpleado).toHaveLength(1);
    expect(r.porEmpleado[0]).toMatchObject({ id: "u1", nombre: "Ana", cantidadEjecutada: 8 });
  });

  it("excluye registros fuera del rango", () => {
    const cards = [card()];
    const activity = [act({ qty: 5, at: "2026-06-30T00:00:00Z" })];
    const r = analiticaOperativas(cards, activity, [profile()], "2026-07-01", "2026-07-31");
    expect(r.porEmpleado).toHaveLength(0);
  });

  it("excluye usuarios ocultos", () => {
    const cards = [card()];
    const activity = [act({ qty: 5 })];
    const r = analiticaOperativas(cards, activity, [profile({ oculto: true })], "2026-07-01", "2026-07-31");
    expect(r.porEmpleado).toHaveLength(0);
  });

  it("rango vacío (sin actividad) no rompe: devuelve arrays vacíos", () => {
    const r = analiticaOperativas([], [], [profile()], "2026-07-01", "2026-07-31");
    expect(r.porEmpleado).toEqual([]);
    expect(r.porTipo).toEqual([]);
    expect(r.cargaCruzada).toEqual([]);
  });

  it("un solo registro no divide por cero", () => {
    const cards = [card()];
    const activity = [act({ qty: 2 })];
    const r = analiticaOperativas(cards, activity, [profile()], "2026-07-01", "2026-07-31");
    expect(r.porEmpleado[0].cantidadEjecutada).toBe(2);
  });

  // Review Fase D (MEDIA 2): el escenario REAL es que `profiles` ya viene acotada por
  // personasVisibles + segmento, así que el administrador fantasma NO está en la lista.
  // Con el filtro negativo viejo (cardsVisibles) nunca entraba al Set de ocultos y sus
  // cards y su ActivityLog seguían contando.
  it("el administrador fantasma no cuenta aunque no esté en la lista acotada que se pasa", () => {
    const cards = [card({ id: "c1", owner: "u1" }), card({ id: "cf", owner: "fantasma" })];
    const activity = [act({ id: "a1", card_id: "c1", owner: "u1", qty: 2 }), act({ id: "af", card_id: "cf", owner: "fantasma", qty: 99 })];
    const r = analiticaOperativas(cards, activity, [profile()], "2026-07-01", "2026-07-31");
    expect(r.porEmpleado).toHaveLength(1);
    expect(r.porEmpleado[0].id).toBe("u1");
    expect(r.cargaCruzada.every((x) => x.empleadoId !== "fantasma")).toBe(true);
  });

  // Review Fase D (MEDIA 3): esta vista es carga de trabajo, no ranking de productividad.
  it("ordena por nombre, no por cantidad ejecutada", () => {
    const zoe = profile({ id: "u2", name: "Zoe" });
    const cards = [card({ id: "c1", owner: "u1" }), card({ id: "c2", owner: "u2" })];
    const activity = [act({ id: "a1", card_id: "c1", owner: "u1", qty: 1 }), act({ id: "a2", card_id: "c2", owner: "u2", qty: 50 })];
    const r = analiticaOperativas(cards, activity, [profile(), zoe], "2026-07-01", "2026-07-31");
    expect(r.porEmpleado.map((e) => e.nombre)).toEqual(["Ana", "Zoe"]);
  });

});

describe("analiticaOperativas — por tipo de tarea", () => {
  it("usa el title de la card como tipo, cuenta frecuencia y calcula distribución", () => {
    const cards = [card({ id: "c1", title: "Carga de remitos" }), card({ id: "c2", title: "Arqueo de caja" })];
    const activity = [
      act({ id: "a1", card_id: "c1", qty: 1 }),
      act({ id: "a2", card_id: "c1", qty: 1 }),
      act({ id: "a3", card_id: "c2", qty: 1 }),
    ];
    const r = analiticaOperativas(cards, activity, [profile()], "2026-07-01", "2026-07-31");
    const remitos = r.porTipo.find((t) => t.titulo === "Carga de remitos")!;
    const arqueo = r.porTipo.find((t) => t.titulo === "Arqueo de caja")!;
    expect(remitos.frecuencia).toBe(2);
    expect(arqueo.frecuencia).toBe(1);
    expect(remitos.pctDelTotal).toBe(67);
    expect(arqueo.pctDelTotal).toBe(33);
  });

  it("no rompe con frecuencia total cero", () => {
    const r = analiticaOperativas([], [], [profile()], "2026-07-01", "2026-07-31");
    expect(r.porTipo).toEqual([]);
  });
});

describe("analiticaOperativas — cruzado empleado x tipo", () => {
  it("agrega carga operativa por empleado y tipo", () => {
    const u2 = profile({ id: "u2", name: "Bruno" });
    const cards = [card({ id: "c1", title: "Carga de remitos" })];
    const activity = [
      act({ id: "a1", card_id: "c1", owner: "u1", qty: 4 }),
      act({ id: "a2", card_id: "c1", owner: "u2", qty: 6 }),
    ];
    const r = analiticaOperativas(cards, activity, [profile(), u2], "2026-07-01", "2026-07-31");
    expect(r.cargaCruzada).toEqual(expect.arrayContaining([
      { empleadoId: "u1", empleadoNombre: "Ana", titulo: "Carga de remitos", cantidad: 4 },
      { empleadoId: "u2", empleadoNombre: "Bruno", titulo: "Carga de remitos", cantidad: 6 },
    ]));
  });

});
