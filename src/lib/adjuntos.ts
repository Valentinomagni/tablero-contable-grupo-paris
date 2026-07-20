// Adjuntos en tareas (Supabase Storage, bucket privado "adjuntos" — migración 28).
// Funciones puras: nombre de archivo seguro para el path del bucket y validación
// de tamaño/tipo antes de subir.

export const EXTENSIONES_PERMITIDAS = [
  "pdf", "png", "jpg", "jpeg", "xlsx", "xls", "csv", "txt", "docx",
] as const;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function extensionDe(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx > 0 && idx < filename.length - 1 ? filename.slice(idx + 1).toLowerCase() : "";
}

// Slug del nombre base (sin extensión): minúsculas, sin diacríticos, caracteres
// raros → guión, guiones colapsados y sin sobrantes en los extremos.
function slug(base: string): string {
  return base
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Nombre seguro y único para guardar en el bucket: "<timestamp>-<slug>.<ext>".
// El timestamp es parámetro opcional (default Date.now()) para poder testear determinísticamente.
export function nombreSeguro(filename: string, ts: number = Date.now()): string {
  const ext = extensionDe(filename);
  const base = ext ? filename.slice(0, filename.lastIndexOf(".")) : filename;
  const base2 = slug(base) || "archivo";
  return ext ? `${ts}-${base2}.${ext}` : `${ts}-${base2}`;
}

// Valida tamaño y extensión antes de subir. Devuelve null si es válido,
// o el mensaje de error a mostrar si no.
export function validarAdjunto(f: { size: number; name: string }): string | null {
  if (f.size > MAX_BYTES) return "El archivo supera los 10 MB.";
  const ext = extensionDe(f.name);
  if (!(EXTENSIONES_PERMITIDAS as readonly string[]).includes(ext)) return "Tipo de archivo no permitido.";
  return null;
}
