import { describe, it, expect } from "vitest";
import { cierreDelDia } from "./cierre-dia";

// Cierre del día (spec 28, task 2) — semáforo de repaso personal para MiDia.
// Un paso que no aplica no se muestra; si no aplica ninguno, listo: true y pasos: [].

describe("cierreDelDia", () => {
  it("sin arqueo y sin vencimientos ni operativas → pasos vacíos y listo: true", () => {
    const r = cierreDelDia({
      arqueoHoy: { existe: false, hecho: false },
      vencenHoy: { total: 0, cerradas: 0 },
      operativas: { total: 0, conActividadHoy: 0 },
    });
    expect(r.pasos).toEqual([]);
    expect(r.listo).toBe(true);
  });

  it("arqueo pendiente → paso en pendiente y listo: false", () => {
    const r = cierreDelDia({
      arqueoHoy: { existe: true, hecho: false },
      vencenHoy: { total: 0, cerradas: 0 },
      operativas: { total: 0, conActividadHoy: 0 },
    });
    expect(r.pasos).toHaveLength(1);
    expect(r.pasos[0]).toMatchObject({ key: "arqueo", estado: "pendiente" });
    expect(r.listo).toBe(false);
  });

  it("3 de 3 vencimientos cerrados → paso ok", () => {
    const r = cierreDelDia({
      arqueoHoy: { existe: false, hecho: false },
      vencenHoy: { total: 3, cerradas: 3 },
      operativas: { total: 0, conActividadHoy: 0 },
    });
    expect(r.pasos).toHaveLength(1);
    expect(r.pasos[0]).toMatchObject({ key: "vencenHoy", estado: "ok" });
    expect(r.listo).toBe(true);
  });

  it("mezcla de estados: arqueo hecho, vencimientos incompletos, operativas sin actividad", () => {
    const r = cierreDelDia({
      arqueoHoy: { existe: true, hecho: true },
      vencenHoy: { total: 2, cerradas: 1 },
      operativas: { total: 4, conActividadHoy: 0 },
    });
    expect(r.pasos).toHaveLength(3);
    const byKey = Object.fromEntries(r.pasos.map((p) => [p.key, p]));
    expect(byKey.arqueo.estado).toBe("ok");
    expect(byKey.vencenHoy.estado).toBe("pendiente");
    expect(byKey.operativas.estado).toBe("pendiente");
    expect(r.listo).toBe(false);
  });

  it("operativas sin actividad hoy → pendiente", () => {
    const r = cierreDelDia({
      arqueoHoy: { existe: false, hecho: false },
      vencenHoy: { total: 0, cerradas: 0 },
      operativas: { total: 5, conActividadHoy: 0 },
    });
    expect(r.pasos).toHaveLength(1);
    expect(r.pasos[0]).toMatchObject({ key: "operativas", estado: "pendiente" });
    expect(r.listo).toBe(false);
  });
});
