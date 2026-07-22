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

  it("reportar a fábrica siempre supera a quien no reporta, dentro del rango válido 0..4", () => {
    const manualAlta = empresa({ reporta_fabrica: false, prioridad: 4 });
    const fabricaBaja = empresa({ reporta_fabrica: true, prioridad: 0 });
    // Esperado: prioridadEmpresa(fabricaBaja) = 0 + 5 = 5
    //           prioridadEmpresa(manualAlta) = 4 + 0 = 4
    // Fábrica baja gana: 5 > 4
    expect(prioridadEmpresa(fabricaBaja)).toBeGreaterThan(prioridadEmpresa(manualAlta));
  });

  it("clampea defensivamente prioridad > 4 a 4 (datos de base vieja)", () => {
    const viejaFueraRango = empresa({ reporta_fabrica: false, prioridad: 100 });
    const fabricaBaja = empresa({ reporta_fabrica: true, prioridad: 0 });
    // Aunque prioridad=100, se clampea a 4: prioridadEmpresa = 4 + 0 = 4
    // Fábrica baja: 0 + 5 = 5, así que gana por el clamp defensivo
    expect(prioridadEmpresa(fabricaBaja)).toBeGreaterThan(prioridadEmpresa(viejaFueraRango));
  });

  it("clampea defensivamente prioridad negativa a 0 (datos de base vieja)", () => {
    const viejaNegativa = empresa({ reporta_fabrica: false, prioridad: -10 });
    const valida = empresa({ reporta_fabrica: false, prioridad: 0 });
    // -10 se clampea a 0: ambas dan prioridadEmpresa = 0
    expect(prioridadEmpresa(viejaNegativa)).toBe(prioridadEmpresa(valida));
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
