import { describe, it, expect } from "vitest";
import { estadoCierre, proyeccionCierre } from "./cierre-unificado";
import type { CierreStats } from "./cierre";
import type { Card, Snapshot } from "./types";

const stats = (over: Partial<CierreStats> = {}): CierreStats => ({
  total: 20, done: 20, proc: 0, pend: 0, overdue: 0, pct: 100, onTimePct: null, ...over,
});

describe("estadoCierre", () => {
  it("los tres pasos ok → cerrado", () => {
    const r = estadoCierre({ checklist: stats({ pct: 100 }), archivadoMesPrevio: true, recurrentesOk: true });
    expect(r.cerrado).toBe(true);
    expect(r.pasos.map((p) => p.estado)).toEqual(["ok", "ok", "ok"]);
    expect(r.pasos.map((p) => p.key)).toEqual(["checklist", "archivo", "recurrentes"]);
  });

  it("checklist null → pendiente y NO cerrado", () => {
    const r = estadoCierre({ checklist: null, archivadoMesPrevio: true, recurrentesOk: true });
    const paso = r.pasos.find((p) => p.key === "checklist")!;
    expect(paso.estado).toBe("pendiente");
    expect(paso.detalle).toBe("Todavía no se generó el checklist de este mes.");
    expect(r.cerrado).toBe(false);
  });

  it("checklist pct<100 → atencion con conteo de tareas", () => {
    const r = estadoCierre({ checklist: stats({ total: 20, done: 18, pct: 90 }), archivadoMesPrevio: true, recurrentesOk: true });
    const paso = r.pasos.find((p) => p.key === "checklist")!;
    expect(paso.estado).toBe("atencion");
    expect(paso.detalle).toBe("18 de 20 tareas cerradas");
    expect(r.cerrado).toBe(false);
  });

  it("archivo sin mes previo → pendiente (cron)", () => {
    const r = estadoCierre({ checklist: stats(), archivadoMesPrevio: false, recurrentesOk: true });
    const paso = r.pasos.find((p) => p.key === "archivo")!;
    expect(paso.estado).toBe("pendiente");
    expect(paso.detalle).toBe("El archivo del mes pasado se genera solo al cambiar de mes (cron).");
    expect(r.cerrado).toBe(false);
  });

  it("recurrentes no ok → atencion", () => {
    const r = estadoCierre({ checklist: stats(), archivadoMesPrevio: true, recurrentesOk: false });
    const paso = r.pasos.find((p) => p.key === "recurrentes")!;
    expect(paso.estado).toBe("atencion");
    expect(r.cerrado).toBe(false);
  });

  it("checklist ok muestra detalle con conteo", () => {
    const r = estadoCierre({ checklist: stats({ total: 12, done: 12, pct: 100 }), archivadoMesPrevio: true, recurrentesOk: true });
    const paso = r.pasos.find((p) => p.key === "checklist")!;
    expect(paso.estado).toBe("ok");
    expect(paso.detalle).toBe("12 de 12 tareas cerradas");
  });
});

// helpers mínimos: proyeccionCierre solo mira status/owner (cards) y day/owner/done_count (snapshots)
const card = (owner: string, status: Card["status"]): Card => ({
  id: `${owner}-${Math.random()}`, owner, title: "t", status, description: "",
  checklist: [], comments: [], history: [], done_at: null, due_date: null, recurring: false,
  priority: "media", effort: 1, card_type: "normal", deps: [], created_at: "2026-01-01",
});
const snap = (owner: string, day: string, done_count: number): Snapshot => ({
  day, owner, open_count: 0, open_effort: 0, done_count, done_effort: 0, activity_qty: 0,
});

describe("proyeccionCierre", () => {
  const HOY = "2026-07-22"; // miércoles
  const FIN_MES = "2026-07-31";

  it("sin faltantes → alcanza y faltan 0, sin importar el ritmo", () => {
    const closing = [card("u1", "term"), card("u1", "term")];
    const r = proyeccionCierre(closing, [], HOY, FIN_MES);
    expect(r.faltan).toBe(0);
    expect(r.alcanza).toBe(true);
  });

  it("ritmo 0 (sin snapshots) → no proyecta: diasNecesarios null y alcanza true", () => {
    const closing = [card("u1", "pend"), card("u1", "pend")];
    const r = proyeccionCierre(closing, [], HOY, FIN_MES);
    expect(r.ritmoDiario).toBe(0);
    expect(r.diasNecesarios).toBeNull();
    expect(r.alcanza).toBe(true);
  });

  it("ritmo suficiente → alcanza true", () => {
    const closing = [card("u1", "pend"), card("u1", "pend"), card("u1", "pend"), card("u1", "pend"), card("u1", "pend")];
    // 5 días hábiles en la ventana (15,16,17,20,21 jul) x 2/día = ritmo 2 → faltan 5 en 3 días, sobran 8 hábiles.
    const snapshots = [
      snap("u1", "2026-07-15", 2), snap("u1", "2026-07-16", 2), snap("u1", "2026-07-17", 2),
      snap("u1", "2026-07-20", 2), snap("u1", "2026-07-21", 2),
    ];
    const r = proyeccionCierre(closing, snapshots, HOY, FIN_MES);
    expect(r.ritmoDiario).toBe(2);
    expect(r.diasNecesarios).toBe(3);
    expect(r.alcanza).toBe(true);
  });

  it("ritmo insuficiente → alcanza false con diasNecesarios > restantes", () => {
    const closing = Array.from({ length: 50 }, () => card("u1", "pend"));
    const snapshots = [
      snap("u1", "2026-07-15", 1), snap("u1", "2026-07-16", 1), snap("u1", "2026-07-17", 1),
      snap("u1", "2026-07-20", 1), snap("u1", "2026-07-21", 1),
    ];
    const r = proyeccionCierre(closing, snapshots, HOY, FIN_MES);
    expect(r.ritmoDiario).toBe(1);
    // restantes hábiles hoy→fin de mes: 22,23,24,27,28,29,30,31 = 8
    expect(r.diasNecesarios).toBe(50);
    expect(r.alcanza).toBe(false);
  });

  it("snapshots vacíos no rompe", () => {
    expect(() => proyeccionCierre([card("u1", "pend")], [], HOY, FIN_MES)).not.toThrow();
  });

  it("borde de fin de mes: hoy es el último día hábil, alcanza si el ritmo cubre justo lo que falta", () => {
    const closing = [card("u1", "pend")];
    const snapshots = [
      snap("u1", "2026-07-24", 1), snap("u1", "2026-07-27", 1), snap("u1", "2026-07-28", 1),
      snap("u1", "2026-07-29", 1), snap("u1", "2026-07-30", 1),
    ];
    const r = proyeccionCierre(closing, snapshots, "2026-07-31", "2026-07-31");
    expect(r.diasNecesarios).toBe(1);
    expect(r.alcanza).toBe(true);
  });

  it("ignora snapshots de dueños ajenos al cierre analizado", () => {
    const closing = [card("u1", "pend")];
    const snapshots = [snap("otro", "2026-07-21", 100)];
    const r = proyeccionCierre(closing, snapshots, HOY, FIN_MES);
    expect(r.ritmoDiario).toBe(0);
    expect(r.diasNecesarios).toBeNull();
  });
});
