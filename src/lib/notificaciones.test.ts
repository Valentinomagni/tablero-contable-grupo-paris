import { describe, it, expect } from "vitest";
import { tieneImpacto, esRelevante, notifsAlDelegar, notifsAlFinalizar, tiempoRelativo, avisosParaNotificar } from "./notificaciones";
import type { Announcement } from "./types";

describe("tieneImpacto", () => {
  it("prioridad alta o con vencimiento → impacto", () => {
    expect(tieneImpacto({ priority: "alta", due_date: null })).toBe(true);
    expect(tieneImpacto({ priority: "baja", due_date: "2026-07-20" })).toBe(true);
  });
  it("sin prioridad alta y sin vencimiento → sin impacto", () => {
    expect(tieneImpacto({ priority: "media", due_date: null })).toBe(false);
    expect(tieneImpacto({ priority: "baja", due_date: null })).toBe(false);
  });
});

describe("esRelevante (reglas por rol, sin redundancia)", () => {
  it("delegación/asignación/dependencia liberada: relevantes para cualquier rol", () => {
    for (const rol of ["empleado", "encargado", "jefe"] as const) {
      expect(esRelevante({ kind: "delegacion" }, rol)).toBe(true);
      expect(esRelevante({ kind: "asignacion" }, rol)).toBe(true);
      expect(esRelevante({ kind: "dep_liberada" }, rol)).toBe(true);
    }
  });
  it("finalización CON impacto: relevante solo para encargado/jefe (control de equipo)", () => {
    const e = { kind: "finalizacion" as const, priority: "alta" as const, due_date: null };
    expect(esRelevante(e, "encargado")).toBe(true);
    expect(esRelevante(e, "jefe")).toBe(true);
    expect(esRelevante(e, "empleado")).toBe(false); // no avisar a compañeros: ruido
  });
  it("ANTI-RUIDO: finalización SIN impacto (prioridad != alta y sin vencimiento) NO es relevante para nadie", () => {
    const e = { kind: "finalizacion" as const, priority: "baja" as const, due_date: null };
    expect(esRelevante(e, "jefe")).toBe(false);
    expect(esRelevante(e, "encargado")).toBe(false);
    expect(esRelevante(e, "empleado")).toBe(false);
  });
  it("vencida: relevante para encargado/jefe solo con impacto", () => {
    expect(esRelevante({ kind: "vencida", priority: "alta", due_date: "2026-07-10" }, "jefe")).toBe(true);
    expect(esRelevante({ kind: "vencida", priority: "baja", due_date: null }, "jefe")).toBe(false);
  });
});

describe("notifsAlDelegar", () => {
  const base = {
    delegadorId: "yo", delegadorName: "Valentino", title: "Conciliar banco",
    at: "2026-07-16T14:30:00Z",
    destinos: [{ owner: "u2", cardId: "c2" }, { owner: "yo", cardId: "c1" }, { owner: "u3", cardId: "c3" }],
  };
  it("una notificación por receptor, excluyendo al delegador", () => {
    const n = notifsAlDelegar(base);
    expect(n.map((x) => x.owner)).toEqual(["u2", "u3"]);
    expect(n[0].tipo).toBe("delegacion");
    expect(n[0].card_id).toBe("c2");
    expect(n[0].detalle).toContain("Valentino");
    expect(n[0].detalle).toContain("Conciliar banco");
  });
  it("vacío si solo se delegó a sí mismo", () => {
    expect(notifsAlDelegar({ ...base, destinos: [{ owner: "yo", cardId: "c1" }] })).toEqual([]);
  });
});

describe("notifsAlFinalizar", () => {
  const card = { id: "c1", title: "Cierre IVA", priority: "alta" as const, due_date: null };
  it("finalización con impacto → notifica al manager (avance)", () => {
    const n = notifsAlFinalizar({ card, actorId: "emp", actorName: "Valentino", managerId: "boss" });
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ owner: "boss", tipo: "avance", card_id: "c1" });
    expect(n[0].detalle).toContain("Valentino");
    expect(n[0].detalle).toContain("Cierre IVA");
  });
  it("ANTI-RUIDO: finalización sin impacto NO genera notificación", () => {
    const sinImpacto = { ...card, priority: "baja" as const, due_date: null };
    expect(notifsAlFinalizar({ card: sinImpacto, actorId: "emp", actorName: "V", managerId: "boss" })).toEqual([]);
  });
  it("sin manager, o el manager es quien finaliza → nada (no auto-notificarse)", () => {
    expect(notifsAlFinalizar({ card, actorId: "emp", actorName: "V", managerId: null })).toEqual([]);
    expect(notifsAlFinalizar({ card, actorId: "boss", actorName: "B", managerId: "boss" })).toEqual([]);
  });
});

describe("avisosParaNotificar (E8: aviso propio, vence hoy o mañana)", () => {
  const hoyISO = "2026-07-21";
  const base: Announcement = {
    id: "a1", kind: "vencimiento", title: "IVA", detail: "",
    due_date: hoyISO, created_by: "otro", created_at: "2026-07-01T00:00:00Z",
    owner_id: "yo", visible_to: [],
  };
  it("aviso de otro dueño → no", () => {
    const a = { ...base, owner_id: "otra-persona" };
    expect(avisosParaNotificar([a], "yo", hoyISO, [])).toEqual([]);
  });
  it("vence pasado mañana → no", () => {
    const a = { ...base, due_date: "2026-07-23" };
    expect(avisosParaNotificar([a], "yo", hoyISO, [])).toEqual([]);
  });
  it("vence hoy → sí", () => {
    const a = { ...base, due_date: hoyISO };
    expect(avisosParaNotificar([a], "yo", hoyISO, [])).toEqual([a]);
  });
  it("vence mañana → sí", () => {
    const a = { ...base, due_date: "2026-07-22" };
    expect(avisosParaNotificar([a], "yo", hoyISO, [])).toEqual([a]);
  });
  it("ya notificado → no", () => {
    expect(avisosParaNotificar([base], "yo", hoyISO, ["a1"])).toEqual([]);
  });
  it("archivado → no", () => {
    const a = { ...base, archivado: true };
    expect(avisosParaNotificar([a], "yo", hoyISO, [])).toEqual([]);
  });
  it("owner_id null → no", () => {
    const a = { ...base, owner_id: null };
    expect(avisosParaNotificar([a], "yo", hoyISO, [])).toEqual([]);
  });
});

describe("tiempoRelativo", () => {
  const now = new Date("2026-07-16T12:00:00Z");
  it("recién / minutos / horas / días", () => {
    expect(tiempoRelativo("2026-07-16T11:59:40Z", now)).toBe("recién");
    expect(tiempoRelativo("2026-07-16T11:45:00Z", now)).toBe("hace 15 min");
    expect(tiempoRelativo("2026-07-16T09:00:00Z", now)).toBe("hace 3 h");
    expect(tiempoRelativo("2026-07-14T12:00:00Z", now)).toBe("hace 2 días");
  });
});
