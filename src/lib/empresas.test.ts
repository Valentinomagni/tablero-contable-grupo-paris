import { describe, it, expect } from "vitest";
import { prioridadEmpresa, ordenarEmpresas } from "./empresas";
import type { Empresa } from "./types";

function empresa(over: Partial<Empresa>): Empresa {
  return {
    id: "1", nombre: "Empresa", cuit: null, cierre_balance: null,
    reporta_fabrica: false, prioridad: 0, created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("prioridadEmpresa", () => {
  it("a igual prioridad manual, reportar a fábrica pesa más", () => {
    const conFabrica = empresa({ reporta_fabrica: true, prioridad: 1 });
    const sinFabrica = empresa({ reporta_fabrica: false, prioridad: 1 });
    expect(prioridadEmpresa(conFabrica)).toBeGreaterThan(prioridadEmpresa(sinFabrica));
  });

  it("prioridad manual alta gana aunque no reporte a fábrica", () => {
    const manualAlta = empresa({ reporta_fabrica: false, prioridad: 10 });
    const fabricaBaja = empresa({ reporta_fabrica: true, prioridad: 0 });
    expect(prioridadEmpresa(manualAlta)).toBeGreaterThan(prioridadEmpresa(fabricaBaja));
  });

  it("es determinística: misma empresa, mismo resultado", () => {
    const e = empresa({ reporta_fabrica: true, prioridad: 3 });
    expect(prioridadEmpresa(e)).toBe(prioridadEmpresa(e));
  });
});

describe("ordenarEmpresas", () => {
  it("lista vacía devuelve lista vacía", () => {
    expect(ordenarEmpresas([])).toEqual([]);
  });

  it("mayor prioridad primero", () => {
    const baja = empresa({ id: "a", nombre: "A", prioridad: 0, reporta_fabrica: false });
    const alta = empresa({ id: "b", nombre: "B", prioridad: 5, reporta_fabrica: false });
    expect(ordenarEmpresas([baja, alta]).map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("empate de prioridad desempata alfabéticamente por nombre", () => {
    const zeta = empresa({ id: "z", nombre: "Zeta SA", prioridad: 2, reporta_fabrica: false });
    const alfa = empresa({ id: "a", nombre: "Alfa SA", prioridad: 2, reporta_fabrica: false });
    expect(ordenarEmpresas([zeta, alfa]).map((e) => e.id)).toEqual(["a", "z"]);
  });

  it("no muta el array original", () => {
    const lista = [empresa({ id: "a", nombre: "A", prioridad: 0 }), empresa({ id: "b", nombre: "B", prioridad: 5 })];
    const copia = [...lista];
    ordenarEmpresas(lista);
    expect(lista).toEqual(copia);
  });
});
