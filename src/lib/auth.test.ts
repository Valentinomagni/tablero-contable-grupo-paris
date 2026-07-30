import { describe, it, expect } from "vitest";
import { resuelveIdentificador, usuarioValido, mensajeDeLogin } from "./auth";

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

describe("mensajeDeLogin — explicar en vez de dejar a alguien adivinando", () => {
  it("credenciales incorrectas: dice que puede ser cualquiera de los dos", () => {
    const msg = mensajeDeLogin({ message: "Invalid login credentials" }, "jperez");
    expect(msg).toMatch(/usuario|contraseña/i);
    expect(msg).not.toMatch(/Invalid login credentials/);
  });

  // El caso del 30/07: alguien entró y le dijo "Usuario no encontrado", sin más.
  it("usuario inexistente: sugiere probar con el email y a quién pedirle ayuda", () => {
    const msg = mensajeDeLogin({ codigo: "sin-usuario" }, "jperez");
    expect(msg).toMatch(/jperez/);
    expect(msg).toMatch(/correo|email/i);
  });

  it("si el identificador era un email, NO sugiere probar con el email", () => {
    const msg = mensajeDeLogin({ codigo: "sin-usuario" }, "j@paris.com");
    expect(msg).not.toMatch(/probá con tu correo/i);
  });

  it("sin conexión lo dice, en vez de acusar a la contraseña", () => {
    expect(mensajeDeLogin(new TypeError("Failed to fetch"), "jperez")).toMatch(/conexión|internet/i);
  });

  it("email sin confirmar se distingue de contraseña equivocada", () => {
    expect(mensajeDeLogin({ message: "Email not confirmed" }, "j@paris.com")).toMatch(/confirm/i);
  });

  it("demasiados intentos se distingue, para que no cambien la clave al pedo", () => {
    const msg = mensajeDeLogin({ message: "For security purposes, you can only request this after 42 seconds" }, "j");
    expect(msg).toMatch(/esperá|momento|intentos/i);
  });

  it("nunca devuelve vacío ni el mensaje crudo", () => {
    for (const raro of [null, undefined, {}, "", 0]) {
      const msg = mensajeDeLogin(raro, "x");
      expect(msg.trim().length).toBeGreaterThan(10);
    }
  });
});
