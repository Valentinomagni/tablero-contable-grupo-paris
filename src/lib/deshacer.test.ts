import { describe, it, expect, vi, beforeEach } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import type { Card } from "./types";

// Mock de supabase: from("cards").update(...).eq(...) resuelve con el error configurable.
let nextError: { message: string } | null = null;
const eq = vi.fn(async (_col: string, _val: string) => ({ error: nextError }));
const update = vi.fn((_patch: Partial<Card>) => ({ eq }));
const from = vi.fn((_tabla: string) => ({ update }));
vi.mock("./supabase", () => ({ supabase: { from: (tabla: string) => from(tabla) } }));

import { deshacerUltimo, mensajeDeshacer } from "./deshacer";
import { pushUndo } from "./undo";

const qc = { invalidateQueries: vi.fn() } as unknown as QueryClient;
const card = { id: "c1", title: "Vieja", status: "prog" } as unknown as Card;

beforeEach(() => {
  nextError = null;
  vi.clearAllMocks();
});

describe("mensajeDeshacer (pura)", () => {
  it("sin entrada en la pila", () => {
    expect(mensajeDeshacer(false, null)).toBe("Nada para deshacer.");
  });
  it("éxito", () => {
    expect(mensajeDeshacer(true, null)).toBe("Deshecho");
  });
  it("error de persistencia", () => {
    expect(mensajeDeshacer(true, "timeout")).toBe("No se pudo deshacer: timeout");
  });
});

describe("deshacerUltimo", () => {
  it("pila vacía: no toca supabase ni invalida", async () => {
    expect(await deshacerUltimo(qc)).toBe("Nada para deshacer.");
    expect(from).not.toHaveBeenCalled();
    expect(qc.invalidateQueries).not.toHaveBeenCalled();
  });
  it("restaura el valor previo e invalida cards", async () => {
    pushUndo(card, { title: "Nueva" });
    expect(await deshacerUltimo(qc)).toBe("Deshecho");
    expect(from).toHaveBeenCalledWith("cards");
    expect(update).toHaveBeenCalledWith({ title: "Vieja" });
    expect(eq).toHaveBeenCalledWith("id", "c1");
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["cards"] });
  });
  it("propaga el error de supabase en el mensaje (e igual invalida)", async () => {
    nextError = { message: "sin permisos" };
    pushUndo(card, { status: "term" });
    expect(await deshacerUltimo(qc)).toBe("No se pudo deshacer: sin permisos");
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["cards"] });
  });
});
