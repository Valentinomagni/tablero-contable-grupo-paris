// Adjuntar una captura al reportar un problema.
//
// EL REPORTE DE MATHI: no se puede mandar evidencia visual, y eso hace que un error tarde tres
// mensajes en entenderse. "No me deja guardar" puede ser diez cosas distintas; la captura las
// distingue en un segundo.
//
// LO IMPORTANTE ES DE DÓNDE VIENE LA IMAGEN. Cuando alguien encuentra un error, aprieta la tecla
// de captura y la imagen queda **en el portapapeles**. Obligarla a guardarla como archivo,
// buscar la carpeta y elegirla es la fricción exacta que hace que no se adjunte: son cuatro
// pasos más justo cuando la persona ya está frustrada. Por eso Ctrl+V es el camino principal y
// el selector de archivo es el de respaldo, no al revés.

/** Formatos que se aceptan. PNG es lo que produce la tecla de captura de Windows. */
const TIPOS = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * 5 MB. Una captura de pantalla completa en PNG ronda 1 a 2 MB; 5 deja margen para dos
 * monitores sin que alguien pueda subir un video por accidente.
 */
export const MAX_CAPTURA = 5 * 1024 * 1024;

/** `null` si la imagen sirve; si no, el motivo en lenguaje de usuario. */
export function validarCaptura(f: File | null): string | null {
  if (!f) return "No se pudo leer la imagen. Probá de nuevo.";
  if (!TIPOS.includes(f.type)) {
    return "El archivo tiene que ser una imagen (PNG, JPG, WEBP o GIF).";
  }
  if (f.size > MAX_CAPTURA) {
    return `La imagen no puede pesar más de ${Math.round(MAX_CAPTURA / 1024 / 1024)} MB.`;
  }
  return null;
}

/**
 * Saca la primera imagen de un evento de pegado, o `null` si lo pegado no es una imagen.
 *
 * DEVUELVE `null` EN SILENCIO CUANDO SE PEGA TEXTO, y es a propósito: pegar texto en el cuadro
 * de la consulta es lo normal y lo más frecuente. Avisar "eso no es una imagen" cada vez que
 * alguien pega una ruta o un mensaje de error sería un reproche por hacer lo correcto.
 *
 * Recibe la lista de items en vez del evento entero para poder testearla sin un DOM.
 */
export function imagenDelPegado(
  items: ArrayLike<{ kind: string; type: string; getAsFile(): File | null }> | null | undefined,
): File | null {
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it?.kind === "file" && typeof it.type === "string" && it.type.startsWith("image/")) {
      return it.getAsFile();
    }
  }
  return null;
}

/**
 * Ruta dentro del bucket `consultas`. **Tiene que empezar con el uuid de quien sube**: la policy
 * de Storage (migración 52) sólo deja escribir en la carpeta propia, así que una ruta con otra
 * forma es un error 403 con un mensaje que no le sirve a nadie.
 *
 * El nombre se arma con la marca de tiempo y no con el del archivo original: lo pegado desde el
 * portapapeles llega como "image.png" siempre, así que usar ese nombre haría que la segunda
 * captura pisara la primera.
 */
export function rutaCaptura(userId: string, tipo: string, ahoraISO: string): string | null {
  if (!userId || !ahoraISO) return null;
  const ext = tipo === "image/jpeg" ? "jpg"
    : tipo === "image/webp" ? "webp"
    : tipo === "image/gif" ? "gif"
    : "png";
  // Sin `:` ni `.` en el nombre: los dos puntos del ISO rompen rutas en algunos clientes de
  // Storage, y un punto de más confunde la extensión.
  const sello = ahoraISO.replace(/[:.]/g, "-");
  return `${userId}/${sello}.${ext}`;
}
