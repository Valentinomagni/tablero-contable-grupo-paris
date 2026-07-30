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
    // El botón "Recargar la app" ya no existe: recargar a ciegas no arregla la mayoría de las
    // fallas. Ahora la acción principal la decide `clasificarFalla` y siempre está la de copiar
    // el detalle, que es lo que permite reportarlo por Consultas.
    expect(screen.getByRole("button", { name: "Copiar detalle" })).toBeInTheDocument();
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

describe("ErrorBoundary — ofrece la acción correcta según la falla", () => {
  // Un componente que revienta con el error que le pasemos.
  function Explota({ error }: { error: Error }): never {
    throw error;
  }

  it("con un módulo que ya no existe, ofrece ACTUALIZAR y no reintentar", () => {
    const e = new Error("Failed to fetch dynamically imported module: /assets/Reporte-a1.js");
    render(<ErrorBoundary><Explota error={e} /></ErrorBoundary>);
    expect(screen.getByText(/versión nueva/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /actualizar/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^reintentar$/i })).toBeNull();
  });

  it("con un error cualquiera, sigue ofreciendo reintentar", () => {
    render(<ErrorBoundary><Explota error={new Error("undefined is not a function")} /></ErrorBoundary>);
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeTruthy();
  });

  it("con falta de permiso, no ofrece ninguna acción que no vaya a servir", () => {
    const e = Object.assign(new Error("permission denied for table cards"), { code: "42501" });
    render(<ErrorBoundary><Explota error={e} /></ErrorBoundary>);
    expect(screen.getByText(/no tenés permiso/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /reintentar/i })).toBeNull();
  });

  it("muestra el detalle técnico para poder reportarlo", () => {
    render(<ErrorBoundary><Explota error={new Error("fallo puntual xyz")} /></ErrorBoundary>);
    expect(screen.getByText(/fallo puntual xyz/)).toBeTruthy();
  });

  it("la explicación no le tira jerga técnica a la persona", () => {
    const e = new Error("Failed to fetch dynamically imported module");
    render(<ErrorBoundary><Explota error={e} /></ErrorBoundary>);
    expect(screen.getByText(/versión nueva/i).textContent).not.toMatch(/chunk|module/i);
  });
});
