import { describe, it, expect, beforeEach } from "vitest";
import { PREF, getPref, setPref, migrarPrefs, leerColumnasPlegadas, alternarColumnaPlegada } from "./prefs";

// jsdom provee localStorage; lo limpiamos entre tests.
beforeEach(() => localStorage.clear());

describe("prefs", () => {
  it("getPref devuelve null si la clave no existe", () => {
    expect(getPref(PREF.theme)).toBeNull();
  });

  it("setPref/getPref redondean el viaje", () => {
    setPref(PREF.theme, "dark");
    expect(getPref(PREF.theme)).toBe("dark");
  });

  it("migrarPrefs copia las claves viejas a las namespaced", () => {
    localStorage.setItem("pref-theme", "dark");
    localStorage.setItem("pref-sidebar", "closed");
    localStorage.setItem("version-vista", "2.3.0");
    migrarPrefs();
    expect(getPref(PREF.theme)).toBe("dark");
    expect(getPref(PREF.sidebar)).toBe("closed");
    expect(getPref(PREF.version)).toBe("2.3.0");
    expect(getPref(PREF.density)).toBeNull(); // no había vieja
  });

  it("migrarPrefs NO pisa un valor nuevo ya existente", () => {
    localStorage.setItem("pref-theme", "light");
    localStorage.setItem(PREF.theme, "dark");
    migrarPrefs();
    expect(getPref(PREF.theme)).toBe("dark");
  });

  it("migrarPrefs es idempotente", () => {
    localStorage.setItem("tablon-visto", "2026-07-01");
    migrarPrefs();
    setPref(PREF.tablon, "2026-07-15");
    migrarPrefs();
    expect(getPref(PREF.tablon)).toBe("2026-07-15");
  });

  it("migrarPrefs setea modo 'categoria' si el toggle viejo estaba en '1' y no hay modo guardado", () => {
    setPref(PREF.agrupar, "1");
    migrarPrefs();
    expect(getPref(PREF.agruparModo)).toBe("categoria");
  });

  it("migrarPrefs NO pisa un modo ya elegido por el usuario", () => {
    setPref(PREF.agrupar, "1");
    setPref(PREF.agruparModo, "marca");
    migrarPrefs();
    expect(getPref(PREF.agruparModo)).toBe("marca");
  });

  it("migrarPrefs no setea modo si el toggle viejo no estaba activo", () => {
    setPref(PREF.agrupar, "0");
    migrarPrefs();
    expect(getPref(PREF.agruparModo)).toBeNull();
  });
});

// REGLA QUE PROTEGE: una columna que se despliega sola en cada carga es peor que no tener
// la función — le enseña a la persona que no anda, y deja de plegar. Por eso lo que se
// prueba acá no es "el estado cambia" sino "lo que se eligió sigue estando después".
describe("columnas plegadas del tablero", () => {
  it("al principio no hay ninguna columna plegada", () => {
    expect(leerColumnasPlegadas("u1")).toEqual([]);
  });

  it("plegar una columna la deja anotada", () => {
    expect(alternarColumnaPlegada("u1", "term")).toEqual(["term"]);
    expect(leerColumnasPlegadas("u1")).toEqual(["term"]);
  });

  it("volver a alternar la misma columna la despliega", () => {
    alternarColumnaPlegada("u1", "term");
    expect(alternarColumnaPlegada("u1", "term")).toEqual([]);
    expect(leerColumnasPlegadas("u1")).toEqual([]);
  });

  it("se pueden plegar varias sin que una pise a la otra", () => {
    alternarColumnaPlegada("u1", "term");
    alternarColumnaPlegada("u1", "proc");
    expect(leerColumnasPlegadas("u1")).toEqual(["term", "proc"]);
    alternarColumnaPlegada("u1", "term");
    expect(leerColumnasPlegadas("u1")).toEqual(["proc"]);
  });

  // Recargar la página = volver a leer localStorage sin nada en memoria. Es exactamente
  // lo que hace este test: lo guardado alcanza para reconstruir la elección.
  it("sobrevive a recargar la página", () => {
    alternarColumnaPlegada("u1", "term");
    expect(JSON.parse(getPref(PREF.columnasPlegadas("u1"))!)).toEqual(["term"]);
    expect(leerColumnasPlegadas("u1")).toEqual(["term"]);
  });

  it("cada tablero guarda las suyas: plegar en el mío no pliega el de otra persona", () => {
    alternarColumnaPlegada("u1", "term");
    expect(leerColumnasPlegadas("u2")).toEqual([]);
  });

  it("un valor guardado roto se ignora, en vez de dejar a alguien sin tablero", () => {
    setPref(PREF.columnasPlegadas("u1"), "esto no es json");
    expect(leerColumnasPlegadas("u1")).toEqual([]);
    setPref(PREF.columnasPlegadas("u1"), JSON.stringify({ term: true }));
    expect(leerColumnasPlegadas("u1")).toEqual([]);
    setPref(PREF.columnasPlegadas("u1"), JSON.stringify(["term", 7, null]));
    expect(leerColumnasPlegadas("u1")).toEqual(["term"]);
  });
});
