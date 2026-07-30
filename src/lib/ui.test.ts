import { describe, it, expect, vi } from "vitest";
import type { KeyboardEvent } from "react";
import { teclaActiva } from "./ui";

// Evento mínimo: sólo lo que el helper mira (key) y lo que debe llamar (preventDefault).
const evento = (key: string) => {
  const preventDefault = vi.fn();
  return { ev: { key, preventDefault } as unknown as KeyboardEvent, preventDefault };
};

describe("teclaActiva", () => {
  it("dispara la acción con Enter", () => {
    const accion = vi.fn();
    const { ev } = evento("Enter");
    teclaActiva(accion)(ev);
    expect(accion).toHaveBeenCalledTimes(1);
  });

  it("dispara la acción con Espacio", () => {
    const accion = vi.fn();
    const { ev } = evento(" ");
    teclaActiva(accion)(ev);
    expect(accion).toHaveBeenCalledTimes(1);
  });

  it("no dispara con otra tecla", () => {
    const accion = vi.fn();
    const { ev, preventDefault } = evento("a");
    teclaActiva(accion)(ev);
    expect(accion).not.toHaveBeenCalled();
    // tampoco debe frenar el evento: escribir en un input tiene que seguir funcionando
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("llama a preventDefault: sin eso el Espacio además scrollea la página", () => {
    const { ev, preventDefault } = evento(" ");
    teclaActiva(vi.fn())(ev);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});
