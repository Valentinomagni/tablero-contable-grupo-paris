import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Panel } from "./Panel";

describe("Panel", () => {
  // ANCLA DE LA MIGRACIÓN: este test es lo que hace que reemplazar 16 tarjetas hechas a mano
  // sea seguro sin mirar la pantalla. Si `Panel` produce exactamente las clases que estaban
  // escritas a mano, el cambio no puede alterar el aspecto de nada.
  it("produce las mismas clases que la tarjeta que estaba copiada a mano", () => {
    const { container } = render(<Panel>x</Panel>);
    const el = container.firstElementChild as HTMLElement;
    for (const clase of ["bg-surface", "border", "border-line", "rounded-2xl", "p-[18px]"]) {
      expect(el.className, `falta la clase ${clase}`).toContain(clase);
    }
  });

  it("lleva la sombra de tarjeta del sistema, no una propia", () => {
    const { container } = render(<Panel>x</Panel>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.boxShadow).toContain("var(--ring-sh)");
    expect(el.style.boxShadow).toContain("var(--shadow)");
  });

  it("deja agregar clases sin perder las propias", () => {
    const { container } = render(<Panel className="mt-4">x</Panel>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("mt-4");
    expect(el.className).toContain("bg-surface");
  });

  it("la densidad compacta cambia el padding y nada más", () => {
    const { container } = render(<Panel densidad="compacta">x</Panel>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("p-3");
    expect(el.className).not.toContain("p-[18px]");
    expect(el.className).toContain("rounded-2xl");
  });

  it("renderiza lo que le pongan adentro", () => {
    const { getByText } = render(<Panel><span>contenido</span></Panel>);
    expect(getByText("contenido")).toBeTruthy();
  });
});
