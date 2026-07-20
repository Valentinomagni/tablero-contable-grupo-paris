import { describe, it, expect, beforeEach } from "vitest";
import { PREF, getPref, setPref, migrarPrefs } from "./prefs";

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
