import { describe, it, expect } from "vitest";
import { clasificarFalla, detalleTecnico, mensajeUsuario, FallaDeUsuario } from "./fallas";

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

// ── El error que la app escribió a propósito ────────────────────────────────────
//
// HALLAZGO 6 DE LA AUDITORÍA DEL 05/08. `UserModal` mostraba `e.message` tal cual, con un
// comentario al lado que decía que sólo lo hacía "si ya viene en lenguaje entendible". Esa
// comprobación no existía en ninguna parte del código: mostraba todo.
//
// La raíz es que `Error` no distingue "esto lo escribí yo para vos" de "esto lo dijo Postgres",
// y sin esa distinción hay que elegir entre pasar todo crudo o tapar también los mensajes
// buenos. `FallaDeUsuario` la pone en el tipo.
describe("FallaDeUsuario", () => {
  it("respeta el texto tal cual: para eso se lanzó", () => {
    const e = new FallaDeUsuario("No se pudo guardar: tu cuenta no tiene permiso para editar este perfil.");
    expect(mensajeUsuario(e, "guardar el perfil")).toBe(
      "No se pudo guardar: tu cuenta no tiene permiso para editar este perfil.",
    );
  });

  it("gana sobre las ramas de clasificación, que si no le comerían el detalle", () => {
    // El mensaje de arriba contiene la palabra "permiso". Si se clasificara primero, la rama
    // de sin-permiso lo reemplazaría por su explicación genérica y se perdería el "editar este
    // perfil", que es justamente lo que le dice a la persona qué pasó.
    const e = new FallaDeUsuario("No tenés permiso para editar este perfil.");
    expect(mensajeUsuario(e, "guardar")).toContain("editar este perfil");
  });

  it("un Error común SIGUE tapándose: la excepción es angosta a propósito", () => {
    const crudo = new Error('new row violates row-level security policy for table "profiles"');
    const m = mensajeUsuario(crudo, "guardar el perfil");
    expect(m).not.toContain("row-level security");
    expect(m).not.toContain("profiles");
  });
});

// ── La regla de estado que llega desde la base ──────────────────────────────────
//
// El trigger `cards_validar_estado` (migración 53) frena los cierres que no cumplen las dos
// reglas del tablero, y manda el motivo YA ESCRITO para una persona. El problema es que llega
// como un `Error` de Postgres cualquiera, y la regla del proyecto es que un error nunca muestra
// el mensaje crudo de la base: sin una marca, el front no puede distinguir este texto del
// volcado de un 42501 y tiene que taparlo con el genérico.
//
// La marca lo resuelve, y es el MISMO mecanismo que `ya_cerrado:` en `reinicio-mensual.ts`
// (migración 50). Es un código, no un mensaje: lo que ve la persona es lo que sigue al prefijo.
describe("reglas de estado de la base", () => {
  it("una regla de estado de la base llega en castellano, sin el prefijo", () => {
    const e = new Error("regla_estado: Antes de terminarla, pasala a En proceso.");
    const m = mensajeUsuario(e, "mover la tarea");
    expect(m).toBe("Antes de terminarla, pasala a En proceso.");
    expect(m).not.toContain("regla_estado");
  });

  it("también con el motivo del checklist, que trae un número adentro", () => {
    const e = new Error("regla_estado: Faltan 3 pasos del checklist.");
    expect(mensajeUsuario(e, "mover la tarea")).toBe("Faltan 3 pasos del checklist.");
  });

  // Llega como error de PostgREST, que es un objeto con `message` y `code`, no un `Error`.
  it("lo reconoce igual cuando viene como error de PostgREST", () => {
    const e = { code: "P0001", message: "regla_estado: Falta 1 paso del checklist.", details: null };
    expect(mensajeUsuario(e, "cerrar la tarea")).toBe("Falta 1 paso del checklist.");
  });

  it("clasifica sin ofrecer reintentar: reintentar no puede funcionar hasta que se cumpla", () => {
    const f = clasificarFalla(new Error("regla_estado: Faltan 2 pasos del checklist."), true);
    expect(f.tipo).toBe("regla-de-estado");
    expect(f.explicacion).toBe("Faltan 2 pasos del checklist.");
    expect(f.accion).toBe("ninguna");
  });

  // Mismo criterio que `yaEstabaCerrado`: la marca vale SÓLO al principio. En el medio de una
  // frase es texto, y tratarlo como código dejaría a la persona con media oración.
  it("la marca en el medio de un mensaje no cuenta", () => {
    const e = new Error('violates check constraint "regla_estado: algo"');
    const m = mensajeUsuario(e, "mover la tarea");
    expect(m).toContain("No se pudo mover la tarea");
  });

  // Defensa por si algún día alguien escribe la marca y se olvida el motivo: un cartel vacío es
  // peor que el genérico, porque no dice nada Y no dice dónde preguntar.
  it("con la marca pero sin texto detrás, cae en el genérico", () => {
    const m = mensajeUsuario(new Error("regla_estado:   "), "mover la tarea");
    expect(m).toContain("No se pudo mover la tarea");
  });
});
