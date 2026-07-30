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

/**
 * Qué mostrarle a alguien que no pudo entrar.
 *
 * POR QUÉ. Hasta acá el login decía "Usuario no encontrado" y nada más. El 30/07/2026 alguien
 * se quedó afuera con ese cartel: no sabía si había escrito mal, si le habían cambiado el
 * usuario, o si el sistema estaba roto. El sistema SÍ puede distinguir esos casos, y no
 * hacerlo convierte un problema de treinta segundos en una llamada.
 *
 * Regla de seguridad que se respeta igual: ante credenciales incorrectas NO se dice cuál de
 * las dos falló. Decir "el usuario existe pero la contraseña está mal" le confirma a un
 * desconocido que esa cuenta existe.
 *
 * PURA: recibe el error y el identificador, devuelve texto.
 */
export function mensajeDeLogin(e: unknown, identificador: string): string {
  const msg = (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string")
    ? (e as { message: string }).message : "";
  const codigo = (e && typeof e === "object") ? (e as { codigo?: string }).codigo : undefined;
  const id = (identificador ?? "").trim();

  if (/failed to fetch|load failed|networkerror/i.test(msg)) {
    return "No hay conexión con el servidor. Revisá tu internet y probá de nuevo.";
  }

  // Nuestro propio código, cuando el nombre de usuario no resuelve a ninguna cuenta.
  if (codigo === "sin-usuario") {
    const sugerencia = resuelveIdentificador(id) === "username"
      ? " Probá con tu correo en lugar del usuario."
      : "";
    return `No encontré ninguna cuenta con "${id}".${sugerencia} Si estás seguro de que está bien, pedile a la administración que lo verifique.`;
  }

  if (/email not confirmed/i.test(msg)) {
    return "Tu cuenta todavía no está confirmada. Avisale a la administración para que la habilite.";
  }

  if (/for security purposes|rate limit|too many/i.test(msg)) {
    return "Hubo demasiados intentos seguidos. Esperá un momento y volvé a probar — no hace falta cambiar la contraseña.";
  }

  if (/invalid login credentials/i.test(msg)) {
    // A propósito no se aclara cuál de los dos: ver el comentario de arriba.
    return "El usuario o la contraseña no coinciden. Si no la recordás, pedile a la administración que te la blanquee.";
  }

  return "No se pudo iniciar sesión. Probá de nuevo, y si sigue pasando avisale a la administración.";
}
