import { describe, it, expect } from "vitest";
import { mesAnterior, reinicioPendiente, type Reinicio } from "./reinicio-mensual";

// Fila mínima de `reinicios_mensuales` para los casos de abajo. Los contadores no
// participan de la decisión: lo único que importa es que la fila EXISTA.
const fila = (mes: string): Reinicio => ({
  mes, corrido_at: `${mes}-01T03:05:00.000Z`, origen: "cron", archivadas: 84, reseteadas: 61,
});

describe("mesAnterior", () => {
  it("en un mes normal devuelve el anterior", () => {
    // 04/08/2026 — el día que se reportó el problema.
    expect(mesAnterior("2026-08-04T12:00:00.000Z")).toBe("2026-07");
  });

  it("en enero devuelve diciembre del año anterior", () => {
    expect(mesAnterior("2026-01-09T12:00:00.000Z")).toBe("2025-12");
  });

  it("usa el día ARGENTINO, no el del navegador", () => {
    // 01/08 a las 01:00 UTC todavía es 31/07 en Argentina (UTC-3): el mes anterior
    // al mes argentino en curso (julio) es JUNIO, no julio.
    expect(mesAnterior("2026-08-01T01:00:00.000Z")).toBe("2026-06");
  });
});

describe("reinicioPendiente", () => {
  const hoy = "2026-08-04T12:00:00.000Z";

  it("con el reinicio del mes pasado registrado, no avisa", () => {
    expect(reinicioPendiente([fila("2026-07")], hoy)).toBeNull();
  });

  it("sin el reinicio del mes pasado, devuelve el mes que falta", () => {
    expect(reinicioPendiente([fila("2026-06")], hoy)).toBe("2026-07");
  });

  it("con la lista vacía avisa (la tabla arranca vacía a propósito)", () => {
    expect(reinicioPendiente([], hoy)).toBe("2026-07");
  });

  it("con entradas basura no rompe: las saltea", () => {
    const basura = [null, undefined, 42, "2026-07", { mes: null }, { otra: 1 }] as unknown as Reinicio[];
    expect(reinicioPendiente(basura, hoy)).toBe("2026-07");
  });

  it("con algo que no es un arreglo lo trata como lista vacía", () => {
    expect(reinicioPendiente(undefined as unknown as Reinicio[], hoy)).toBe("2026-07");
    expect(reinicioPendiente(null as unknown as Reinicio[], hoy)).toBe("2026-07");
    expect(reinicioPendiente({} as unknown as Reinicio[], hoy)).toBe("2026-07");
  });

  it("una fila basura entre filas buenas no tapa la fila buena", () => {
    const mezcla = [null, fila("2026-07"), undefined] as unknown as Reinicio[];
    expect(reinicioPendiente(mezcla, hoy)).toBeNull();
  });
});
