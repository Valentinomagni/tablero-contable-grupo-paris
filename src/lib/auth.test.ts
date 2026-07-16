import { describe, it, expect } from "vitest";
import { resuelveIdentificador, usuarioValido } from "./auth";

describe("resuelveIdentificador", () => {
  it("trata un valor con @ como email", () => {
    expect(resuelveIdentificador("vale@x.com")).toBe("email");
  });
  it("trata un valor sin @ como username", () => {
    expect(resuelveIdentificador("Vmagni")).toBe("username");
  });
});

describe("usuarioValido", () => {
  it("rechaza vacío o solo espacios", () => {
    expect(usuarioValido("  ")).toBe(false);
  });
  it("acepta un nombre de usuario real", () => {
    expect(usuarioValido("Vmagni")).toBe(true);
  });
});
