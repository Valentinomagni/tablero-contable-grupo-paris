import { describe, it, expect } from "vitest";
import { estadoCierre } from "./cierre-unificado";
import type { CierreStats } from "./cierre";

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
