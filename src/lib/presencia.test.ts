import { describe, it, expect } from "vitest";
import { enLinea, textoUltimaConexion } from "./presencia";

const AHORA = "2026-07-21T15:00:00.000Z";

describe("enLinea", () => {
  it("null/undefined -> false", () => {
    expect(enLinea(null, AHORA)).toBe(false);
    expect(enLinea(undefined, AHORA)).toBe(false);
  });

  it("hace 1 minuto -> en línea", () => {
    expect(enLinea("2026-07-21T14:59:00.000Z", AHORA)).toBe(true);
  });

  it("borde exacto del umbral (3 min) -> en línea", () => {
    expect(enLinea("2026-07-21T14:57:00.000Z", AHORA, 3)).toBe(true);
  });

  it("un segundo pasado el umbral -> no en línea", () => {
    expect(enLinea("2026-07-21T14:56:59.000Z", AHORA, 3)).toBe(false);
  });
});

describe("textoUltimaConexion", () => {
  it("sin last_seen -> Sin registro", () => {
    expect(textoUltimaConexion(null, AHORA)).toBe("Sin registro");
    expect(textoUltimaConexion(undefined, AHORA)).toBe("Sin registro");
  });

  it("hace 1 minuto -> En línea", () => {
    expect(textoUltimaConexion("2026-07-21T14:59:00.000Z", AHORA)).toBe("En línea");
  });

  it("hace 12 minutos -> Hace 12 minutos", () => {
    expect(textoUltimaConexion("2026-07-21T14:48:00.000Z", AHORA)).toBe("Hace 12 minutos");
  });

  it("hace 3 horas -> Hace 3 horas", () => {
    expect(textoUltimaConexion("2026-07-21T12:00:00.000Z", AHORA)).toBe("Hace 3 horas");
  });

  it("ayer -> Ayer HH:MM (hora Argentina)", () => {
    // 21/07 15:00 UTC - 24h = 20/07 15:00 UTC = 20/07 12:00 ART; ahora es 21/07 15:00 UTC = 21/07 12:00 ART -> día distinto
    expect(textoUltimaConexion("2026-07-20T15:00:00.000Z", AHORA)).toBe("Ayer 12:00");
  });

  it("borde exacto del umbral (3 min) -> En línea", () => {
    expect(textoUltimaConexion("2026-07-21T14:57:00.000Z", AHORA)).toBe("En línea");
  });
});
