import { describe, it, expect } from "vitest";
import { clasificarFalla, detalleTecnico, mensajeUsuario } from "./fallas";

describe("clasificarFalla — versión vieja tras publicar", () => {
  // El caso real: se publica una versión nueva, el navegador tiene el shell viejo en caché
  // y pide un módulo cuyo hash ya no existe. "Reintentar" NO puede funcionar nunca acá.
  it("detecta el módulo que ya no existe (Chrome/Edge)", () => {
    const f = clasificarFalla(new Error("Failed to fetch dynamically imported module: https://x/assets/Reporte-a1b2.js"), true);
    expect(f.tipo).toBe("version-vieja");
    expect(f.accion).toBe("actualizar");
  });

  it("detecta la variante de Safari", () => {
    expect(clasificarFalla(new Error("Importing a module script failed."), true).tipo).toBe("version-vieja");
  });

  it("detecta ChunkLoadError por nombre", () => {
    const e = new Error("loading chunk 3 failed");
    e.name = "ChunkLoadError";
    expect(clasificarFalla(e, true).tipo).toBe("version-vieja");
  });

  it("explica en lenguaje de usuario, sin jerga técnica", () => {
    const f = clasificarFalla(new Error("Failed to fetch dynamically imported module"), true);
    expect(f.explicacion).not.toMatch(/módulo|chunk|fetch|hash/i);
    expect(f.explicacion.length).toBeGreaterThan(20);
  });
});

describe("clasificarFalla — sin conexión", () => {
  // ORDEN IMPORTANTE: sin red, un módulo también falla al bajar. Ahí la acción correcta es
  // esperar la conexión, NO actualizar: actualizar sin red deja la pantalla en blanco.
  it("estando offline, un fallo de carga es falta de conexión y no versión vieja", () => {
    const f = clasificarFalla(new Error("Failed to fetch dynamically imported module"), false);
    expect(f.tipo).toBe("sin-conexion");
    expect(f.accion).not.toBe("actualizar");
  });

  it("detecta un fallo de red común estando online", () => {
    expect(clasificarFalla(new TypeError("Failed to fetch"), true).tipo).toBe("sin-conexion");
  });

  it("detecta la variante de Safari", () => {
    expect(clasificarFalla(new TypeError("Load failed"), true).tipo).toBe("sin-conexion");
  });
});

describe("clasificarFalla — errores de Postgres", () => {
  it("42501 es falta de permiso, y no se ofrece reintentar", () => {
    const f = clasificarFalla({ code: "42501", message: "new row violates row-level security policy" }, true);
    expect(f.tipo).toBe("sin-permiso");
    expect(f.accion).toBe("ninguna");
  });

  it("reconoce el mensaje de RLS sin código", () => {
    expect(clasificarFalla({ message: "permission denied for table cards" }, true).tipo).toBe("sin-permiso");
  });

  it("42P01 es una migración que falta", () => {
    const f = clasificarFalla({ code: "42P01", message: 'relation "public.card_periodos" does not exist' }, true);
    expect(f.tipo).toBe("falta-migracion");
    expect(f.accion).toBe("ninguna");
  });

  it("42703 (columna inexistente) también es migración que falta", () => {
    expect(clasificarFalla({ code: "42703", message: "column cards.checklist does not exist" }, true).tipo).toBe("falta-migracion");
  });
});

describe("clasificarFalla — el resto", () => {
  it("un error cualquiera es desconocido y se puede reintentar", () => {
    const f = clasificarFalla(new Error("Cannot read properties of undefined"), true);
    expect(f.tipo).toBe("desconocida");
    expect(f.accion).toBe("reintentar");
  });

  it("nunca devuelve null, ni con entradas absurdas", () => {
    for (const raro of [null, undefined, 0, "", [], {}]) {
      const f = clasificarFalla(raro, true);
      expect(f.tipo).toBe("desconocida");
      expect(f.titulo.length).toBeGreaterThan(0);
    }
  });

  it("ningún título ni explicación queda vacío en ningún tipo", () => {
    const casos: unknown[] = [
      new Error("Failed to fetch dynamically imported module"),
      new TypeError("Failed to fetch"),
      { code: "42501" },
      { code: "42P01" },
      new Error("cualquier cosa"),
    ];
    for (const c of casos) {
      const f = clasificarFalla(c, true);
      expect(f.titulo.trim()).not.toBe("");
      expect(f.explicacion.trim()).not.toBe("");
    }
  });
});

describe("mensajeUsuario — nunca el mensaje crudo de la base", () => {
  // EL CASO REAL: el 30/07/2026 una empleada mandó la captura de este cartel al intentar
  // guardar una recurrencia. No dice qué pasó, no dice qué hacer, y asusta.
  it("el error de RLS que vio Celeste se traduce a lenguaje de usuario", () => {
    const e = { code: "42501", message: 'new row violates row-level security policy for table "task_occurrences"' };
    const msg = mensajeUsuario(e, "guardar la recurrencia");
    // Se verifica el SIGNIFICADO, no la redacción exacta: un test atado a las palabras
    // concretas se rompe con cada mejora de copy y termina desalentando mejorarlo.
    expect(msg).not.toMatch(/row-level|policy|task_occurrences|violates/i);
    expect(msg).toMatch(/no puede|no tenés/i);   // dice que la acción no está permitida
    expect(msg).toMatch(/consultas/i);           // y ofrece el canal para reclamarlo
  });

  it("una falla desconocida dice qué se intentaba y ofrece el canal para reportarla", () => {
    const msg = mensajeUsuario(new Error("Cannot read properties of undefined"), "guardar el checklist");
    expect(msg).toContain("guardar el checklist");
    expect(msg).toMatch(/consultas/i);
    // Tampoco se filtra el detalle técnico: ése se copia desde la pantalla de error.
    expect(msg).not.toMatch(/undefined|Cannot read/);
  });

  it("sin conexión lo dice, en vez de culpar a la acción", () => {
    expect(mensajeUsuario(new TypeError("Failed to fetch"), "guardar", false)).toMatch(/conexión|internet/i);
  });

  it("nunca devuelve un texto vacío", () => {
    for (const raro of [null, undefined, 0, "", {}]) {
      expect(mensajeUsuario(raro, "hacer algo").trim().length).toBeGreaterThan(10);
    }
  });
});

describe("detalleTecnico", () => {
  it("incluye el mensaje para poder reportarlo", () => {
    expect(detalleTecnico(new Error("algo puntual falló"))).toContain("algo puntual falló");
  });

  it("incluye el código de Postgres cuando lo hay", () => {
    expect(detalleTecnico({ code: "42501", message: "denied" })).toContain("42501");
  });

  it("no explota con entradas raras", () => {
    expect(typeof detalleTecnico(null)).toBe("string");
    expect(typeof detalleTecnico(undefined)).toBe("string");
  });

  // El detalle se muestra en pantalla y se copia al portapapeles: un texto enorme es
  // inservible para pegarlo en una consulta.
  it("recorta un mensaje kilométrico", () => {
    expect(detalleTecnico(new Error("x".repeat(5000))).length).toBeLessThan(1200);
  });
});
