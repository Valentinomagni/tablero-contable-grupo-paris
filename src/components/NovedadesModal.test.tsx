// Primer test de componente real (Testing Library + jsdom, tanda 2 de tooling).
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { NovedadesModal } from "./NovedadesModal";
import { APP_VERSION, CHANGELOG } from "../lib/version";

describe("NovedadesModal", () => {
  it("muestra la versión actual y un cambio del changelog", () => {
    render(<NovedadesModal onClose={vi.fn()} />);
    expect(screen.getByText("Novedades")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Versión ${APP_VERSION.replace(/\./g, "\\.")}`))).toBeInTheDocument();
    expect(screen.getByText(CHANGELOG[0].cambios[0])).toBeInTheDocument();
  });

  it("versión que no existe NO aparece (sanity)", () => {
    render(<NovedadesModal onClose={vi.fn()} />);
    expect(screen.queryByText(/Versión 99\.99\.99/)).not.toBeInTheDocument();
  });
});
