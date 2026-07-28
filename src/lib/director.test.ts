import { describe, it, expect } from "vitest";
import { panelesDirector, type EntradaDirector } from "./director";

const BASE: EntradaDirector = { vencidas: 0, bloqueadas: 0, venceEnDias: null, concentracion: 0, pctPlanificado: 100 };
const areaDe = (e: EntradaDirector, area: string) => panelesDirector(e).find((p) => p.area === area)!;

describe("panelesDirector", () => {
  it("todo en orden → los cinco paneles en verde", () => {
    const ps = panelesDirector(BASE);
    expect(ps).toHaveLength(5);
    expect(ps.every((p) => p.semaforo === "ok")).toBe(true);
  });
  it("tareas vencidas ponen Riesgos en rojo", () => {
    expect(areaDe({ ...BASE, vencidas: 3 }, "Riesgos").semaforo).toBe("riesgo");
  });
  it("pocas bloqueadas es atención; muchas es riesgo", () => {
    expect(areaDe({ ...BASE, bloqueadas: 2 }, "Dependencias").semaforo).toBe("atencion");
    expect(areaDe({ ...BASE, bloqueadas: 8 }, "Dependencias").semaforo).toBe("riesgo");
  });
  it("un vencimiento muy cerca pone el Calendario en rojo", () => {
    expect(areaDe({ ...BASE, venceEnDias: 1 }, "Calendario").semaforo).toBe("riesgo");
    expect(areaDe({ ...BASE, venceEnDias: 12 }, "Calendario").semaforo).toBe("ok");
  });
  it("mucha concentración de conocimiento es riesgo de continuidad", () => {
    expect(areaDe({ ...BASE, concentracion: 3 }, "Continuidad").semaforo).toBe("riesgo");
  });
  it("demasiadas urgencias marcan la planificación", () => {
    expect(areaDe({ ...BASE, pctPlanificado: 30 }, "Planificación").semaforo).toBe("riesgo");
  });
  it("los titulares describen la situación, sin nombrar ni juzgar personas", () => {
    const p = areaDe({ ...BASE, bloqueadas: 8 }, "Dependencias");
    expect(p.titular).toBe("8 tareas detenidas");
    expect(p.titular).not.toMatch(/culpa|responsable de|por causa/i);
  });
  it("es defensivo ante una entrada incompleta", () => {
    expect(panelesDirector({} as EntradaDirector)).toHaveLength(5);
  });
});
