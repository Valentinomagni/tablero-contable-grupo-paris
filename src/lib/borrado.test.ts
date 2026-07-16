import { describe, it, expect } from "vitest";
import { confirmacionValida } from "./borrado";

describe("confirmacionValida", () => {
  it("acepta el nombre exacto", () =>
    expect(confirmacionValida("Ana Pérez", "Ana Pérez")).toBe(true));
  it("tolera espacios sobrantes al inicio/fin", () =>
    expect(confirmacionValida("  Ana Pérez  ", "Ana Pérez")).toBe(true));
  it("rechaza si difiere en mayúsculas", () =>
    expect(confirmacionValida("ana pérez", "Ana Pérez")).toBe(false));
  it("rechaza un nombre distinto", () =>
    expect(confirmacionValida("Otro", "Ana Pérez")).toBe(false));
  it("rechaza cadena vacía", () =>
    expect(confirmacionValida("", "Ana Pérez")).toBe(false));
  it("rechaza solo espacios", () =>
    expect(confirmacionValida("   ", "Ana Pérez")).toBe(false));
  it("rechaza si el nombre real está vacío", () =>
    expect(confirmacionValida("", "")).toBe(false));
});
