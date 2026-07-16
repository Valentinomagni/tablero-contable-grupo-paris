// Lógica pura de autenticación corporativa (spec #16).
// Decide si un identificador escrito en el login es un EMAIL o un nombre de USUARIO.

export type TipoIdentificador = "email" | "username";

/** Un identificador es email si contiene "@"; si no, es un nombre de usuario. */
export function resuelveIdentificador(identificador: string): TipoIdentificador {
  return identificador.includes("@") ? "email" : "username";
}

/** Un nombre de usuario es válido si no está vacío (ignorando espacios). */
export function usuarioValido(u: string): boolean {
  return u.trim().length > 0;
}
