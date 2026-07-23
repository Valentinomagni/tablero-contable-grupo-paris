import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ErrorBoundary } from "./ErrorBoundary";

afterEach(cleanup);

function Bomba(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("muestra la pantalla de recuperación en vez de propagar el error", () => {
    // La consola tira el error de render (jsdom) y componentDidCatch además hace console.error: silenciamos ambos.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomba />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Algo se rompió en esta pantalla")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recargar la app" })).toBeInTheDocument();
    spy.mockRestore();
  });

  it("renderiza los hijos normalmente cuando no hay error", () => {
    render(
      <ErrorBoundary>
        <div>Contenido normal</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Contenido normal")).toBeInTheDocument();
    expect(screen.queryByText("Algo se rompió en esta pantalla")).not.toBeInTheDocument();
  });
});
