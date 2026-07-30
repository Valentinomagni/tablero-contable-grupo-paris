import { describe, it, expect, vi, afterEach } from "vitest";
import { instalarRedGlobal } from "./red-global";

let desinstalar: (() => void) | null = null;
afterEach(() => { desinstalar?.(); desinstalar = null; });

describe("instalarRedGlobal", () => {
  it("avisa cuando una promesa queda sin capturar", () => {
    const avisar = vi.fn();
    desinstalar = instalarRedGlobal(avisar);
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), {
      reason: new Error("algo falló en segundo plano"),
    }));
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it("ante una versión nueva ofrece la acción de actualizar", () => {
    const avisar = vi.fn();
    desinstalar = instalarRedGlobal(avisar);
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), {
      reason: new Error("Failed to fetch dynamically imported module"),
    }));
    const accion = avisar.mock.calls[0][1];
    expect(accion?.texto).toMatch(/actualizar/i);
    expect(typeof accion?.hacer).toBe("function");
  });

  it("escucha también el evento propio de Vite para módulos que no cargan", () => {
    const avisar = vi.fn();
    desinstalar = instalarRedGlobal(avisar);
    window.dispatchEvent(Object.assign(new Event("vite:preloadError"), {
      payload: new Error("Failed to fetch dynamically imported module"),
    }));
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  // Un aviso por cada fallo idéntico convierte una falla en una avalancha de carteles, y la
  // persona deja de leerlos. Peor: un bucle de reintentos podría dispararlo cien veces.
  it("no repite el mismo aviso una y otra vez", () => {
    const avisar = vi.fn();
    desinstalar = instalarRedGlobal(avisar);
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(Object.assign(new Event("unhandledrejection"), {
        reason: new Error("el mismo error"),
      }));
    }
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it("dos fallas distintas sí avisan las dos veces", () => {
    const avisar = vi.fn();
    desinstalar = instalarRedGlobal(avisar);
    // Dos fallas DISTINTAS quiere decir dos clasificaciones distintas, no dos mensajes
    // distintos: el deduplicado es por falla (tipo + título) justamente para que cien
    // variantes del mismo problema no se conviertan en cien carteles.
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new Error("una") }));
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new Error("permission denied") }));
    expect(avisar).toHaveBeenCalledTimes(2);
  });

  it("desinstalar deja de avisar, para no filtrar handlers entre tests ni recargas", () => {
    const avisar = vi.fn();
    const quitar = instalarRedGlobal(avisar);
    quitar();
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new Error("x") }));
    expect(avisar).not.toHaveBeenCalled();
  });

  it("no explota si el evento viene sin motivo", () => {
    const avisar = vi.fn();
    desinstalar = instalarRedGlobal(avisar);
    expect(() => window.dispatchEvent(new Event("unhandledrejection"))).not.toThrow();
  });
});
