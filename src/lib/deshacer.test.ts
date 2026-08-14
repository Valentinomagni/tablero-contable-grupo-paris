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
  // HALLAZGO 6 DE LA AUDITORÍA DEL 05/08: antes esto devolvía "No se pudo deshacer: " + el
  // mensaje crudo de Postgres. Alguien que apretaba Ctrl+Z podía terminar leyendo el nombre de
  // una policy de RLS, que no le dice qué hacer y encima expone la base.
  it("un error sin clasificar dice qué hacer, no qué falló", () => {
    const m = mensajeDeshacer(true, "timeout");
    expect(m).toContain("deshacer el último cambio");
    expect(m).toContain("Consultas");
  });

  it("NUNCA deja pasar el texto crudo de la base", () => {
    // El caso real: el mensaje de RLS nombra la tabla y la policy.
    const crudo = 'new row violates row-level security policy for table "cards"';
    const m = mensajeDeshacer(true, crudo);
    expect(m).not.toContain("row-level security");
    expect(m).not.toContain("cards");
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
  // Este aserto decía `toBe("No se pudo deshacer: sin permisos")`, o sea que verificaba
  // exactamente la conducta que la auditoría del 05/08 marcó como defecto: el texto de la base
  // saliendo tal cual. No se ajustó el número para que pasara — cambió lo que se prueba.
  //
  // Lo que importa sigue siendo lo mismo y sigue verificado: que ante un fallo se avise, y que
  // la caché se invalide igual (si no, la pantalla queda mostrando el cambio que no se guardó).
  it("ante un error avisa sin exponer la base, e invalida igual", async () => {
    nextError = { message: "sin permisos" };
    pushUndo(card, { status: "term" });
    const m = await deshacerUltimo(qc);
    expect(m).toContain("deshacer el último cambio");
    expect(m).not.toContain("sin permisos");
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["cards"] });
  });
});
