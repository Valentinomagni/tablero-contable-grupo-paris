import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { abrirImpresion } from "./impresion-dom";

// POR QUÉ EXISTE ESTE ARCHIVO: el bug original (PDF en blanco) se dio por arreglado
// verificándolo con algo que NO ejercitaba el motor de impresión. `abrirImpresion` es la
// única pieza que toca el navegador y donde vive ese modo de falla — el orden
// print-después-de-load, el guard de doble diálogo y el aviso cuando bloquean la ventana.
// Dejarla sin tests repetiría la forma de aquella falla.

function ventanaFalsa() {
  return {
    document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
    focus: vi.fn(),
    print: vi.fn(),
    onload: null as null | (() => void),
  };
}

let openSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); openSpy?.mockRestore(); });

describe("abrirImpresion", () => {
  it("escribe el documento y cierra el stream antes de imprimir", () => {
    const win = ventanaFalsa();
    openSpy = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);

    expect(abrirImpresion("<!DOCTYPE html><html></html>")).toBe(true);
    expect(win.document.open).toHaveBeenCalled();
    expect(win.document.write).toHaveBeenCalledWith("<!DOCTYPE html><html></html>");
    expect(win.document.close).toHaveBeenCalled();
    // clave: NO se imprimió todavía — imprimir antes de que el documento esté listo es
    // exactamente lo que produce la hoja en blanco.
    expect(win.print).not.toHaveBeenCalled();
  });

  it("imprime cuando el documento termina de cargar", () => {
    const win = ventanaFalsa();
    openSpy = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);

    abrirImpresion("<html></html>");
    win.onload?.();
    expect(win.print).toHaveBeenCalledTimes(1);
    expect(win.focus).toHaveBeenCalled();
  });

  it("imprime igual por el respaldo si 'load' nunca dispara", () => {
    const win = ventanaFalsa();
    openSpy = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);

    abrirImpresion("<html></html>");
    expect(win.print).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(win.print).toHaveBeenCalledTimes(1);
  });

  it("NO abre dos diálogos cuando disparan el evento Y el respaldo", () => {
    const win = ventanaFalsa();
    openSpy = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);

    abrirImpresion("<html></html>");
    win.onload?.();          // camino 1
    vi.advanceTimersByTime(500); // camino 2
    expect(win.print).toHaveBeenCalledTimes(1);
  });

  it("devuelve false si el navegador bloqueó la ventana emergente", () => {
    openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    expect(abrirImpresion("<html></html>")).toBe(false);
  });

  it("devuelve false si window.open lanza, en vez de propagar el error", () => {
    openSpy = vi.spyOn(window, "open").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(abrirImpresion("<html></html>")).toBe(false);
  });

  it("devuelve false si el documento no se puede escribir (stub de bloqueador)", () => {
    const win = ventanaFalsa();
    win.document.write = vi.fn(() => { throw new Error("no escribible"); });
    openSpy = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    // Sin esto la excepción escapaba del onClick y el usuario no recibía ningún aviso.
    expect(abrirImpresion("<html></html>")).toBe(false);
  });

  it("si print() falla (ventana cerrada por el usuario) no propaga el error", () => {
    const win = ventanaFalsa();
    win.print = vi.fn(() => { throw new Error("ventana cerrada"); });
    openSpy = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);

    abrirImpresion("<html></html>");
    expect(() => win.onload?.()).not.toThrow();
  });
});
