import { describe, it, expect, vi, beforeEach } from "vitest";
import { anonimizar, debeReportar } from "./monitoreo";

beforeEach(() => vi.restoreAllMocks());

describe("anonimizar", () => {
  // El equipo escribe cosas privadas en las tareas. Un reporte de error NO puede llevarse
  // el contenido de una consulta ni el texto de una anotación a un servidor de terceros.
  it("saca el texto libre y deja la forma del error", () => {
    const limpio = anonimizar({ mensaje: "falló", texto: "el cliente debe $400.000", titulo: "IVA de Perez" });
    expect(JSON.stringify(limpio)).not.toMatch(/400\.000|Perez/);
  });

  it("conserva lo que sirve para diagnosticar", () => {
    const limpio = anonimizar({ mensaje: "PGRST204", ruta: "/tablero", codigo: "42501" });
    const s = JSON.stringify(limpio);
    expect(s).toContain("PGRST204");
    expect(s).toContain("42501");
  });

  it("nunca deja pasar un email ni un token", () => {
    const limpio = anonimizar({ mensaje: "falló para juan@paris.com con Bearer abc123def456" });
    const s = JSON.stringify(limpio);
    expect(s).not.toMatch(/juan@paris\.com/);
    expect(s).not.toMatch(/abc123def456/);
  });

  it("es defensiva ante entradas raras", () => {
    expect(() => anonimizar(null)).not.toThrow();
    expect(() => anonimizar(undefined)).not.toThrow();
  });
});

describe("debeReportar", () => {
  it("una falla desconocida se reporta: es la que nadie vio venir", () => {
    expect(debeReportar(new Error("undefined is not a function"), true)).toBe(true);
  });

  // Sin conexión no es un error del sistema: es el tren, el ascensor, el wifi de la oficina.
  // Reportarlo llena el panel de ruido y esconde lo que sí importa.
  it("la falta de conexión NO se reporta", () => {
    expect(debeReportar(new TypeError("Failed to fetch"), false)).toBe(false);
  });

  it("una versión vieja tras publicar NO se reporta: es esperable y ya se resuelve sola", () => {
    expect(debeReportar(new Error("Failed to fetch dynamically imported module"), true)).toBe(false);
  });

  it("la falta de permiso SÍ se reporta: puede ser una policy mal puesta", () => {
    expect(debeReportar({ code: "42501", message: "row-level security" }, true)).toBe(true);
  });

  // Una regla de estado frenando un cierre (trigger `cards_validar_estado`, migración 53) es el
  // sistema funcionando, no un defecto. Se va a disparar todos los días: si se reportara,
  // taparía en el panel el error raro que aparece una vez cada tres días.
  it("una regla de estado que frena un cierre NO se reporta: es la regla haciendo su trabajo", () => {
    expect(debeReportar({ code: "P0001", message: "regla_estado: Faltan 2 pasos del checklist." }, true)).toBe(false);
  });

  it("es defensiva", () => {
    expect(typeof debeReportar(null, true)).toBe("boolean");
  });
});
