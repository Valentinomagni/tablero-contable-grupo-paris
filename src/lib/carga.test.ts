import { describe, it, expect } from "vitest";
import { esperaTareas } from "./carga";

describe("qué pantallas esperan a que carguen las tareas", () => {
  it("sin carga en curso, nadie espera", () => {
    expect(esperaTareas("__resumen", "board", false)).toBe(false);
    expect(esperaTareas("u1", "hoy", false)).toBe(false);
  });

  it("las vistas que muestran números esperan", () => {
    // Son las que la auditoría encontró afirmando 0% con la consulta en vuelo.
    for (const v of ["__resumen", "__reporte", "__director", "__cierre", "__bitacora",
                     "__calendario", "__organigrama", "__equipo", "__misarqueos", "__admin"]) {
      expect(esperaTareas(v, "board", true)).toBe(true);
    }
  });

  it("el Tablón y las Anotaciones NO esperan: no leen tareas", () => {
    // Hacerlos esperar los volvería más lentos a cambio de nada.
    expect(esperaTareas("__tablon", "board", true)).toBe(false);
    expect(esperaTareas("__notas", "board", true)).toBe(false);
  });

  it("Mi día, Mi semana y Mi mes esperan", () => {
    // "Nada urgente para hoy" con la lista vacía es la afirmación más engañosa de todas: es
    // exactamente la frase que alguien lee para decidir que puede cerrar la pestaña.
    expect(esperaTareas("u1", "hoy", true)).toBe(true);
    expect(esperaTareas("u1", "semana", true)).toBe(true);
    expect(esperaTareas("u1", "mimes", true)).toBe(true);
  });

  it("Objetivos e Historial NO esperan: traen sus datos por su cuenta", () => {
    expect(esperaTareas("u1", "obj", true)).toBe(false);
    expect(esperaTareas("u1", "hist", true)).toBe(false);
  });

  it("el tablero NO espera acá: ya tiene su propio esqueleto de columnas", () => {
    // Si esto diera true, el BoardSkeleton —que imita las columnas y es mejor— nunca se vería.
    expect(esperaTareas("u1", "board", true)).toBe(false);
  });

  it("ante datos raros no rompe", () => {
    expect(esperaTareas("", "", true)).toBe(true);
    expect(esperaTareas(undefined as unknown as string, "board", true)).toBe(false);
  });
});
