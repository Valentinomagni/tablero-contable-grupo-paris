import { describe, it, expect } from "vitest";
import { camposDeAlta, TIPO_ALTA_POR_DEFECTO } from "./recurrencia-alta";

describe("camposDeAlta", () => {
  it("una tarea de una sola vez no se reinicia nunca", () => {
    const c = camposDeAlta("una-vez");
    expect(c.recurring).toBe(false);
    expect(c.reset_policy).toBe("manual");
  });

  it("una tarea de todos los meses se reinicia con el mes", () => {
    const c = camposDeAlta("cada-mes");
    expect(c.recurring).toBe(true);
    expect(c.reset_policy).toBe("mensual");
  });

  // El default seguro es "una vez": lo reversible va primero. Marcar después que algo se
  // repite cuesta un click; darse cuenta seis meses después de que veinte tareas puntuales
  // vienen reapareciendo cuesta una limpieza entera.
  it("el default es una sola vez", () => {
    expect(TIPO_ALTA_POR_DEFECTO).toBe("una-vez");
  });

  it("ante un valor inesperado cae al default seguro", () => {
    const c = camposDeAlta("cualquier cosa" as never);
    expect(c.recurring).toBe(false);
  });
});
