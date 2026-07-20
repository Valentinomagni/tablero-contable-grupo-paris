import { describe, it, expect } from "vitest";
import { analizarMes } from "./analisis";
import type { Card, Profile, TaskOccurrence, CardArchive } from "./types";

const p = (id: string, role: Profile["role"] = "empleado", marca: string | null = null, sucursal: string | null = null): Profile =>
  ({ id, name: id, role, email: "", username: null, puesto: "", ficha: "", manager_id: null, marca, sucursal });

const c = (id: string, owner: string, extra: Partial<Card> = {}): Card =>
  ({ id, owner, title: id, status: "pend", description: "", checklist: [], comments: [], history: [],
     done_at: null, due_date: null, recurring: false, priority: "media", effort: 1,
     card_type: "normal", deps: [], created_at: "2026-07-01", ...extra });

const occ = (id: string, extra: Partial<TaskOccurrence> = {}): TaskOccurrence =>
  ({ id, card_id: "x", owner: "ana", fecha: "2026-07-10", done: true, done_at: "2026-07-10", ...extra });

const arch = (mes: string, card: Card): CardArchive =>
  ({ id: `${mes}-${card.id}`, owner: card.owner, mes, card, archived_at: `${mes}-28` });

describe("analizarMes", () => {
  const profiles = [p("jefe", "jefe"), p("ana", "empleado", "Peugeot", "Merlo"), p("bo", "empleado", "Honda", "Pilar")];

  it("cumplimiento general = term/total sobre cards vivas (excluye operativa)", () => {
    const cards = [
      c("t1", "ana", { status: "term" }), c("t2", "ana", { status: "pend" }),
      c("t3", "bo", { status: "term" }), c("t4", "bo", { status: "term" }),
      c("op", "ana", { status: "pend", card_type: "operativa" }),
    ];
    const r = analizarMes(cards, profiles, [], [], 2026, 7);
    expect(r.cumplimiento).toBe(75); // 3 de 4 (operativa excluida)
  });

  it("porMarca usa marca de la card y si no la del dueño", () => {
    const cards = [c("t1", "ana", { status: "term" }), c("t2", "bo", { status: "pend" }), c("t3", "ana", { marca: "Honda", status: "pend" })];
    const r = analizarMes(cards, profiles, [], [], 2026, 7);
    const peu = r.porMarca.find((m) => m.marca === "Peugeot")!;
    const hon = r.porMarca.find((m) => m.marca === "Honda")!;
    expect(peu.total).toBe(1); expect(peu.pct).toBe(100);
    expect(hon.total).toBe(2); expect(hon.pct).toBe(0);
  });

  it("porSucursal agrupa por sucursal del dueño", () => {
    const cards = [c("t1", "ana", { status: "term" }), c("t2", "bo", { status: "pend" })];
    const r = analizarMes(cards, profiles, [], [], 2026, 7);
    expect(r.porSucursal.find((s) => s.sucursal === "Merlo")!.pct).toBe(100);
    expect(r.porSucursal.find((s) => s.sucursal === "Pilar")!.pct).toBe(0);
  });

  it("porPersona excluye al jefe y computa term/vencidas/abiertas", () => {
    const cards = [
      c("t1", "ana", { status: "term" }), c("t2", "ana", { status: "pend", due_date: "2020-01-01" }),
      c("t3", "bo", { status: "proc" }), c("tj", "jefe", { status: "pend" }),
    ];
    const r = analizarMes(cards, profiles, [], [], 2026, 7);
    expect(r.porPersona.some((x) => x.id === "jefe")).toBe(false);
    const ana = r.porPersona.find((x) => x.id === "ana")!;
    expect(ana.total).toBe(2); expect(ana.pct).toBe(50); expect(ana.abiertas).toBe(1); expect(ana.vencidas).toBe(1);
  });

  it("distribucion: mediana de abiertas y sobrecargados > 1.5x", () => {
    const many = Array.from({ length: 10 }, (_, i) => c(`a${i}`, "ana", { status: "pend" }));
    const cards = [...many, c("b1", "bo", { status: "pend" })];
    const r = analizarMes(cards, profiles, [], [], 2026, 7);
    // abiertas: ana=10, bo=1 → mediana 5.5; ana(10) > 8.25 → sobrecargado
    expect(r.distribucion.medianaAbiertas).toBe(5.5);
    expect(r.distribucion.sobrecargados).toEqual(["ana"]);
  });

  it("equipo de 1 no marca sobrecargados", () => {
    const cards = [c("a1", "ana", { status: "pend" }), c("a2", "ana", { status: "pend" })];
    const soloAna = [p("jefe", "jefe"), p("ana")];
    const r = analizarMes(cards, soloAna, [], [], 2026, 7);
    expect(r.distribucion.sobrecargados).toEqual([]);
  });

  it("arqueos: cuenta resultado 'dif' del mes y suma dif_importe", () => {
    const occs = [
      occ("o1", { resultado: "dif", dif_importe: 1500 }),
      occ("o2", { resultado: "dif", dif_importe: null }),
      occ("o3", { resultado: "ok", dif_importe: 0 }),
    ];
    const r = analizarMes([], profiles, occs, [], 2026, 7);
    expect(r.arqueos.difs).toBe(2);
    expect(r.arqueos.montoTotal).toBe(1500);
  });

  it("sin difs → montoTotal 0", () => {
    const r = analizarMes([], profiles, [occ("o1", { resultado: "ok" })], [], 2026, 7);
    expect(r.arqueos).toEqual({ difs: 0, montoTotal: 0 });
  });

  it("sin archives → delta y promedio null", () => {
    const cards = [c("t1", "ana", { status: "term" })];
    const r = analizarMes(cards, profiles, [], [], 2026, 7);
    expect(r.deltaMesAnterior).toBeNull();
    expect(r.promedioHistorico).toBeNull();
  });

  it("deltaMesAnterior compara contra el archivo del mes previo", () => {
    // actual: 1 de 2 = 50%. Mes previo (2026-06): 1 de 4 = 25%. delta = +25
    const cards = [c("t1", "ana", { status: "term" }), c("t2", "ana", { status: "pend" })];
    const prev = [
      arch("2026-06", c("h1", "ana", { status: "term" })),
      arch("2026-06", c("h2", "ana", { status: "pend" })),
      arch("2026-06", c("h3", "ana", { status: "pend" })),
      arch("2026-06", c("h4", "ana", { status: "pend" })),
    ];
    const r = analizarMes(cards, profiles, [], prev, 2026, 7);
    expect(r.deltaMesAnterior).toBe(25);
  });

  it("promedioHistorico promedia todos los meses archivados, sin incluir el actual", () => {
    const archives = [
      arch("2026-05", c("m1", "ana", { status: "term" })), // 100%
      arch("2026-06", c("m2", "ana", { status: "term" })), // 50%
      arch("2026-06", c("m3", "ana", { status: "pend" })),
    ];
    const cards = [c("t1", "ana", { status: "pend" })]; // actual 0%, no debe contar
    const r = analizarMes(cards, profiles, [], archives, 2026, 7);
    expect(r.promedioHistorico).toBe(75); // (100 + 50) / 2
  });

  it("enero (mes 1) busca el archivo de diciembre del año previo", () => {
    const cards = [c("t1", "ana", { status: "term" })]; // 100%
    const prev = [arch("2025-12", c("h1", "ana", { status: "pend" }))]; // 0%
    const r = analizarMes(cards, profiles, [], prev, 2026, 1);
    expect(r.deltaMesAnterior).toBe(100);
  });
});
